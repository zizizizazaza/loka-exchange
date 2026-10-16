// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import {ILoanShares} from "./interfaces/ILoanShares.sol";

/// @title Loan shares
/// @notice Non-transferable shares of one loan. Deployed as a minimal proxy by the factory. See ILoanShares.
contract LoanShares is ILoanShares, ERC20, Initializable {
    address public escrow;

    string private _shareName;
    string private _shareSymbol;

    /// @dev The implementation is never used directly; clones get their name and symbol in initialize.
    constructor() ERC20("", "") {
        _disableInitializers();
    }

    function initialize(address escrow_, bytes32 loanCode) external initializer {
        escrow = escrow_;
        string memory code = _toString(loanCode);
        _shareName = string.concat("Loka Loan ", code);
        _shareSymbol = code;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != escrow) revert NotEscrow(msg.sender);
        _mint(to, amount);
    }

    function name() public view override(ERC20, IERC20Metadata) returns (string memory) {
        return _shareName;
    }

    function symbol() public view override(ERC20, IERC20Metadata) returns (string memory) {
        return _shareSymbol;
    }

    function decimals() public pure override(ERC20, IERC20Metadata) returns (uint8) {
        return 6;
    }

    /// @dev Only minting (from zero) and burning (to zero) are allowed.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) revert NonTransferable();
        super._update(from, to, value);
    }

    function _toString(bytes32 b) private pure returns (string memory) {
        uint256 len;
        while (len < 32 && b[len] != 0) ++len;
        bytes memory out = new bytes(len);
        for (uint256 i; i < len; ++i) out[i] = b[i];
        return string(out);
    }
}
