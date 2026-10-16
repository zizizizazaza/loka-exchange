// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title Loan shares
/// @notice One per loan. Minted 1:1 to subscribers at release; the collection vault pays out pro rata to shares.
/// @dev Not transferable in v1 (PRD 4.1): transfer and transferFrom always revert.
///      Whether shares can be transferred, and to whom, depends on the legal opinion (PRD 3.5 #2);
///      v2 may add whitelisted transfers.
interface ILoanShares is IERC20Metadata {
    error NonTransferable();
    error NotEscrow(address caller);

    /// @notice Only this loan's escrow can call it, and only at release.
    function mint(address to, uint256 amount) external;

    function escrow() external view returns (address);
}
