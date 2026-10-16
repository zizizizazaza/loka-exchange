// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {IAIUSDGateway} from "./interfaces/IAIUSDGateway.sol";
import {ICollectionVault} from "./interfaces/ICollectionVault.sol";
import {IGuardian} from "./interfaces/IGuardian.sol";
import {ILoanShares} from "./interfaces/ILoanShares.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";
import {SignerSet} from "./libraries/SignerSet.sol";
import {
    BPS,
    COND_EQUIPMENT_ONLINE,
    COND_SPV_AND_PLEDGE,
    LoanParams,
    UPTIME_REPORT_TYPEHASH,
    UptimeReport,
    VaultState
} from "./types/LoanTypes.sol";

/// @title Collection vault
/// @notice Receives one loan's rent and pays holders, the platform and the operator in order.
///         Deployed as a minimal proxy by the factory. See ICollectionVault for the rules.
/// @dev Accounting invariant: the vault's AIUSD balance always equals
///      rentPool + reserveBalance + heldSurplus + operatorClaimable + (totalCredited - totalClaimed).
contract CollectionVault is ICollectionVault, EIP712, Initializable, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    uint256 private constant ACC_PRECISION = 1e18;
    uint256 private constant YEAR = 365 days;

    /* ---------- Wiring ---------- */

    address public escrow;
    address public shares;
    IERC20 public aiusd;
    IRegistry public registry;
    IGuardian public guardian;
    IAIUSDGateway public gateway;

    /* ---------- Terms, fixed at listing ---------- */

    uint256[] private _principalDue;
    uint256[] private _interestDue;
    uint32 public periodLength;
    uint256 public reserveTarget;
    address public operatorWallet;
    address public feeRecipient;
    uint16 public feeBps;
    uint16 public rateBps;
    uint16 public cureCoverageBps;
    uint32 public curePeriod;
    uint16 public prepayFeeBps;
    uint32 public prepayLockup;
    address[] private _monitoringNodes;
    uint8 public monitoringThreshold;

    /* ---------- State ---------- */

    VaultState public state;
    uint64 public releasedAt;
    uint32 public settledPeriods;
    uint16 public lastCoverageBps;
    uint64 public cureDeadline;

    uint256 public rentPool;
    uint256 public reserveBalance;
    uint256 public heldSurplus;
    uint256 public operatorClaimable;

    /// @notice Principal not yet repaid to holders. Includes principal in arrears.
    uint256 public outstandingPrincipal;
    uint256 private _interestArrears;
    uint256 private _principalArrears;

    /// @dev Default only: interest owed to holders, and when it was last accrued.
    uint256 private _defaultInterest;
    uint64 private _lastAccrual;

    /* ---------- Holder accounting ---------- */

    /// @dev AIUSD credited per share, scaled by ACC_PRECISION. Shares never change after release.
    uint256 private _accPerShare;
    mapping(address => uint256) private _claimed;
    uint256 public totalCredited;
    uint256 public totalClaimed;

    /// @dev Values computed while settling one period; a struct keeps settle() within the stack limit.
    struct Settlement {
        uint32 period;
        uint256 rent;
        uint256 owed;
        uint256 paid;
        uint256 fromReserve;
        uint256 fee;
        uint256 toOperator;
        uint16 coverage;
    }

    constructor() EIP712("Loka Collection Vault", "1") {
        _disableInitializers();
    }

    /// @notice Called once by the factory right after cloning.
    function initialize(
        LoanParams calldata p,
        address escrow_,
        address shares_,
        IRegistry registry_,
        IGuardian guardian_,
        IAIUSDGateway gateway_
    ) external initializer {
        escrow = escrow_;
        shares = shares_;
        registry = registry_;
        guardian = guardian_;
        gateway = gateway_;
        aiusd = IERC20(gateway_.aiusd());

        _principalDue = p.schedule.principalDue;
        _interestDue = p.schedule.interestDue;
        periodLength = p.schedule.periodLength;
        for (uint256 i; i < p.reserveMonths; ++i) {
            reserveTarget += p.schedule.principalDue[i] + p.schedule.interestDue[i];
        }
        operatorWallet = p.operatorWallet;
        feeRecipient = p.feeRecipient;
        feeBps = p.feeBps;
        rateBps = p.rateBps;
        cureCoverageBps = p.cureCoverageBps;
        curePeriod = p.curePeriod;
        prepayFeeBps = p.prepayFeeBps;
        prepayLockup = p.prepayLockup;
        _monitoringNodes = p.conditions[COND_EQUIPMENT_ONLINE - COND_SPV_AND_PLEDGE].signers;
        monitoringThreshold = p.conditions[COND_EQUIPMENT_ONLINE - COND_SPV_AND_PLEDGE].threshold;
        outstandingPrincipal = p.principal;
    }

    /* ---------- Activation ---------- */

    function activate(uint256 reserve) external {
        if (msg.sender != escrow) revert NotEscrow(msg.sender);
        if (state != VaultState.Inactive) revert WrongState(state);
        state = VaultState.Repaying;
        releasedAt = uint64(block.timestamp);
        reserveBalance = reserve;
        emit Activated(releasedAt, reserve);
    }

    /* ---------- Incoming funds ---------- */

    function depositRent(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (state == VaultState.Inactive || state == VaultState.Matured) revert WrongState(state);
        aiusd.safeTransferFrom(msg.sender, address(this), amount);
        emit RentDeposited(msg.sender, amount);
        if (state == VaultState.Default) {
            _applyRecovery(amount);
        } else {
            rentPool += amount;
        }
    }

    function depositRecovery(uint256 amount, bytes32 evidenceHash) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (state != VaultState.Default) revert WrongState(state);
        aiusd.safeTransferFrom(msg.sender, address(this), amount);
        emit RecoveryDeposited(msg.sender, amount, evidenceHash);
        _applyRecovery(amount);
    }

    /* ---------- Settlement ---------- */

    function settle() external nonReentrant {
        if (state != VaultState.Repaying && state != VaultState.Cure) revert WrongState(state);
        Settlement memory s;
        s.period = settledPeriods + 1;
        if (s.period > _principalDue.length) revert AllPeriodsSettled();
        uint64 due = dueDate(s.period);
        if (block.timestamp < due) revert NotDueYet(s.period, due);
        settledPeriods = s.period;

        uint256 scheduled = _principalDue[s.period - 1] + _interestDue[s.period - 1];
        s.rent = rentPool;
        rentPool = 0;

        // 1. Holders: this period's payment joins any arrears; rent first, then the reserve.
        _interestArrears += _interestDue[s.period - 1];
        _principalArrears += _principalDue[s.period - 1];
        s.owed = _interestArrears + _principalArrears;
        uint256 fromRent = Math.min(s.rent, s.owed);
        s.fromReserve = Math.min(reserveBalance, s.owed - fromRent);
        reserveBalance -= s.fromReserve;
        s.paid = fromRent + s.fromReserve;
        _payScheduled(s.paid);
        uint256 available = s.rent - fromRent;

        // 2. Refill the reserve.
        uint256 refill = Math.min(available, reserveTarget - reserveBalance);
        reserveBalance += refill;
        available -= refill;

        // 3. Service fee, only once holders are whole and the reserve is full.
        if (arrears() == 0 && reserveBalance == reserveTarget) {
            s.fee = Math.min(available, s.rent * feeBps / BPS);
            available -= s.fee;
            if (s.fee > 0) aiusd.safeTransfer(feeRecipient, s.fee);
        }

        // 4. The rest: to the operator, or held while in cure.
        if (state == VaultState.Repaying) {
            s.toOperator = available;
            operatorClaimable += available;
        } else if (available > 0) {
            heldSurplus += available;
            emit SurplusHeld(s.period, available);
        }

        s.coverage = _coverage(s.rent, scheduled);
        lastCoverageBps = s.coverage;
        emit PeriodSettled(
            s.period, s.rent, s.owed, s.paid, s.fromReserve, arrears(), s.fee, s.toOperator, s.coverage
        );

        if (state == VaultState.Repaying) {
            if (s.coverage < cureCoverageBps) {
                state = VaultState.Cure;
                cureDeadline = uint64(block.timestamp) + curePeriod;
                emit CureStarted(s.period, s.coverage, cureDeadline);
            }
        } else if (_isCured()) {
            _cure();
        }
        _matureIfDone();
    }

    function recordUptime(UptimeReport calldata r, bytes[] calldata signatures) external {
        if (state == VaultState.Inactive) revert WrongState(state);
        if (block.timestamp > r.deadline) revert SignatureExpired(r.deadline);
        if (signatures.length != _monitoringNodes.length) {
            revert SignatureCountMismatch(_monitoringNodes.length, signatures.length);
        }
        uint256 valid = SignerSet.validSigners(_monitoringNodes, hashUptimeReport(r), signatures).length;
        if (valid < monitoringThreshold) revert NotEnoughSignatures(valid, monitoringThreshold);
        emit UptimeRecorded(r.period, r.uptimeBps, r.gpusOnline, r.dataHash);
    }

    /* ---------- Cure and default ---------- */

    function checkCure() external nonReentrant {
        if (state != VaultState.Cure) revert WrongState(state);
        if (_isCured()) {
            _cure();
            _matureIfDone();
            return;
        }
        if (block.timestamp <= cureDeadline) revert CureNotOver(cureDeadline);
        _default(true, bytes32(0));
    }

    function declareDefault(bytes32 reasonHash) external nonReentrant {
        if (msg.sender != guardian.multisig()) revert NotMultisig(msg.sender);
        if (state != VaultState.Repaying && state != VaultState.Cure) revert WrongState(state);
        _default(false, reasonHash);
    }

    function recordDisposition(bytes32 docHash, bytes32 noteHash) external {
        if (msg.sender != guardian.multisig()) revert NotMultisig(msg.sender);
        if (state != VaultState.Default) revert WrongState(state);
        emit DispositionRecorded(docHash, noteHash);
    }

    /* ---------- Prepayment ---------- */

    function prepay() external nonReentrant {
        if (msg.sender != operatorWallet) revert NotOperator(msg.sender);
        if (state != VaultState.Repaying && state != VaultState.Cure) revert WrongState(state);
        uint64 allowedFrom = releasedAt + prepayLockup;
        if (block.timestamp < allowedFrom) revert PrepayLocked(allowedFrom);

        uint256 principalLeft = outstandingPrincipal;
        uint256 nextInterest = settledPeriods < _interestDue.length ? _interestDue[settledPeriods] : 0;
        uint256 interest = _interestArrears + nextInterest;
        uint256 fee = principalLeft * prepayFeeBps / BPS;
        uint256 total = principalLeft + interest + fee;

        aiusd.safeTransferFrom(msg.sender, address(this), total);
        _interestArrears = 0;
        _principalArrears = 0;
        outstandingPrincipal = 0;
        _creditHolders(total);
        emit Prepaid(principalLeft, interest, fee);

        if (state == VaultState.Cure) _cure();
        _mature();
    }

    /* ---------- Payouts ---------- */

    function claim() external nonReentrant returns (uint256 amount) {
        if (registry.isFrozen(msg.sender)) revert HolderFrozen(msg.sender);
        amount = claimable(msg.sender);
        if (amount == 0) revert NothingToClaim(msg.sender);
        _pay(msg.sender, amount);
    }

    function claimFor(address[] calldata holders) external nonReentrant {
        for (uint256 i; i < holders.length; ++i) {
            address holder = holders[i];
            if (registry.isFrozen(holder)) continue;
            uint256 amount = claimable(holder);
            if (amount != 0) _pay(holder, amount);
        }
    }

    function payOperator() external nonReentrant {
        uint256 amount = operatorClaimable;
        if (amount == 0) revert NothingToClaim(operatorWallet);
        operatorClaimable = 0;
        gateway.redeem(amount, operatorWallet);
        emit OperatorPaid(amount);
    }

    /* ---------- Views ---------- */

    function dueDate(uint32 period) public view returns (uint64) {
        return releasedAt + uint64(period) * periodLength;
    }

    function arrears() public view returns (uint256) {
        return _interestArrears + _principalArrears;
    }

    function defaultClaim() external view returns (uint256) {
        if (state != VaultState.Default) return 0;
        return outstandingPrincipal + _defaultInterest + _pendingInterest();
    }

    function claimable(address holder) public view returns (uint256) {
        uint256 earned = Math.mulDiv(ILoanShares(shares).balanceOf(holder), _accPerShare, ACC_PRECISION);
        return earned - _claimed[holder];
    }

    function hashUptimeReport(UptimeReport calldata r) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(UPTIME_REPORT_TYPEHASH, r.period, r.uptimeBps, r.gpusOnline, r.dataHash, r.deadline))
        );
    }

    /* ---------- Internal ---------- */

    /// @dev Pays scheduled amounts: interest first, then principal.
    function _payScheduled(uint256 amount) private {
        uint256 toInterest = Math.min(amount, _interestArrears);
        _interestArrears -= toInterest;
        uint256 toPrincipal = amount - toInterest;
        _principalArrears -= toPrincipal;
        outstandingPrincipal -= toPrincipal;
        _creditHolders(amount);
    }

    function _creditHolders(uint256 amount) private {
        if (amount == 0) return;
        _accPerShare += Math.mulDiv(amount, ACC_PRECISION, ILoanShares(shares).totalSupply());
        totalCredited += amount;
    }

    function _pay(address holder, uint256 amount) private {
        _claimed[holder] += amount;
        totalClaimed += amount;
        aiusd.safeTransfer(holder, amount);
        emit Claimed(holder, amount);
    }

    function _isCured() private view returns (bool) {
        return lastCoverageBps >= cureCoverageBps && arrears() == 0 && reserveBalance >= reserveTarget;
    }

    function _cure() private {
        state = VaultState.Repaying;
        cureDeadline = 0;
        operatorClaimable += heldSurplus;
        heldSurplus = 0;
        emit Cured();
    }

    function _matureIfDone() private {
        if (state == VaultState.Repaying && settledPeriods == _principalDue.length && arrears() == 0) _mature();
    }

    /// @dev Holders are paid in full; whatever else the vault holds goes back to the operator.
    function _mature() private {
        state = VaultState.Matured;
        uint256 rest = reserveBalance + heldSurplus + rentPool;
        reserveBalance = 0;
        heldSurplus = 0;
        rentPool = 0;
        operatorClaimable += rest;
        emit Matured(rest);
    }

    function _default(bool automatic, bytes32 reasonHash) private {
        state = VaultState.Default;
        cureDeadline = 0;

        // Unpaid interest carries over; principal in arrears is already in outstandingPrincipal.
        _defaultInterest = _interestArrears;
        _interestArrears = 0;
        _principalArrears = 0;
        _lastAccrual = settledPeriods == 0 ? releasedAt : dueDate(settledPeriods);
        _accrue();
        emit DefaultDeclared(automatic, reasonHash, outstandingPrincipal + _defaultInterest);

        uint256 pot = reserveBalance + heldSurplus + rentPool;
        reserveBalance = 0;
        heldSurplus = 0;
        rentPool = 0;
        _applyRecovery(pot);
    }

    /// @dev In default: interest first, then principal; anything beyond the holders' claim goes to the operator.
    function _applyRecovery(uint256 amount) private {
        _accrue();
        uint256 toInterest = Math.min(amount, _defaultInterest);
        uint256 toPrincipal = Math.min(amount - toInterest, outstandingPrincipal);
        _defaultInterest -= toInterest;
        outstandingPrincipal -= toPrincipal;
        _creditHolders(toInterest + toPrincipal);
        operatorClaimable += amount - toInterest - toPrincipal;
    }

    function _accrue() private {
        _defaultInterest += _pendingInterest();
        _lastAccrual = uint64(block.timestamp);
    }

    function _pendingInterest() private view returns (uint256) {
        return outstandingPrincipal * rateBps * (block.timestamp - _lastAccrual) / (YEAR * BPS);
    }

    function _coverage(uint256 rent, uint256 scheduled) private pure returns (uint16) {
        if (scheduled == 0) return type(uint16).max;
        return uint16(Math.min(rent * BPS / scheduled, type(uint16).max));
    }
}
