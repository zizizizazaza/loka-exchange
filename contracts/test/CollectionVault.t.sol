// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {ICollectionVault} from "../contracts/interfaces/ICollectionVault.sol";
import "../contracts/types/LoanTypes.sol";
import {LoanTestBase} from "./utils/LoanTestBase.sol";

/// @dev Loan used throughout: 1,000,000 principal, 10 periods of 100,000 principal + 9,000 interest
///      (109,000 a period), reserve 3 x 109,000 = 327,000, fee 2% of rent. Alice holds 60%, Bob 40%.
contract CollectionVaultTest is LoanTestBase {
    uint256 constant SCHEDULED = PRINCIPAL_PER_PERIOD + INTEREST_PER_PERIOD; // 109,000

    function setUp() public override {
        super.setUp();
        _release();
    }

    /* ---------- Normal repayment ---------- */

    function test_WaterfallInNormalPeriod() public {
        _payRent(150_000e6);
        vm.warp(vault.dueDate(1));
        vm.expectEmit(address(vault));
        // owed 109,000; paid 109,000; nothing from reserve; fee 2% x 150,000 = 3,000; operator 38,000
        emit ICollectionVault.PeriodSettled(1, 150_000e6, SCHEDULED, SCHEDULED, 0, 0, 3_000e6, 38_000e6, 13_761);
        vault.settle();

        assertEq(aiusd.balanceOf(feeRecipient), 3_000e6);
        assertEq(vault.operatorClaimable(), 38_000e6);
        assertEq(vault.claimable(alice), 65_400e6); // 60% of 109,000
        assertEq(vault.claimable(bob), 43_600e6);
        assertEq(vault.outstandingPrincipal(), PRINCIPAL - PRINCIPAL_PER_PERIOD);
        assertEq(uint8(vault.state()), uint8(VaultState.Repaying));

        vm.prank(alice);
        vault.claim();
        assertEq(aiusd.balanceOf(alice), 2_000_000e6 - 600_000e6 + 65_400e6);

        vault.payOperator();
        assertEq(usdc.balanceOf(operatorWallet), 38_000e6, "operator is paid in USDC");
        _assertBooksBalance();
    }

    function test_RunsToMaturity() public {
        // 130,000 rent against a 109,000 payment is 1.19x, above the 1.15x cure line.
        for (uint32 k = 1; k <= PERIODS; ++k) {
            _payRent(130_000e6);
            _settleAt(k);
        }
        assertEq(uint8(vault.state()), uint8(VaultState.Matured));
        assertEq(vault.outstandingPrincipal(), 0);
        assertEq(vault.totalCredited(), PERIODS * SCHEDULED);
        assertEq(vault.claimable(alice), PERIODS * SCHEDULED * 60 / 100);
        // Each period: 130,000 - 109,000 - 2,600 fee = 18,400 to the operator, plus the reserve back at the end.
        assertEq(vault.operatorClaimable(), PERIODS * 18_400e6 + RESERVE);

        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.WrongState.selector, VaultState.Matured));
        vault.settle();
        _assertBooksBalance();
    }

    function test_RevertWhen_NotDueYet() public {
        uint64 due = vault.dueDate(1);
        vm.warp(due - 1);
        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.NotDueYet.selector, uint32(1), due));
        vault.settle();
    }

    function test_LateKeeperSettlesPeriodsInOrder() public {
        _payRent(240_000e6); // two periods of rent arrive before anyone settles
        vm.warp(vault.dueDate(2));
        vault.settle();
        vault.settle();
        assertEq(vault.settledPeriods(), 2);
        // All rent lands in period 1; period 2 is covered by the reserve, then period 2 starts the cure.
        assertEq(uint8(vault.state()), uint8(VaultState.Cure));
    }

    /* ---------- Shortfall, cure and default ---------- */

    function test_MissedRentUsesReserveAndStartsCure() public {
        _settleAt(1); // no rent at all

        assertEq(vault.reserveBalance(), RESERVE - SCHEDULED, "reserve paid this period");
        assertEq(vault.claimable(alice) + vault.claimable(bob), SCHEDULED, "holders still paid in full");
        assertEq(vault.arrears(), 0);
        assertEq(vault.lastCoverageBps(), 0);
        assertEq(uint8(vault.state()), uint8(VaultState.Cure));
        assertEq(vault.cureDeadline(), uint64(block.timestamp) + 30 days);
        assertEq(aiusd.balanceOf(feeRecipient), 0, "no fee while holders depend on the reserve");
    }

    function test_CureSucceedsWhenRentRecovers() public {
        _settleAt(1); // missed

        // Next period: 109,000 to holders, 109,000 to refill the reserve, 5,000 fee, 27,000 left.
        _payRent(250_000e6);
        _settleAt(2);

        assertEq(uint8(vault.state()), uint8(VaultState.Repaying));
        assertEq(vault.reserveBalance(), RESERVE);
        assertEq(vault.heldSurplus(), 0);
        assertEq(vault.operatorClaimable(), 27_000e6, "surplus held during cure is released on cure");
        assertEq(vault.cureDeadline(), 0);
        _assertBooksBalance();
    }

    function test_SurplusIsHeldWhileCureContinues() public {
        _settleAt(1); // missed: reserve down to 218,000

        // Coverage 1.10x: holders paid, reserve partly refilled, still below the cure line.
        _payRent(119_900e6);
        _settleAt(2);
        assertEq(uint8(vault.state()), uint8(VaultState.Cure));
        assertEq(vault.reserveBalance(), RESERVE - SCHEDULED + 10_900e6);
        assertEq(vault.operatorClaimable(), 0);
        _assertBooksBalance();
    }

    function test_CureFailsAndDefaultsAutomatically() public {
        _settleAt(1); // missed
        uint64 deadline = vault.cureDeadline();

        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.CureNotOver.selector, deadline));
        vault.checkCure();

        vm.warp(deadline + 1);
        vault.checkCure();
        assertEq(uint8(vault.state()), uint8(VaultState.Default));
        assertEq(vault.reserveBalance(), 0, "reserve paid out to holders at default");
        assertEq(vault.totalCredited(), RESERVE, "period 1 from the reserve, then the rest of the reserve");

        // Holders are owed the unpaid principal plus interest accrued since the last due date, minus what the
        // reserve already covered.
        uint256 claimLeft = vault.defaultClaim();
        assertGt(claimLeft, 0);
        assertLt(claimLeft, PRINCIPAL);
        _assertBooksBalance();
    }

    function test_RecoveryPaysHoldersFirstThenOperator() public {
        _settleAt(1);
        vm.warp(vault.cureDeadline() + 1);
        vault.checkCure();

        uint256 claimLeft = vault.defaultClaim();
        address recoverer = rentChannel;
        vm.prank(recoverer);
        vault.depositRecovery(claimLeft + 50_000e6, keccak256("sale receipt"));

        assertEq(vault.defaultClaim(), 0, "holders paid in full");
        assertEq(vault.operatorClaimable(), 50_000e6, "only the excess goes to the operator");
        _assertBooksBalance();
    }

    function test_RecoveryShortfallIsSharedProRata() public {
        _settleAt(1);
        vm.warp(vault.cureDeadline() + 1);
        vault.checkCure();

        uint256 before = vault.claimable(alice) + vault.claimable(bob);
        vm.prank(rentChannel);
        vault.depositRecovery(100_000e6, keccak256("partial sale"));

        assertEq(vault.claimable(alice) + vault.claimable(bob) - before, 100_000e6);
        assertApproxEqAbs(vault.claimable(alice) * 2, vault.claimable(bob) * 3, 5, "60/40 split");
        assertEq(vault.operatorClaimable(), 0);
        assertGt(vault.defaultClaim(), 0, "holders bear the remaining loss");
    }

    function test_MultisigDeclaresDefault() public {
        _payRent(150_000e6);
        _settleAt(1);

        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.NotMultisig.selector, outsider));
        vault.declareDefault(bytes32("offline"));

        vm.prank(multisig);
        vault.declareDefault(bytes32("offline"));
        assertEq(uint8(vault.state()), uint8(VaultState.Default));

        // Rent arriving after default goes straight to holders.
        uint256 before = vault.totalCredited();
        _payRent(10_000e6);
        assertEq(vault.totalCredited() - before, 10_000e6);

        vm.prank(multisig);
        vault.recordDisposition(keccak256("SPV takeover"), bytes32("step 1"));
    }

    /* ---------- Prepayment ---------- */

    function test_OperatorPrepays() public {
        for (uint32 k = 1; k <= 6; ++k) {
            _payRent(130_000e6);
            _settleAt(k);
        }
        assertEq(uint8(vault.state()), uint8(VaultState.Repaying));
        _fundOperator(500_000e6);

        // 400,000 principal + 9,000 next interest + 1% fee on principal (4,000) = 413,000
        uint256 creditedBefore = vault.totalCredited();
        vm.prank(operatorWallet);
        vault.prepay();

        assertEq(vault.totalCredited() - creditedBefore, 413_000e6);
        assertEq(vault.outstandingPrincipal(), 0);
        assertEq(uint8(vault.state()), uint8(VaultState.Matured));
        _assertBooksBalance();
    }

    function test_RevertWhen_PrepayTooEarly() public {
        _fundOperator(1_000_000e6);
        uint64 allowedFrom = vault.releasedAt() + 180 days;
        vm.prank(operatorWallet);
        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.PrepayLocked.selector, allowedFrom));
        vault.prepay();
    }

    function test_RevertWhen_OutsiderPrepays() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.NotOperator.selector, outsider));
        vault.prepay();
    }

    /* ---------- Holders ---------- */

    function test_FrozenHolderCannotClaimButKeepsAccruing() public {
        _payRent(150_000e6);
        _settleAt(1);
        vm.prank(multisig);
        registry.freezeInvestor(alice, bytes32("sanctions"));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.HolderFrozen.selector, alice));
        vault.claim();

        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        vault.claimFor(list);
        assertEq(vault.claimable(alice), 65_400e6, "frozen holder skipped, amount kept");
        assertEq(vault.claimable(bob), 0);

        _payRent(150_000e6);
        _settleAt(2);
        assertEq(vault.claimable(alice), 2 * 65_400e6);
    }

    function test_RevertWhen_NothingToClaim() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.NothingToClaim.selector, alice));
        vault.claim();
    }

    /* ---------- Uptime ---------- */

    function test_RecordUptime() public {
        UptimeReport memory r = UptimeReport({
            period: 1, uptimeBps: 9_950, gpusOnline: GPUS, dataHash: keccak256("metrics"), deadline: uint64(block.timestamp + 1 days)
        });
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _signUptime(node1Key, r);

        vm.expectRevert(abi.encodeWithSelector(ICollectionVault.NotEnoughSignatures.selector, 1, 2));
        vault.recordUptime(r, sigs);

        sigs[1] = _signUptime(node2Key, r);
        vm.expectEmit(address(vault));
        emit ICollectionVault.UptimeRecorded(1, 9_950, GPUS, keccak256("metrics"));
        vault.recordUptime(r, sigs);
    }

    /* ---------- Fuzz: the books always balance ---------- */

    /// @dev Random rent each period, with the keeper also resolving cures. Whatever happens, the vault's AIUSD
    ///      must equal what it owes: unsettled rent, reserve, held surplus, operator credit and holder credit.
    function testFuzz_BooksAlwaysBalance(uint64[10] memory rents, uint64 recovery) public {
        for (uint32 k = 1; k <= PERIODS; ++k) {
            if (vault.state() != VaultState.Repaying && vault.state() != VaultState.Cure) break;
            uint256 rent = bound(uint256(rents[k - 1]), 0, 300_000e6);
            if (rent > 0) _payRent(rent);
            _settleAt(k);
            if (vault.state() == VaultState.Cure && block.timestamp > vault.cureDeadline()) vault.checkCure();
            _assertBooksBalance();
        }
        if (vault.state() == VaultState.Cure) {
            vm.warp(vault.cureDeadline() + 1);
            vault.checkCure();
        }
        if (vault.state() == VaultState.Default) {
            vm.prank(rentChannel);
            vault.depositRecovery(bound(uint256(recovery), 1, 2_000_000e6), bytes32(0));
        }
        _assertBooksBalance();

        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        vault.claimFor(list);
        _assertBooksBalance();
    }

    /* ---------- Helpers ---------- */

    function _assertBooksBalance() internal view {
        uint256 owed = vault.rentPool() + vault.reserveBalance() + vault.heldSurplus() + vault.operatorClaimable()
            + vault.totalCredited() - vault.totalClaimed();
        assertEq(aiusd.balanceOf(address(vault)), owed, "vault AIUSD equals what it owes");
        assertLe(vault.claimable(alice) + vault.claimable(bob), vault.totalCredited() - vault.totalClaimed());
    }

    /// @dev The operator needs AIUSD to prepay; registering its wallet as a rent channel lets it mint.
    function _fundOperator(uint256 amount) internal {
        vm.prank(multisig);
        registry.setRentChannel(operatorWallet, true);
        usdc.mint(operatorWallet, amount);
        vm.startPrank(operatorWallet);
        usdc.approve(address(gateway), amount);
        gateway.mint(amount);
        aiusd.approve(address(vault), amount);
        vm.stopPrank();
    }

    function _signUptime(uint256 key, UptimeReport memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(key, vault.hashUptimeReport(r));
        return abi.encodePacked(rr, s, v);
    }
}
