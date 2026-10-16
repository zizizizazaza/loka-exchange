// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IAIUSDGateway} from "../contracts/interfaces/IAIUSDGateway.sol";
import {ILoanEscrow} from "../contracts/interfaces/ILoanEscrow.sol";
import {ILoanFactory} from "../contracts/interfaces/ILoanFactory.sol";
import {ILoanShares} from "../contracts/interfaces/ILoanShares.sol";
import {LoanEscrow} from "../contracts/LoanEscrow.sol";
import {MockContractWallet} from "../contracts/mocks/MockContractWallet.sol";
import "../contracts/types/LoanTypes.sol";
import {LoanTestBase} from "./utils/LoanTestBase.sol";

contract LoanEscrowTest is LoanTestBase {
    /* ---------- Happy path ---------- */

    function test_SubscribeAttestRelease() public {
        _subscribe(alice, 600_000e6);
        _subscribe(bob, 400_000e6);
        assertEq(uint8(escrow.state()), uint8(EscrowState.Verifying));
        assertEq(escrow.conditionsMet(), 1);

        _attestAll();
        assertEq(escrow.conditionsMet(), 6);

        vm.expectEmit(address(escrow));
        emit ILoanEscrow.Released(spv, PRINCIPAL - RESERVE, RESERVE);
        escrow.release();

        assertEq(uint8(escrow.state()), uint8(EscrowState.Released));
        assertEq(usdc.balanceOf(spv), PRINCIPAL - RESERVE, "SPV receives principal minus reserve in USDC");
        assertEq(aiusd.balanceOf(address(vault)), RESERVE, "vault holds the reserve");
        assertEq(aiusd.balanceOf(address(escrow)), 0, "escrow is empty");
        assertEq(uint8(vault.state()), uint8(VaultState.Repaying));
        assertEq(vault.reserveBalance(), RESERVE);
        assertEq(shares.balanceOf(alice), 600_000e6);
        assertEq(shares.balanceOf(bob), 400_000e6);
        assertEq(shares.totalSupply(), PRINCIPAL);
        assertEq(shares.symbol(), "NH200-1");
    }

    function test_ConditionsCanBeSignedDuringSubscription() public {
        _attestAll();
        assertEq(escrow.conditionsMet(), 5);
        _subscribe(alice, PRINCIPAL);
        assertEq(escrow.conditionsMet(), 6);
        escrow.release();
        assertEq(uint8(escrow.state()), uint8(EscrowState.Released));
    }

    function test_AnyoneCanRelease() public {
        _fillAndAttest();
        vm.prank(outsider);
        escrow.release();
        assertEq(uint8(escrow.state()), uint8(EscrowState.Released));
    }

    /* ---------- Subscription rules ---------- */

    function test_RevertWhen_NotInvestor() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.NotInvestor.selector, outsider));
        escrow.subscribe(MIN_SUB);
    }

    function test_RevertWhen_FrozenInvestor() public {
        vm.prank(multisig);
        registry.freezeInvestor(alice, bytes32("sanctions"));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.NotInvestor.selector, alice));
        escrow.subscribe(MIN_SUB);
    }

    function test_RevertWhen_BelowMinimum() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.BelowMinimum.selector, MIN_SUB - 1, MIN_SUB));
        escrow.subscribe(MIN_SUB - 1);
    }

    function test_LastSliceMayBeBelowMinimum() public {
        _subscribe(alice, PRINCIPAL - 50_000e6);
        _subscribe(bob, 50_000e6);
        assertEq(uint8(escrow.state()), uint8(EscrowState.Verifying));
    }

    function test_RevertWhen_ExceedsRemaining() public {
        _subscribe(alice, 900_000e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.ExceedsRemaining.selector, 200_000e6, 100_000e6));
        escrow.subscribe(200_000e6);
    }

    function test_RevertWhen_SubscriptionDeadlinePassed() public {
        vm.warp(escrow.params().subscriptionDeadline + 1);
        vm.prank(alice);
        vm.expectRevert(ILoanEscrow.DeadlinePassed.selector);
        escrow.subscribe(MIN_SUB);
    }

    function test_RevertWhen_SubscriptionsPaused() public {
        vm.prank(multisig);
        guardian.pause(PAUSE_SUBSCRIBE, bytes32("incident"));
        vm.prank(alice);
        vm.expectRevert(ILoanEscrow.Paused.selector);
        escrow.subscribe(MIN_SUB);
    }

    function test_WithdrawBeforeFull() public {
        _subscribe(alice, 300_000e6);
        _subscribe(bob, 200_000e6);
        uint256 before = aiusd.balanceOf(alice);

        vm.prank(alice);
        escrow.withdraw();

        assertEq(aiusd.balanceOf(alice), before + 300_000e6);
        assertEq(escrow.totalSubscribed(), 200_000e6);
        assertEq(escrow.subscribers().length, 1);
        assertEq(escrow.subscribers()[0], bob);
    }

    function test_RevertWhen_WithdrawAfterFull() public {
        _subscribe(alice, PRINCIPAL);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.WrongState.selector, EscrowState.Verifying));
        escrow.withdraw();
    }

    /* ---------- Conditions ---------- */

    function test_RevertWhen_NotEnoughSignatures() public {
        Attestation memory a = _attestation(COND_RENT_ROUTED, 0);
        // Buyer and operator sign, platform does not: 2 of 3.
        bytes[] memory sigs = new bytes[](3);
        sigs[0] = _sign(buyerKey, a);
        sigs[1] = _sign(operatorKey, a);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.NotEnoughSignatures.selector, COND_RENT_ROUTED, 2, 3));
        escrow.attest(a, sigs);
    }

    function test_SignatureFromWrongKeyDoesNotCount() public {
        Attestation memory a = _attestation(COND_LIEN_FILED, 0);
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = _sign(buyerKey, a); // slot belongs to the lien agent
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.NotEnoughSignatures.selector, COND_LIEN_FILED, 0, 1));
        escrow.attest(a, sigs);
    }

    function test_RevertWhen_SignatureCountMismatch() public {
        Attestation memory a = _attestation(COND_LIEN_FILED, 0);
        bytes[] memory sigs = new bytes[](2);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.SignatureCountMismatch.selector, 1, 2));
        escrow.attest(a, sigs);
    }

    function test_RevertWhen_SignatureExpired() public {
        Attestation memory a = _attestation(COND_LIEN_FILED, 0);
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = _sign(lienKey, a);
        vm.warp(a.deadline + 1);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.SignatureExpired.selector, a.deadline));
        escrow.attest(a, sigs);
    }

    function test_RevertWhen_AppraisalTooLow() public {
        // 1,000,000 / 0.8 = 1,250,000 is the lowest appraisal that passes.
        uint256 appraisal = 1_249_999e6;
        Attestation memory a = _attestation(COND_APPRAISAL, appraisal);
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = _sign(appraiserKey, a);
        vm.expectRevert(
            abi.encodeWithSelector(ILoanEscrow.AppraisalTooLow.selector, PRINCIPAL, appraisal, uint16(8000))
        );
        escrow.attest(a, sigs);
    }

    function test_RevertWhen_GpuCountMismatch() public {
        Attestation memory a = _attestation(COND_EQUIPMENT_ONLINE, GPUS - 32);
        bytes[] memory sigs = new bytes[](2);
        sigs[0] = _sign(node1Key, a);
        sigs[1] = _sign(node2Key, a);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.GpuCountMismatch.selector, GPUS, GPUS - 32));
        escrow.attest(a, sigs);
    }

    function test_RevokedConditionBlocksRelease() public {
        _fillAndAttest();
        vm.prank(lienAgent);
        escrow.revokeAttestation(COND_LIEN_FILED, bytes32("withdrawn"));
        assertEq(escrow.conditionsMet(), 5);

        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.ConditionsIncomplete.selector, 5));
        escrow.release();

        _attestLien(); // re-signed
        escrow.release();
    }

    function test_RevertWhen_OutsiderRevokes() public {
        _fillAndAttest();
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.NotSignerOfCondition.selector, outsider, COND_LIEN_FILED));
        escrow.revokeAttestation(COND_LIEN_FILED, bytes32(0));
    }

    /* ---------- Release guards ---------- */

    function test_RevertWhen_ReleaseWithoutAllConditions() public {
        _subscribe(alice, PRINCIPAL);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.ConditionsIncomplete.selector, 1));
        escrow.release();
    }

    function test_RevertWhen_ReleasePaused() public {
        _fillAndAttest();
        vm.prank(multisig);
        guardian.pause(PAUSE_RELEASE, bytes32("incident"));
        vm.expectRevert(ILoanEscrow.Paused.selector);
        escrow.release();
    }

    function test_RevertWhen_ReleaseAfterDeadline() public {
        _fillAndAttest();
        vm.warp(escrow.params().releaseDeadline + 1);
        vm.expectRevert(ILoanEscrow.DeadlinePassed.selector);
        escrow.release();
    }

    /* ---------- Refunds ---------- */

    function test_RefundWhenNotFullySubscribed() public {
        _subscribe(alice, 300_000e6);
        uint256 before = aiusd.balanceOf(alice);

        vm.expectRevert(ILoanEscrow.DeadlineNotReached.selector);
        escrow.expire();

        vm.warp(escrow.params().subscriptionDeadline + 1);
        escrow.expire();
        assertEq(uint8(escrow.refundReason()), uint8(RefundReason.NotFullySubscribed));

        vm.prank(alice);
        escrow.claimRefund();
        assertEq(aiusd.balanceOf(alice), before + 300_000e6);
        assertEq(escrow.totalSubscribed(), 0);
    }

    function test_RefundWhenConditionsNotMet() public {
        _subscribe(alice, 600_000e6);
        _subscribe(bob, 400_000e6);
        _attestLien(); // only one of five

        vm.warp(escrow.params().releaseDeadline + 1);
        escrow.expire();
        assertEq(uint8(escrow.refundReason()), uint8(RefundReason.ConditionsNotMet));

        address[] memory list = new address[](2);
        list[0] = alice;
        list[1] = bob;
        vm.prank(outsider);
        escrow.refundBatch(list);

        assertEq(aiusd.balanceOf(address(escrow)), 0);
        assertEq(aiusd.balanceOf(alice), 2_000_000e6);
        assertEq(aiusd.balanceOf(bob), 2_000_000e6);
    }

    function test_MultisigCanCancel() public {
        _subscribe(alice, PRINCIPAL);
        vm.prank(multisig);
        escrow.cancel(bytes32("offtake void"));
        assertEq(uint8(escrow.refundReason()), uint8(RefundReason.Cancelled));

        vm.prank(alice);
        escrow.claimRefund();
        assertEq(aiusd.balanceOf(alice), 2_000_000e6);
    }

    function test_RevertWhen_OutsiderCancels() public {
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.NotMultisig.selector, outsider));
        escrow.cancel(bytes32(0));
    }

    function test_RevertWhen_CancelAfterRelease() public {
        _fillAndAttest();
        escrow.release();
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.WrongState.selector, EscrowState.Released));
        escrow.cancel(bytes32(0));
    }

    /* ---------- Shares and gateway ---------- */

    function test_SharesAreNotTransferable() public {
        _fillAndAttest();
        escrow.release();
        vm.prank(alice);
        vm.expectRevert(ILoanShares.NonTransferable.selector);
        shares.transfer(bob, 1);
    }

    function test_GatewayRedeemsOnlyToActiveRegisteredAddress() public {
        address cold = makeAddr("cold");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAIUSDGateway.AddressNotActive.selector, alice, cold));
        gateway.redeem(1e6, cold);

        vm.prank(alice);
        gateway.registerAddress(cold);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IAIUSDGateway.AddressNotActive.selector, alice, cold));
        gateway.redeem(1e6, cold);

        vm.warp(block.timestamp + 24 hours);
        vm.prank(alice);
        gateway.redeem(1e6, cold);
        assertEq(usdc.balanceOf(cold), 1e6);
    }

    /* ---------- Factory checks ---------- */

    function test_RevertWhen_DuplicateSigner() public {
        LoanParams memory p = _params();
        p.loanCode = "DUP-1";
        p.conditions[2].signers[1] = buyer; // buyer listed twice
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(ILoanFactory.InvalidParams.selector, "duplicate signer"));
        factory.createLoan(p);
    }

    function test_RevertWhen_ScheduleDoesNotSumToPrincipal() public {
        LoanParams memory p = _params();
        p.loanCode = "BAD-1";
        p.schedule.principalDue[0] += 1;
        vm.prank(multisig);
        vm.expectRevert(abi.encodeWithSelector(ILoanFactory.InvalidParams.selector, "schedule principal"));
        factory.createLoan(p);
    }

    function test_RevertWhen_OutsiderCreatesLoan() public {
        LoanParams memory p = _params();
        p.loanCode = "X-1";
        vm.prank(outsider);
        vm.expectRevert(abi.encodeWithSelector(ILoanFactory.NotMultisig.selector, outsider));
        factory.createLoan(p);
    }

    /* ---------- Contract wallet signers ---------- */

    /// @dev A law firm that signs through a contract wallet (e.g. a Safe) instead of a single private key.
    function test_ContractWalletCanSignCondition() public {
        MockContractWallet firmWallet = new MockContractWallet(lienAgent);
        vm.prank(multisig);
        registry.setSigner(address(firmWallet), SIGNER_LIEN_AGENT, true);

        LoanParams memory p = _params();
        p.loanCode = "SAFE-1";
        p.conditions[1] = _spec1(address(firmWallet));
        vm.prank(multisig);
        (address e,,) = factory.createLoan(p);
        LoanEscrow safeEscrow = LoanEscrow(e);

        Attestation memory a = _attestation(COND_LIEN_FILED, 0);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(lienKey, safeEscrow.hashAttestation(a));
        bytes[] memory sigs = new bytes[](1);
        sigs[0] = abi.encodePacked(r, s, v);
        safeEscrow.attest(a, sigs);
        assertTrue(safeEscrow.conditionMet(COND_LIEN_FILED));

        // A key the wallet does not recognise is rejected.
        (v, r, s) = vm.sign(buyerKey, safeEscrow.hashAttestation(a));
        sigs[0] = abi.encodePacked(r, s, v);
        vm.expectRevert(abi.encodeWithSelector(ILoanEscrow.NotEnoughSignatures.selector, COND_LIEN_FILED, 0, 1));
        safeEscrow.attest(a, sigs);
    }

    /* ---------- Fuzz: escrow balance always equals total subscribed ---------- */

    function testFuzz_BalanceMatchesTotal(uint96 a, uint96 b, bool aliceWithdraws) public {
        uint256 amountA = bound(uint256(a), MIN_SUB, 500_000e6);
        uint256 amountB = bound(uint256(b), MIN_SUB, PRINCIPAL - amountA);
        _subscribe(alice, amountA);
        _subscribe(bob, amountB);
        if (aliceWithdraws && escrow.state() == EscrowState.Subscribing) {
            vm.prank(alice);
            escrow.withdraw();
        }
        assertEq(aiusd.balanceOf(address(escrow)), escrow.totalSubscribed());
        assertLe(escrow.totalSubscribed(), PRINCIPAL);
    }
}
