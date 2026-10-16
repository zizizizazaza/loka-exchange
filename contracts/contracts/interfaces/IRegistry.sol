// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @title Registry
/// @notice Records which wallets are KYB-verified institutions, which are trusted signers and which are rent channels.
///         One per deployment.
/// @dev Permissions:
///      - add and remove investors: compliance key (backend KMS), only when KYB passes or lapses
///      - freeze, unfreeze, signer and rent channel changes: operations multisig
///      Nothing here can move funds.
interface IRegistry {
    event InvestorAdded(address indexed wallet, bytes32 kybRef);
    event InvestorRemoved(address indexed wallet, bytes32 reasonHash);
    event InvestorFrozen(address indexed wallet, bytes32 reasonHash);
    event InvestorUnfrozen(address indexed wallet);
    event SignerSet(address indexed signer, bytes32 indexed role, bool active);
    event RentChannelSet(address indexed channel, bool active);

    error NotCompliance(address caller);
    error NotMultisig(address caller);

    /// @notice Whitelists an institution's wallet after KYB passes.
    /// @param kybRef Hash of the KYB provider's case id, for reconciliation
    function addInvestor(address wallet, bytes32 kybRef) external;

    /// @notice Removes an investor whose verification lapsed. They can no longer subscribe or deposit,
    ///         but can still claim what they are owed.
    function removeInvestor(address wallet, bytes32 reasonHash) external;

    /// @notice Freezes an investor whose verification lapsed or who hit a sanctions list (PRD 4.6.5 #21).
    ///         A frozen investor cannot subscribe, deposit, withdraw or claim; amounts owed keep accruing.
    function freezeInvestor(address wallet, bytes32 reasonHash) external;

    function unfreezeInvestor(address wallet) external;

    /// @notice Registers or deactivates a signer. Roles are the SIGNER_* constants in LoanTypes.
    /// @dev Condition signers of listed loans are fixed in their LoanParams; deactivating here only affects new loans.
    function setSigner(address signer, bytes32 role, bool active) external;

    /// @notice Registers a rent channel: an address that converts the buyer's USD rent to AIUSD and deposits it
    ///         into the collection vault. The approach is still open (PRD 3.5 #1).
    function setRentChannel(address channel, bool active) external;

    /// @return True if whitelisted and not frozen
    function isInvestor(address wallet) external view returns (bool);

    function isFrozen(address wallet) external view returns (bool);

    /// @return active Whether the signer is active
    /// @return role The signer's role
    function signerOf(address signer) external view returns (bool active, bytes32 role);

    function isRentChannel(address channel) external view returns (bool);
}
