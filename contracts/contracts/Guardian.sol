// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IGuardian} from "./interfaces/IGuardian.sol";

/// @title Guardian
/// @notice Holds the operations multisig address and the pause flags. See IGuardian.
contract Guardian is IGuardian {
    address public immutable multisig;

    /// @dev PAUSE_* bit flags currently set.
    uint8 public pausedScopes;

    constructor(address multisig_) {
        multisig = multisig_;
    }

    modifier onlyMultisig() {
        if (msg.sender != multisig) revert NotMultisig(msg.sender);
        _;
    }

    function pause(uint8 scopes, bytes32 reasonHash) external onlyMultisig {
        pausedScopes |= scopes;
        emit Paused(scopes, reasonHash);
    }

    function unpause(uint8 scopes) external onlyMultisig {
        pausedScopes &= ~scopes;
        emit Unpaused(scopes);
    }

    function isPaused(uint8 scope) external view returns (bool) {
        return pausedScopes & scope != 0;
    }
}
