// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {AIUSD} from "../../contracts/AIUSD.sol";
import {AIUSDGateway} from "../../contracts/AIUSDGateway.sol";
import {CollectionVault} from "../../contracts/CollectionVault.sol";
import {Guardian} from "../../contracts/Guardian.sol";
import {IAIUSDGateway} from "../../contracts/interfaces/IAIUSDGateway.sol";
import {ILoanEscrow} from "../../contracts/interfaces/ILoanEscrow.sol";
import {ILoanFactory} from "../../contracts/interfaces/ILoanFactory.sol";
import {ILoanShares} from "../../contracts/interfaces/ILoanShares.sol";
import {LoanEscrow} from "../../contracts/LoanEscrow.sol";
import {LoanFactory} from "../../contracts/LoanFactory.sol";
import {LoanShares} from "../../contracts/LoanShares.sol";
import {MockUSDC} from "../../contracts/mocks/MockUSDC.sol";
import {Registry} from "../../contracts/Registry.sol";
import "../../contracts/types/LoanTypes.sol";

/// @dev Deploys the whole system and lists one loan (NH200-1). Shared by the escrow and vault tests.
abstract contract LoanTestBase is Test {
    address rentChannel = makeAddr("rentChannel");

    uint256 constant PRINCIPAL = 1_000_000e6;
    uint256 constant MIN_SUB = 100_000e6;
    uint256 constant PERIODS = 10;
    uint256 constant PRINCIPAL_PER_PERIOD = 100_000e6;
    uint256 constant INTEREST_PER_PERIOD = 9_000e6;
    uint256 constant RESERVE = 3 * (PRINCIPAL_PER_PERIOD + INTEREST_PER_PERIOD);
    uint32 constant GPUS = 256;

    address multisig = makeAddr("multisig");
    address compliance = makeAddr("compliance");
    address spv = makeAddr("spv");
    address operatorWallet = makeAddr("operatorWallet");
    address feeRecipient = makeAddr("feeRecipient");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    address outsider = makeAddr("outsider");

    // Condition signers
    address corp;
    uint256 corpKey;
    address lienAgent;
    uint256 lienKey;
    address buyer;
    uint256 buyerKey;
    address operator;
    uint256 operatorKey;
    address platform;
    uint256 platformKey;
    address node1;
    uint256 node1Key;
    address node2;
    uint256 node2Key;
    address appraiser;
    uint256 appraiserKey;

    MockUSDC usdc;
    Guardian guardian;
    Registry registry;
    AIUSDGateway gateway;
    AIUSD aiusd;
    LoanFactory factory;

    LoanEscrow escrow;
    CollectionVault vault;
    LoanShares shares;

    function setUp() public virtual {
        (corp, corpKey) = makeAddrAndKey("corp");
        (lienAgent, lienKey) = makeAddrAndKey("lienAgent");
        (buyer, buyerKey) = makeAddrAndKey("buyer");
        (operator, operatorKey) = makeAddrAndKey("operator");
        (platform, platformKey) = makeAddrAndKey("platform");
        (node1, node1Key) = makeAddrAndKey("node1");
        (node2, node2Key) = makeAddrAndKey("node2");
        (appraiser, appraiserKey) = makeAddrAndKey("appraiser");

        usdc = new MockUSDC();
        guardian = new Guardian(multisig);
        registry = new Registry(guardian, compliance);
        gateway = new AIUSDGateway(usdc, registry, guardian);
        aiusd = gateway.aiusdToken();
        factory = new LoanFactory(
            address(registry),
            address(gateway),
            address(guardian),
            address(new LoanEscrow()),
            address(new CollectionVault()),
            address(new LoanShares())
        );

        vm.startPrank(multisig);
        gateway.setFactory(factory);
        registry.setSigner(corp, SIGNER_CORPORATE_SERVICES, true);
        registry.setSigner(lienAgent, SIGNER_LIEN_AGENT, true);
        registry.setSigner(buyer, SIGNER_BUYER, true);
        registry.setSigner(operator, SIGNER_OPERATOR, true);
        registry.setSigner(platform, SIGNER_PLATFORM, true);
        registry.setSigner(node1, SIGNER_MONITORING_NODE, true);
        registry.setSigner(node2, SIGNER_MONITORING_NODE, true);
        registry.setSigner(appraiser, SIGNER_APPRAISER, true);
        vm.stopPrank();

        _onboard(alice, 2_000_000e6);
        _onboard(bob, 2_000_000e6);
        _onboard(carol, 2_000_000e6);

        vm.prank(multisig);
        (address e, address v, address s) = factory.createLoan(_params());
        escrow = LoanEscrow(e);
        vault = CollectionVault(v);
        shares = LoanShares(s);

        // A rent channel that turns the buyer's rent into AIUSD and deposits it into the vault.
        vm.prank(multisig);
        registry.setRentChannel(rentChannel, true);
        usdc.mint(rentChannel, 100_000_000e6);
        vm.startPrank(rentChannel);
        usdc.approve(address(gateway), type(uint256).max);
        gateway.mint(100_000_000e6);
        aiusd.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }


    /* ---------- Helpers ---------- */

    function _onboard(address investor, uint256 amount) internal {
        vm.prank(compliance);
        registry.addInvestor(investor, keccak256(abi.encode(investor)));
        usdc.mint(investor, amount);
        vm.startPrank(investor);
        usdc.approve(address(gateway), amount);
        gateway.mint(amount);
        vm.stopPrank();
    }

    function _subscribe(address investor, uint256 amount) internal {
        vm.startPrank(investor);
        aiusd.approve(address(escrow), amount);
        escrow.subscribe(amount);
        vm.stopPrank();
    }

    function _fillAndAttest() internal {
        _subscribe(alice, 600_000e6);
        _subscribe(bob, 400_000e6);
        _attestAll();
    }

    function _attestAll() internal {
        Attestation memory a;
        bytes[] memory sigs;

        a = _attestation(COND_SPV_AND_PLEDGE, 0);
        sigs = new bytes[](2);
        sigs[0] = _sign(corpKey, a);
        sigs[1] = _sign(operatorKey, a);
        escrow.attest(a, sigs);

        _attestLien();

        a = _attestation(COND_RENT_ROUTED, 0);
        sigs = new bytes[](3);
        sigs[0] = _sign(buyerKey, a);
        sigs[1] = _sign(operatorKey, a);
        sigs[2] = _sign(platformKey, a);
        escrow.attest(a, sigs);

        a = _attestation(COND_EQUIPMENT_ONLINE, GPUS);
        sigs = new bytes[](2);
        sigs[0] = _sign(node1Key, a);
        sigs[1] = _sign(node2Key, a);
        escrow.attest(a, sigs);

        a = _attestation(COND_APPRAISAL, 1_300_000e6);
        sigs = new bytes[](1);
        sigs[0] = _sign(appraiserKey, a);
        escrow.attest(a, sigs);
    }

    function _attestLien() internal {
        Attestation memory a = _attestation(COND_LIEN_FILED, 0);
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = _sign(lienKey, a);
        escrow.attest(a, sigs);
    }

    function _attestation(uint8 conditionId, uint256 amount) internal view returns (Attestation memory) {
        return Attestation({
            conditionId: conditionId,
            docHash: keccak256(abi.encode("doc", conditionId)),
            refNo: bytes32("REF-001"),
            amount: amount,
            deadline: uint64(block.timestamp + 7 days)
        });
    }

    function _sign(uint256 key, Attestation memory a) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, escrow.hashAttestation(a));
        return abi.encodePacked(r, s, v);
    }

    function _params() internal view returns (LoanParams memory p) {
        p.loanCode = "NH200-1";
        p.termsHash = keccak256("term sheet");
        p.principal = PRINCIPAL;
        p.minSubscription = MIN_SUB;
        p.maxSubscribers = 20;
        p.subscriptionDeadline = uint64(block.timestamp + 30 days);
        p.releaseDeadline = uint64(block.timestamp + 72 days);

        p.conditions[0] = _spec2(corp, operator, 2);
        p.conditions[1] = _spec1(lienAgent);
        address[] memory rent = new address[](3);
        rent[0] = buyer;
        rent[1] = operator;
        rent[2] = platform;
        p.conditions[2] = ConditionSpec(rent, 3);
        p.conditions[3] = _spec2(node1, node2, 2);
        p.conditions[4] = _spec1(appraiser);

        p.gpuCount = GPUS;
        p.maxLtvBps = 8000;
        p.spvWallet = spv;
        p.operatorWallet = operatorWallet;
        p.feeRecipient = feeRecipient;
        p.feeBps = 200;
        p.rateBps = 1100;

        p.schedule.periodLength = 30 days;
        p.schedule.principalDue = new uint256[](PERIODS);
        p.schedule.interestDue = new uint256[](PERIODS);
        for (uint256 i; i < PERIODS; ++i) {
            p.schedule.principalDue[i] = PRINCIPAL_PER_PERIOD;
            p.schedule.interestDue[i] = INTEREST_PER_PERIOD;
        }
        p.reserveMonths = 3;
        p.cureCoverageBps = 11_500;
        p.curePeriod = 30 days;
        p.prepayFeeBps = 100;
        p.prepayLockup = 180 days;
    }

    function _spec1(address a) internal pure returns (ConditionSpec memory) {
        address[] memory s = new address[](1);
        s[0] = a;
        return ConditionSpec(s, 1);
    }

    function _spec2(address a, address b, uint8 threshold) internal pure returns (ConditionSpec memory) {
        address[] memory s = new address[](2);
        s[0] = a;
        s[1] = b;
        return ConditionSpec(s, threshold);
    }

    function _release() internal {
        _fillAndAttest();
        escrow.release();
    }

    function _payRent(uint256 amount) internal {
        vm.prank(rentChannel);
        vault.depositRent(amount);
    }

    function _settleAt(uint32 period) internal {
        vm.warp(vault.dueDate(period));
        vault.settle();
    }
}
