// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title Signer set checks
/// @notice Shared by the escrow (release conditions) and the vault (uptime reports).
library SignerSet {
    /// @dev Returns the signers whose signature over `digest` is valid. signatures[i] belongs to signers[i] and is
    ///      empty if that signer did not sign; the caller checks that the lengths match. Accepts EOA (ECDSA) and
    ///      contract wallet (ERC-1271) signatures. The factory rejects duplicate signers, so each address counts once.
    function validSigners(address[] storage signers, bytes32 digest, bytes[] calldata signatures)
        internal
        view
        returns (address[] memory signed)
    {
        uint256 n = signers.length;
        signed = new address[](n);
        uint256 valid;
        for (uint256 i; i < n; ++i) {
            if (signatures[i].length == 0) continue;
            address signer = signers[i];
            if (SignatureChecker.isValidSignatureNow(signer, digest, signatures[i])) signed[valid++] = signer;
        }
        assembly ("memory-safe") {
            mstore(signed, valid)
        }
    }

    function contains(address[] storage signers, address account) internal view returns (bool) {
        for (uint256 i; i < signers.length; ++i) {
            if (signers[i] == account) return true;
        }
        return false;
    }
}
