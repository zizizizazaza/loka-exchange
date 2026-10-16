// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @title Guardian
/// @notice Lets the multisig pause entry points after a contract bug, an attack or a USDC depeg
///         (PRD 4.6.5 #19, #20). One per deployment.
/// @dev Pausing only blocks entry points: subscribing, releasing, minting and redeeming.
///      No function can use a pause to move funds out of any contract.
///      Refund claims and holder claims are not affected by pauses.
///      The maximum pause duration is still open (PRD 3.5 #12); add maxPauseDuration once decided.
interface IGuardian {
    event Paused(uint8 scopes, bytes32 reasonHash);
    event Unpaused(uint8 scopes);

    error NotMultisig(address caller);

    /// @param scopes PAUSE_* constants combined as bit flags
    function pause(uint8 scopes, bytes32 reasonHash) external;

    function unpause(uint8 scopes) external;

    /// @param scope A single PAUSE_* constant
    function isPaused(uint8 scope) external view returns (bool);

    /// @notice Operations multisig (Safe). Other contracts use it to check multisig permissions.
    function multisig() external view returns (address);
}
