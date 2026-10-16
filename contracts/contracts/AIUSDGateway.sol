// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

import {AIUSD} from "./AIUSD.sol";
import {IAIUSDGateway} from "./interfaces/IAIUSDGateway.sol";
import {IGuardian} from "./interfaces/IGuardian.sol";
import {ILoanFactory} from "./interfaces/ILoanFactory.sol";
import {IRegistry} from "./interfaces/IRegistry.sol";
import {PAUSE_MINT, PAUSE_REDEEM} from "./types/LoanTypes.sol";

/// @title AIUSD gateway
/// @notice Swaps USDC and AIUSD 1:1 and keeps the USDC backing. See IAIUSDGateway.
contract AIUSDGateway is IAIUSDGateway, ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    uint64 public constant ADDRESS_DELAY = 24 hours;

    IERC20 public immutable usdcToken;
    AIUSD public immutable aiusdToken;
    IRegistry public immutable registry;
    IGuardian public immutable guardian;

    /// @notice Loan factory, set once after deployment because the factory needs this gateway's address.
    ILoanFactory public factory;

    /// @dev account => withdrawal address => time it becomes usable (0 = not registered)
    mapping(address => mapping(address => uint64)) private _activeFrom;

    event FactorySet(address indexed factory);

    error FactoryAlreadySet();
    error NotMultisig(address caller);
    error ZeroAmount();

    constructor(IERC20 usdc_, IRegistry registry_, IGuardian guardian_) {
        usdcToken = usdc_;
        registry = registry_;
        guardian = guardian_;
        aiusdToken = new AIUSD(address(this));
    }

    /// @notice Sets the loan factory once. Only the multisig.
    function setFactory(ILoanFactory factory_) external {
        if (msg.sender != guardian.multisig()) revert NotMultisig(msg.sender);
        if (address(factory) != address(0)) revert FactoryAlreadySet();
        factory = factory_;
        emit FactorySet(address(factory_));
    }

    function mint(uint256 amount) external nonReentrant {
        if (guardian.isPaused(PAUSE_MINT)) revert Paused();
        if (amount == 0) revert ZeroAmount();
        if (!registry.isInvestor(msg.sender) && !registry.isRentChannel(msg.sender)) {
            revert NotAllowedToMint(msg.sender);
        }
        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        aiusdToken.mint(msg.sender, amount);
        emit Minted(msg.sender, amount);
    }

    function redeem(uint256 amount, address to) external nonReentrant {
        if (guardian.isPaused(PAUSE_REDEEM)) revert Paused();
        if (amount == 0) revert ZeroAmount();
        // Loan contracts only ever redeem to the wallets fixed in their parameters.
        if (!_isLoanContract(msg.sender)) {
            if (!registry.isInvestor(msg.sender)) revert NotAllowedToRedeem(msg.sender);
            (bool active,) = withdrawalAddress(msg.sender, to);
            if (!active) revert AddressNotActive(msg.sender, to);
        }
        aiusdToken.burn(msg.sender, amount);
        usdcToken.safeTransfer(to, amount);
        emit Redeemed(msg.sender, to, amount);
    }

    function registerAddress(address to) external {
        uint64 activeFrom = uint64(block.timestamp) + ADDRESS_DELAY;
        _activeFrom[msg.sender][to] = activeFrom;
        emit AddressRegistered(msg.sender, to, activeFrom);
    }

    function removeAddress(address to) external {
        delete _activeFrom[msg.sender][to];
        emit AddressRemoved(msg.sender, to);
    }

    function withdrawalAddress(address account, address to) public view returns (bool active, uint64 activeFrom) {
        activeFrom = _activeFrom[account][to];
        active = activeFrom != 0 && block.timestamp >= activeFrom;
    }

    function aiusd() external view returns (address) {
        return address(aiusdToken);
    }

    function usdc() external view returns (address) {
        return address(usdcToken);
    }

    function _isLoanContract(address account) private view returns (bool) {
        return address(factory) != address(0) && factory.isLoanContract(account);
    }
}
