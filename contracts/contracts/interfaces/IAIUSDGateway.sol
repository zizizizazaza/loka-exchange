// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

/// @title AIUSD gateway
/// @notice Swaps USDC and AIUSD 1:1 (PRD 4.2, 4.5.7). The platform charges no fee. One per deployment.
/// @dev Who issues AIUSD is still open (PRD 3.5 #2). The gateway only exposes this interface; testnet uses our own
///      test AIUSD, and switching to the final issuance setup will not require changes to the escrow or vault.
///
///      Who can mint: verified institutions in the Registry, and registered rent channels.
///      Who can redeem, and to where:
///      - verified institutions: only to their own registered addresses, after the activation delay
///      - loan contracts (escrows and vaults deployed by the factory): to the SPV or operator wallet
///        fixed in their LoanParams
interface IAIUSDGateway {
    event Minted(address indexed account, uint256 amount);
    event Redeemed(address indexed account, address indexed to, uint256 amount);
    event AddressRegistered(address indexed account, address indexed to, uint64 activeFrom);
    event AddressRemoved(address indexed account, address indexed to);

    error NotAllowedToMint(address caller);
    error NotAllowedToRedeem(address caller);
    error AddressNotActive(address account, address to);
    error Paused();

    /// @notice Takes USDC from the caller and mints the same amount of AIUSD to them.
    function mint(uint256 amount) external;

    /// @notice Burns AIUSD from the caller and sends the same amount of USDC to `to`.
    function redeem(uint256 amount, address to) external;

    /// @notice Registers a withdrawal address. It becomes usable after ADDRESS_DELAY (example: 24 hours).
    function registerAddress(address to) external;

    function removeAddress(address to) external;

    /// @return active Whether the account can withdraw to this address now
    /// @return activeFrom When it becomes usable; zero if not registered
    function withdrawalAddress(address account, address to) external view returns (bool active, uint64 activeFrom);

    function ADDRESS_DELAY() external view returns (uint64);

    function aiusd() external view returns (address);

    function usdc() external view returns (address);
}
