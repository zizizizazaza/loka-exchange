// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {IAIUSDGateway} from "./interfaces/IAIUSDGateway.sol";
import {ICollectionVault} from "./interfaces/ICollectionVault.sol";
import {IGuardian} from "./interfaces/IGuardian.sol";
import {ILoanEscrow} from "./interfaces/ILoanEscrow.sol";
import {ILoanShares} from "./interfaces/ILoanShares.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";
import {SignerSet} from "./libraries/SignerSet.sol";
import {
    ATTESTATION_TYPEHASH,
    Attestation,
    BPS,
    COND_APPRAISAL,
    COND_EQUIPMENT_ONLINE,
    COND_FULLY_SUBSCRIBED,
    COND_SPV_AND_PLEDGE,
    CONDITION_COUNT,
    ConditionSpec,
    EscrowState,
    LoanParams,
    PAUSE_RELEASE,
    PAUSE_SUBSCRIBE,
    RefundReason
} from "./types/LoanTypes.sol";

/// @title Loan escrow
/// @notice Holds one loan's subscriptions until all 6 conditions are met, then releases to the SPV;
///         otherwise refunds everyone. Deployed as a minimal proxy by the factory. See ILoanEscrow.
contract LoanEscrow is ILoanEscrow, EIP712, Initializable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    LoanParams private _params;

    IRegistry public registry;
    IGuardian public guardian;
    IAIUSDGateway public gateway;
    IERC20 public aiusd;
    address public vault;
    address public shares;

    EscrowState public state;
    RefundReason public refundReason;

    /// @dev Equals this contract's AIUSD balance until release.
    uint256 public totalSubscribed;
    mapping(address => uint256) public subscriptionOf;

    address[] private _subscribers;
    /// @dev 1-based position in _subscribers; 0 = not listed.
    mapping(address => uint256) private _subscriberIndex;

    /// @dev Conditions 2-6 currently attested.
    mapping(uint8 => bool) private _attested;
    uint8 private _attestedCount;

    constructor() EIP712("Loka Loan Escrow", "1") {
        _disableInitializers();
    }

    /// @notice Called once by the factory right after cloning.
    function initialize(
        LoanParams calldata p,
        IRegistry registry_,
        IGuardian guardian_,
        IAIUSDGateway gateway_,
        address vault_,
        address shares_
    ) external initializer {
        registry = registry_;
        guardian = guardian_;
        gateway = gateway_;
        aiusd = IERC20(gateway_.aiusd());
        vault = vault_;
        shares = shares_;
        _storeParams(p);
    }

    modifier inState(EscrowState expected) {
        if (state != expected) revert WrongState(state);
        _;
    }

    /// @dev Subscribing or Verifying: before release and before any refund.
    modifier beforeRelease() {
        if (state != EscrowState.Subscribing && state != EscrowState.Verifying) revert WrongState(state);
        _;
    }

    /* ---------- Investors ---------- */

    function subscribe(uint256 amount) external nonReentrant inState(EscrowState.Subscribing) {
        if (guardian.isPaused(PAUSE_SUBSCRIBE)) revert Paused();
        if (block.timestamp > _params.subscriptionDeadline) revert DeadlinePassed();
        if (!registry.isInvestor(msg.sender)) revert NotInvestor(msg.sender);

        uint256 remaining = _params.principal - totalSubscribed;
        if (amount > remaining) revert ExceedsRemaining(amount, remaining);
        // Below the minimum only to take exactly the last slice.
        uint256 minimum = remaining < _params.minSubscription ? remaining : _params.minSubscription;
        if (amount == 0 || amount < minimum) revert BelowMinimum(amount, minimum);

        if (_subscriberIndex[msg.sender] == 0) {
            if (_subscribers.length >= _params.maxSubscribers) revert TooManySubscribers(_params.maxSubscribers);
            _subscribers.push(msg.sender);
            _subscriberIndex[msg.sender] = _subscribers.length;
        }
        subscriptionOf[msg.sender] += amount;
        totalSubscribed += amount;

        aiusd.safeTransferFrom(msg.sender, address(this), amount);
        emit Subscribed(msg.sender, amount, totalSubscribed);

        if (totalSubscribed == _params.principal) {
            state = EscrowState.Verifying;
            emit FullySubscribed(totalSubscribed);
        }
    }

    function withdraw() external nonReentrant inState(EscrowState.Subscribing) {
        if (block.timestamp > _params.subscriptionDeadline) revert DeadlinePassed();
        uint256 amount = subscriptionOf[msg.sender];
        if (amount == 0) revert NothingToWithdraw(msg.sender);

        subscriptionOf[msg.sender] = 0;
        totalSubscribed -= amount;
        _removeSubscriber(msg.sender);

        aiusd.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, totalSubscribed);
    }

    /* ---------- Release conditions ---------- */

    function attest(Attestation calldata a, bytes[] calldata signatures) external beforeRelease {
        if (block.timestamp > _params.releaseDeadline) revert DeadlinePassed();
        if (a.conditionId < COND_SPV_AND_PLEDGE || a.conditionId > COND_APPRAISAL) revert UnknownCondition(a.conditionId);
        if (block.timestamp > a.deadline) revert SignatureExpired(a.deadline);

        ConditionSpec storage spec = _params.conditions[a.conditionId - COND_SPV_AND_PLEDGE];
        if (signatures.length != spec.signers.length) {
            revert SignatureCountMismatch(spec.signers.length, signatures.length);
        }
        address[] memory signed = SignerSet.validSigners(spec.signers, hashAttestation(a), signatures);
        if (signed.length < spec.threshold) {
            revert NotEnoughSignatures(a.conditionId, signed.length, spec.threshold);
        }

        if (a.conditionId == COND_EQUIPMENT_ONLINE && a.amount != _params.gpuCount) {
            revert GpuCountMismatch(_params.gpuCount, a.amount);
        }
        if (a.conditionId == COND_APPRAISAL && _params.principal * BPS > a.amount * _params.maxLtvBps) {
            revert AppraisalTooLow(_params.principal, a.amount, _params.maxLtvBps);
        }

        if (!_attested[a.conditionId]) {
            _attested[a.conditionId] = true;
            ++_attestedCount;
        }
        emit ConditionAttested(a.conditionId, a.docHash, a.refNo, a.amount, signed);
    }

    function revokeAttestation(uint8 conditionId, bytes32 reasonHash) external beforeRelease {
        if (conditionId < COND_SPV_AND_PLEDGE || conditionId > COND_APPRAISAL) revert UnknownCondition(conditionId);
        address[] storage signers = _params.conditions[conditionId - COND_SPV_AND_PLEDGE].signers;
        if (msg.sender != guardian.multisig() && !SignerSet.contains(signers, msg.sender)) {
            revert NotSignerOfCondition(msg.sender, conditionId);
        }
        if (_attested[conditionId]) {
            _attested[conditionId] = false;
            --_attestedCount;
        }
        emit AttestationRevoked(conditionId, msg.sender, reasonHash);
    }

    /* ---------- Release and refund ---------- */

    function release() external nonReentrant inState(EscrowState.Verifying) {
        if (guardian.isPaused(PAUSE_RELEASE)) revert Paused();
        if (block.timestamp > _params.releaseDeadline) revert DeadlinePassed();
        uint8 met = conditionsMet();
        if (met < CONDITION_COUNT) revert ConditionsIncomplete(met);

        state = EscrowState.Released;

        uint256 reserve = _reserveAmount();
        uint256 paidToSpv = _params.principal - reserve;

        aiusd.safeTransfer(vault, reserve);
        ICollectionVault(vault).activate(reserve);
        if (paidToSpv > 0) gateway.redeem(paidToSpv, _params.spvWallet);

        uint256 n = _subscribers.length;
        for (uint256 i; i < n; ++i) {
            address investor = _subscribers[i];
            ILoanShares(shares).mint(investor, subscriptionOf[investor]);
        }

        emit Released(_params.spvWallet, paidToSpv, reserve);
    }

    function expire() external {
        if (state == EscrowState.Subscribing) {
            if (block.timestamp <= _params.subscriptionDeadline) revert DeadlineNotReached();
            _openRefund(RefundReason.NotFullySubscribed, bytes32(0));
        } else if (state == EscrowState.Verifying) {
            if (block.timestamp <= _params.releaseDeadline) revert DeadlineNotReached();
            _openRefund(RefundReason.ConditionsNotMet, bytes32(0));
        } else {
            revert WrongState(state);
        }
    }

    function cancel(bytes32 reasonHash) external beforeRelease {
        if (msg.sender != guardian.multisig()) revert NotMultisig(msg.sender);
        _openRefund(RefundReason.Cancelled, reasonHash);
    }

    function claimRefund() external nonReentrant inState(EscrowState.Refunding) {
        if (subscriptionOf[msg.sender] == 0) revert NothingToRefund(msg.sender);
        _refund(msg.sender);
    }

    function refundBatch(address[] calldata investors) external nonReentrant inState(EscrowState.Refunding) {
        for (uint256 i; i < investors.length; ++i) {
            if (subscriptionOf[investors[i]] != 0) _refund(investors[i]);
        }
    }

    /* ---------- Views ---------- */

    function params() external view returns (LoanParams memory) {
        return _params;
    }

    function subscribers() external view returns (address[] memory) {
        return _subscribers;
    }

    function conditionMet(uint8 conditionId) public view returns (bool) {
        if (conditionId == COND_FULLY_SUBSCRIBED) return totalSubscribed == _params.principal;
        if (conditionId < COND_SPV_AND_PLEDGE || conditionId > COND_APPRAISAL) revert UnknownCondition(conditionId);
        return _attested[conditionId];
    }

    function conditionsMet() public view returns (uint8) {
        return _attestedCount + (conditionMet(COND_FULLY_SUBSCRIBED) ? 1 : 0);
    }

    function hashAttestation(Attestation calldata a) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(ATTESTATION_TYPEHASH, a.conditionId, a.docHash, a.refNo, a.amount, a.deadline))
        );
    }

    /* ---------- Internal ---------- */

    function _openRefund(RefundReason reason, bytes32 reasonHash) private {
        state = EscrowState.Refunding;
        refundReason = reason;
        emit RefundOpened(reason, reasonHash);
    }

    function _refund(address investor) private {
        uint256 amount = subscriptionOf[investor];
        subscriptionOf[investor] = 0;
        totalSubscribed -= amount;
        aiusd.safeTransfer(investor, amount);
        emit Refunded(investor, amount);
    }

    function _removeSubscriber(address investor) private {
        uint256 index = _subscriberIndex[investor];
        uint256 last = _subscribers.length;
        if (index != last) {
            address moved = _subscribers[last - 1];
            _subscribers[index - 1] = moved;
            _subscriberIndex[moved] = index;
        }
        _subscribers.pop();
        delete _subscriberIndex[investor];
    }

    /// @dev Reserve = sum of the first reserveMonths scheduled payments (PRD 4.5.5).
    function _reserveAmount() private view returns (uint256 reserve) {
        for (uint256 i; i < _params.reserveMonths; ++i) {
            reserve += _params.schedule.principalDue[i] + _params.schedule.interestDue[i];
        }
    }

    /// @dev Copied field by field: the compiler cannot copy nested dynamic arrays from calldata to storage in one go.
    function _storeParams(LoanParams calldata p) private {
        _params.loanCode = p.loanCode;
        _params.termsHash = p.termsHash;
        _params.principal = p.principal;
        _params.minSubscription = p.minSubscription;
        _params.maxSubscribers = p.maxSubscribers;
        _params.subscriptionDeadline = p.subscriptionDeadline;
        _params.releaseDeadline = p.releaseDeadline;
        for (uint256 i; i < CONDITION_COUNT - 1; ++i) {
            _params.conditions[i].signers = p.conditions[i].signers;
            _params.conditions[i].threshold = p.conditions[i].threshold;
        }
        _params.gpuCount = p.gpuCount;
        _params.maxLtvBps = p.maxLtvBps;
        _params.spvWallet = p.spvWallet;
        _params.operatorWallet = p.operatorWallet;
        _params.feeRecipient = p.feeRecipient;
        _params.feeBps = p.feeBps;
        _params.rateBps = p.rateBps;
        _params.schedule.periodLength = p.schedule.periodLength;
        _params.schedule.principalDue = p.schedule.principalDue;
        _params.schedule.interestDue = p.schedule.interestDue;
        _params.reserveMonths = p.reserveMonths;
        _params.cureCoverageBps = p.cureCoverageBps;
        _params.curePeriod = p.curePeriod;
        _params.prepayFeeBps = p.prepayFeeBps;
        _params.prepayLockup = p.prepayLockup;
    }
}
