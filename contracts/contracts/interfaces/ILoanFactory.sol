// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {LoanParams} from "../types/LoanTypes.sol";

/// @title Loan factory
/// @notice Deploys each loan's escrow, collection vault and shares, with parameters fixed at deployment.
///         One per deployment.
/// @dev Only the operations multisig can call createLoan. The three contracts are minimal proxies (EIP-1167)
///      and are not upgradeable.
interface ILoanFactory {
    event LoanCreated(bytes32 indexed loanCode, address escrow, address vault, address shares, bytes32 paramsHash);

    error NotMultisig(address caller);
    error LoanCodeTaken(bytes32 loanCode);
    /// @param reason Which check failed; see createLoan
    error InvalidParams(string reason);

    /// @notice Lists a loan (PRD 4.4 step 1, item 4).
    /// @dev Checks before deploying:
    ///      - principal > 0; minSubscription <= principal; maxSubscribers > 0
    ///      - now < subscriptionDeadline < releaseDeadline
    ///      - for each condition, 0 < threshold <= signers.length, and every signer is active in the Registry
    ///      - maxLtvBps <= 8000
    ///      - schedule: three arrays of equal length, 1 to 36 periods, principal sums to principal, periodLength > 0
    ///      - reserveMonths <= number of periods
    ///      - spvWallet, operatorWallet and feeRecipient are non-zero
    function createLoan(LoanParams calldata p) external returns (address escrow, address vault, address shares);

    function loanOf(bytes32 loanCode) external view returns (address escrow, address vault, address shares);

    /// @notice Lets the gateway check whether the caller is an escrow or vault deployed by this factory.
    function isLoanContract(address account) external view returns (bool);

    function loanCount() external view returns (uint256);

    function registry() external view returns (address);

    function gateway() external view returns (address);

    function guardian() external view returns (address);
}
