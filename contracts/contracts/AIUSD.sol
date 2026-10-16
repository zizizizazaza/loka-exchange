// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title AIUSD (test issuance)
/// @notice 1:1 USD unit used for all prices and balances on Loka. Only the gateway can mint and burn.
/// @dev Who issues AIUSD in production is still open (PRD 3.5 #2). This token is for testnet and is
///      replaced together with the gateway once that is decided.
contract AIUSD is ERC20 {
    address public immutable gateway;

    error NotGateway(address caller);

    constructor(address gateway_) ERC20("AIUSD", "AIUSD") {
        gateway = gateway_;
    }

    modifier onlyGateway() {
        if (msg.sender != gateway) revert NotGateway(msg.sender);
        _;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyGateway {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyGateway {
        _burn(from, amount);
    }
}
