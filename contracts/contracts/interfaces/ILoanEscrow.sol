// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC5267} from "@openzeppelin/contracts/interfaces/IERC5267.sol";
import {Attestation, EscrowState, LoanParams, RefundReason} from "../types/LoanTypes.sol";

/// @title Loan escrow
/// @notice One per loan. Holds subscriptions. Releases to the SPV only when all 6 conditions are met;
///         otherwise everything is refunded (PRD 4.6, principle 1).
/// @dev States: Subscribing -> Verifying -> Released, or any pre-release state -> Refunding.
///      Deadline refunds and release are open to anyone: once the conditions hold, the outcome is the same
///      whoever calls. The keeper only makes sure they are called on time.
///      The platform has no function that can send subscriptions anywhere else.
///      eip712Domain() (ERC-5267) returns the domain used to sign attestations.
interface ILoanEscrow is IERC5267 {
    /* ---------- Events: the indexer builds subscription progress, condition progress and the on-chain record from these ---------- */

    event Subscribed(address indexed investor, uint256 amount, uint256 totalSubscribed);
    event Withdrawn(address indexed investor, uint256 amount, uint256 totalSubscribed);
    /// @notice Fully subscribed: condition 1 is met and the escrow moves to Verifying.
    event FullySubscribed(uint256 totalSubscribed);
    event ConditionAttested(uint8 indexed conditionId, bytes32 docHash, bytes32 refNo, uint256 amount, address[] signers);
    event AttestationRevoked(uint8 indexed conditionId, address indexed by, bytes32 reasonHash);
    /// @param paidToSpv USDC sent to the SPV = principal - reserve
    /// @param reserve Reserve moved into the collection vault
    event Released(address indexed spvWallet, uint256 paidToSpv, uint256 reserve);
    event RefundOpened(RefundReason reason, bytes32 reasonHash);
    event Refunded(address indexed investor, uint256 amount);

    /* ---------- Errors ---------- */

    error WrongState(EscrowState actual);
    error NotInvestor(address account);
    error NotMultisig(address caller);
    error Paused();
    error DeadlinePassed();
    error DeadlineNotReached();
    error BelowMinimum(uint256 amount, uint256 minimum);
    error ExceedsRemaining(uint256 amount, uint256 remaining);
    error TooManySubscribers(uint16 max);
    error NothingToWithdraw(address investor);
    error NothingToRefund(address investor);
    error SignatureCountMismatch(uint256 expected, uint256 actual);
    error UnknownCondition(uint8 conditionId);
    error SignatureExpired(uint64 deadline);
    error NotEnoughSignatures(uint8 conditionId, uint256 valid, uint8 threshold);
    error NotSignerOfCondition(address account, uint8 conditionId);
    error AppraisalTooLow(uint256 principal, uint256 appraisal, uint16 maxLtvBps);
    error GpuCountMismatch(uint32 expected, uint256 reported);
    error ConditionsIncomplete(uint8 met);

    /* ---------- Investors ---------- */

    /// @notice Subscribes; AIUSD moves from the caller into this contract (approve first). PRD 4.5.2.
    /// @dev Requires: caller is a verified, unfrozen investor in the Registry; Subscribing; before
    ///      subscriptionDeadline; subscriptions not paused.
    ///      amount >= minSubscription, unless less than minSubscription remains, in which case it must equal
    ///      what remains. Cannot exceed what remains; first come, first served. Filling the loan moves the
    ///      escrow to Verifying and emits FullySubscribed.
    ///      An investor may subscribe several times; amounts add up. New subscribers cannot exceed maxSubscribers.
    function subscribe(uint256 amount) external;

    /// @notice Withdraws the caller's whole subscription (PRD 4.6.1 #2).
    /// @dev Only while Subscribing and before subscriptionDeadline. Once full, funds are locked until release or refund.
    function withdraw() external;

    /* ---------- Release conditions ---------- */

    /// @notice Submits proof for conditions 2-6. Anyone may submit; the contract verifies the signatures.
    /// @dev Requires: Subscribing or Verifying; before releaseDeadline; a.deadline not passed.
    ///      signatures[i] is the signature of the condition's signers[i], or empty if that signer has not signed;
    ///      its length must equal signers.length. EOA (ECDSA) and contract wallet (ERC-1271, e.g. Safe)
    ///      signatures are both accepted. Valid signatures must reach the condition's threshold.
    ///      Condition 5: a.amount must equal gpuCount.
    ///      Condition 6: principal x BPS <= a.amount x maxLtvBps.
    ///      A met condition can be attested again; the newer proof replaces the old one (e.g. re-signing after revocation).
    function attest(Attestation calldata a, bytes[] calldata signatures) external;

    /// @notice Revokes a met condition (PRD 4.6.2 #6: forged proof found, or the signer withdraws it).
    /// @dev Callable by any signer of that condition, or the operations multisig. Only before release.
    function revokeAttestation(uint8 conditionId, bytes32 reasonHash) external;

    /* ---------- Release and refund ---------- */

    /// @notice Releases funds once all 6 conditions are met (PRD 4.4 step 4). Anyone may call.
    /// @dev Requires: Verifying; all 6 conditions met; before releaseDeadline; releases not paused.
    ///      In order:
    ///      1. Move the reserve (sum of the first reserveMonths payments) into the collection vault and activate it
    ///      2. Redeem the remaining AIUSD to USDC through the gateway and send it to spvWallet
    ///      3. Mint shares to each subscriber equal to their subscription
    function release() external;

    /// @notice Opens refunds once a deadline passes without completion. Anyone may call.
    /// @dev Subscribing after subscriptionDeadline -> NotFullySubscribed;
    ///      Verifying after releaseDeadline -> ConditionsNotMet.
    function expire() external;

    /// @notice Cancels the loan and refunds everyone when a material problem is found after listing (PRD 4.6.1 #3).
    /// @dev Only the operations multisig, and only before release.
    function cancel(bytes32 reasonHash) external;

    /// @notice Returns the caller's subscription in AIUSD. Not affected by pauses.
    function claimRefund() external;

    /// @notice Sends refunds to a list of subscribers; funds only ever go to each subscriber's own address.
    ///         Anyone may call.
    function refundBatch(address[] calldata investors) external;

    /* ---------- Views ---------- */

    function state() external view returns (EscrowState);

    function refundReason() external view returns (RefundReason);

    function params() external view returns (LoanParams memory);

    function totalSubscribed() external view returns (uint256);

    function subscriptionOf(address investor) external view returns (uint256);

    function subscribers() external view returns (address[] memory);

    /// @notice Condition 1 counts as met once fully subscribed.
    function conditionMet(uint8 conditionId) external view returns (bool);

    /// @return Number of conditions met, 0-6
    function conditionsMet() external view returns (uint8);

    /// @notice EIP-712 digest of an attestation; the backend uses it to build and check signatures.
    function hashAttestation(Attestation calldata a) external view returns (bytes32);

    function vault() external view returns (address);

    function shares() external view returns (address);
}
