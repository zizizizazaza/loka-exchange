// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IGuardian} from "./interfaces/IGuardian.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";

/// @title Registry
/// @notice Investor whitelist, signer and rent channel registry. See IRegistry.
contract Registry is IRegistry {
    struct Investor {
        bool added;
        bool frozen;
    }

    struct Signer {
        bool active;
        bytes32 role;
    }

    IGuardian public immutable guardian;

    /// @notice Backend compliance key (KMS). Can only add and remove investors.
    address public compliance;

    mapping(address => Investor) private _investors;
    mapping(address => Signer) private _signers;
    mapping(address => bool) private _rentChannels;

    event ComplianceSet(address indexed compliance);

    constructor(IGuardian guardian_, address compliance_) {
        guardian = guardian_;
        compliance = compliance_;
        emit ComplianceSet(compliance_);
    }

    modifier onlyCompliance() {
        if (msg.sender != compliance) revert NotCompliance(msg.sender);
        _;
    }

    modifier onlyMultisig() {
        if (msg.sender != guardian.multisig()) revert NotMultisig(msg.sender);
        _;
    }

    /// @notice Rotates the compliance key. Only the multisig.
    function setCompliance(address compliance_) external onlyMultisig {
        compliance = compliance_;
        emit ComplianceSet(compliance_);
    }

    function addInvestor(address wallet, bytes32 kybRef) external onlyCompliance {
        _investors[wallet].added = true;
        emit InvestorAdded(wallet, kybRef);
    }

    function removeInvestor(address wallet, bytes32 reasonHash) external onlyCompliance {
        _investors[wallet].added = false;
        emit InvestorRemoved(wallet, reasonHash);
    }

    function freezeInvestor(address wallet, bytes32 reasonHash) external onlyMultisig {
        _investors[wallet].frozen = true;
        emit InvestorFrozen(wallet, reasonHash);
    }

    function unfreezeInvestor(address wallet) external onlyMultisig {
        _investors[wallet].frozen = false;
        emit InvestorUnfrozen(wallet);
    }

    function setSigner(address signer, bytes32 role, bool active) external onlyMultisig {
        _signers[signer] = Signer(active, role);
        emit SignerSet(signer, role, active);
    }

    function setRentChannel(address channel, bool active) external onlyMultisig {
        _rentChannels[channel] = active;
        emit RentChannelSet(channel, active);
    }

    function isInvestor(address wallet) external view returns (bool) {
        Investor memory i = _investors[wallet];
        return i.added && !i.frozen;
    }

    function isFrozen(address wallet) external view returns (bool) {
        return _investors[wallet].frozen;
    }

    function signerOf(address signer) external view returns (bool active, bytes32 role) {
        Signer memory s = _signers[signer];
        return (s.active, s.role);
    }

    function isRentChannel(address channel) external view returns (bool) {
        return _rentChannels[channel];
    }
}
