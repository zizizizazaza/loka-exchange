// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {CollectionVault} from "./CollectionVault.sol";
import {IAIUSDGateway} from "./interfaces/IAIUSDGateway.sol";
import {IGuardian} from "./interfaces/IGuardian.sol";
import {ILoanFactory} from "./interfaces/ILoanFactory.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";
import {LoanEscrow} from "./LoanEscrow.sol";
import {LoanShares} from "./LoanShares.sol";
import {CONDITION_COUNT, ConditionSpec, LoanParams, RepaymentSchedule} from "./types/LoanTypes.sol";

/// @title Loan factory
/// @notice Lists loans by cloning the escrow, vault and shares implementations. See ILoanFactory.
contract LoanFactory is ILoanFactory {
    uint16 public constant MAX_LTV_BPS = 8000;
    uint256 public constant MAX_PERIODS = 36;

    address public immutable registry;
    address public immutable gateway;
    address public immutable guardian;

    address public immutable escrowImplementation;
    address public immutable vaultImplementation;
    address public immutable sharesImplementation;

    struct Loan {
        address escrow;
        address vault;
        address shares;
    }

    mapping(bytes32 => Loan) private _loans;
    mapping(address => bool) private _loanContracts;
    uint256 public loanCount;

    constructor(
        address registry_,
        address gateway_,
        address guardian_,
        address escrowImplementation_,
        address vaultImplementation_,
        address sharesImplementation_
    ) {
        registry = registry_;
        gateway = gateway_;
        guardian = guardian_;
        escrowImplementation = escrowImplementation_;
        vaultImplementation = vaultImplementation_;
        sharesImplementation = sharesImplementation_;
    }

    function createLoan(LoanParams calldata p) external returns (address escrow, address vault, address shares) {
        if (msg.sender != IGuardian(guardian).multisig()) revert NotMultisig(msg.sender);
        if (_loans[p.loanCode].escrow != address(0)) revert LoanCodeTaken(p.loanCode);
        _validate(p);

        escrow = Clones.clone(escrowImplementation);
        vault = Clones.clone(vaultImplementation);
        shares = Clones.clone(sharesImplementation);

        _loans[p.loanCode] = Loan(escrow, vault, shares);
        _loanContracts[escrow] = true;
        _loanContracts[vault] = true;
        ++loanCount;

        LoanShares(shares).initialize(escrow, p.loanCode);
        CollectionVault(vault).initialize(
            p, escrow, shares, IRegistry(registry), IGuardian(guardian), IAIUSDGateway(gateway)
        );
        LoanEscrow(escrow).initialize(
            p, IRegistry(registry), IGuardian(guardian), IAIUSDGateway(gateway), vault, shares
        );

        emit LoanCreated(p.loanCode, escrow, vault, shares, keccak256(abi.encode(p)));
    }

    function loanOf(bytes32 loanCode) external view returns (address escrow, address vault, address shares) {
        Loan memory l = _loans[loanCode];
        return (l.escrow, l.vault, l.shares);
    }

    function isLoanContract(address account) external view returns (bool) {
        return _loanContracts[account];
    }

    function _validate(LoanParams calldata p) private view {
        if (p.loanCode == bytes32(0)) revert InvalidParams("loanCode");
        if (p.principal == 0) revert InvalidParams("principal");
        if (p.minSubscription == 0 || p.minSubscription > p.principal) revert InvalidParams("minSubscription");
        if (p.maxSubscribers == 0) revert InvalidParams("maxSubscribers");
        if (p.subscriptionDeadline <= block.timestamp || p.releaseDeadline <= p.subscriptionDeadline) {
            revert InvalidParams("deadlines");
        }
        for (uint256 i; i < CONDITION_COUNT - 1; ++i) {
            _validateCondition(p.conditions[i]);
        }
        if (p.gpuCount == 0) revert InvalidParams("gpuCount");
        if (p.maxLtvBps == 0 || p.maxLtvBps > MAX_LTV_BPS) revert InvalidParams("maxLtvBps");
        if (p.spvWallet == address(0) || p.operatorWallet == address(0) || p.feeRecipient == address(0)) {
            revert InvalidParams("wallets");
        }
        if (p.feeBps > 10_000) revert InvalidParams("feeBps");
        if (p.cureCoverageBps == 0 || p.curePeriod == 0) revert InvalidParams("cure");
        _validateSchedule(p.schedule, p.principal, p.reserveMonths);
    }

    function _validateCondition(ConditionSpec calldata c) private view {
        uint256 n = c.signers.length;
        if (c.threshold == 0 || c.threshold > n) revert InvalidParams("threshold");
        for (uint256 j; j < n; ++j) {
            (bool active,) = IRegistry(registry).signerOf(c.signers[j]);
            if (!active) revert InvalidParams("signer");
            for (uint256 k; k < j; ++k) {
                if (c.signers[k] == c.signers[j]) revert InvalidParams("duplicate signer");
            }
        }
    }

    function _validateSchedule(RepaymentSchedule calldata s, uint256 principal, uint8 reserveMonths) private pure {
        uint256 periods = s.principalDue.length;
        if (periods == 0 || periods > MAX_PERIODS || s.interestDue.length != periods) revert InvalidParams("schedule");
        if (s.periodLength == 0) revert InvalidParams("periodLength");
        if (reserveMonths > periods) revert InvalidParams("reserveMonths");

        uint256 sum;
        uint256 reserve;
        for (uint256 i; i < periods; ++i) {
            sum += s.principalDue[i];
            if (i < reserveMonths) reserve += s.principalDue[i] + s.interestDue[i];
        }
        if (sum != principal) revert InvalidParams("schedule principal");
        if (reserve >= principal) revert InvalidParams("reserve");
    }
}
