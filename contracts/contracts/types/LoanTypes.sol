// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Shared types for compute-backed loans.
// States and rules follow section 4 of the compute fundraising PRD v0.2 in the repo root.
// All amounts are in AIUSD base units (6 decimals, same as USDC). All ratios are in basis points.

uint16 constant BPS = 10_000;

/* ---------- Release condition ids (PRD 4.5.3) ---------- */

// Condition 1 (fully subscribed) is checked by the escrow itself and needs no signature.
// Conditions 2-6 are signed by named parties.
uint8 constant COND_FULLY_SUBSCRIBED = 1;
uint8 constant COND_SPV_AND_PLEDGE = 2; // SPV formed, equipment transferred or pledged to it
uint8 constant COND_LIEN_FILED = 3; // Lien filed
uint8 constant COND_RENT_ROUTED = 4; // Rent routed to the collection vault (three-party signature)
uint8 constant COND_EQUIPMENT_ONLINE = 5; // Equipment online and count matches
uint8 constant COND_APPRAISAL = 6; // Loan <= appraisal x 80%
uint8 constant CONDITION_COUNT = 6;

/* ---------- Signer roles (registered in Registry) ---------- */

bytes32 constant SIGNER_CORPORATE_SERVICES = "CORPORATE_SERVICES"; // Law firm or corporate services provider
bytes32 constant SIGNER_LIEN_AGENT = "LIEN_AGENT"; // Law firm or filing agent
bytes32 constant SIGNER_APPRAISER = "APPRAISER";
bytes32 constant SIGNER_MONITORING_NODE = "MONITORING_NODE"; // Hetu monitoring nodes
bytes32 constant SIGNER_BUYER = "BUYER"; // Compute buyer (offtaker)
bytes32 constant SIGNER_OPERATOR = "OPERATOR"; // Compute operator (borrower)
bytes32 constant SIGNER_PLATFORM = "PLATFORM"; // Platform signing key
bytes32 constant SIGNER_DISPOSAL = "DISPOSAL"; // Recovery and disposal parties after default

/* ---------- Pause scopes (Guardian, combinable as bit flags) ---------- */

uint8 constant PAUSE_SUBSCRIBE = 1; // Subscriptions
uint8 constant PAUSE_RELEASE = 2; // Releases
uint8 constant PAUSE_MINT = 4; // USDC -> AIUSD
uint8 constant PAUSE_REDEEM = 8; // AIUSD -> USDC (withdrawals)

/* ---------- States ---------- */

/// @notice Escrow state. After release the collection vault takes over (see VaultState).
enum EscrowState {
    Subscribing, // Open: investors can subscribe and withdraw
    Verifying, // Fully subscribed, waiting for the remaining conditions; no subscribing or withdrawing
    Released, // Funds released
    Refunding // Subscriptions are being returned
}

enum RefundReason {
    None,
    NotFullySubscribed, // Subscription deadline passed without full subscription (PRD 4.6.1 #1)
    ConditionsNotMet, // Release deadline passed with conditions missing (PRD 4.6.2 #4)
    Cancelled // Cancelled by the multisig (PRD 4.6.1 #3)
}

/// @notice Collection vault state (PRD 4.3).
enum VaultState {
    Inactive, // Not released yet
    Repaying,
    Cure, // Cure period
    Default, // Default and disposal
    Matured // Matured, including full prepayment
}

/* ---------- Structs ---------- */

/// @notice Which parties sign a condition and how many valid signatures it needs.
/// @dev Example: condition 4 = [buyer, operator, platform] with threshold 3;
///      condition 5 = several monitoring nodes with a threshold set at listing.
struct ConditionSpec {
    address[] signers;
    uint8 threshold;
}

/// @notice Proof that a condition is met. Signed off-chain with EIP-712; anyone may submit it.
/// @dev EIP-712 domain: name "Loka Loan Escrow", version "1", verifyingContract = the loan's escrow.
struct Attestation {
    uint8 conditionId; // 2-6
    bytes32 docHash; // SHA-256 of the original document, which stays with the signer and the platform
    bytes32 refNo; // Filing or registration number, UTF-8 left-aligned; zero if none
    uint256 amount; // Condition 5: GPUs online; condition 6: appraised value; otherwise zero
    uint64 deadline; // Signature expiry (unix seconds)
}

bytes32 constant ATTESTATION_TYPEHASH = keccak256(
    "Attestation(uint8 conditionId,bytes32 docHash,bytes32 refNo,uint256 amount,uint64 deadline)"
);

/// @notice Uptime report signed by monitoring nodes for each period.
/// @dev EIP-712 domain: name "Loka Collection Vault", version "1", verifyingContract = the loan's vault.
struct UptimeReport {
    uint32 period; // Period number, starting at 1
    uint16 uptimeBps;
    uint32 gpusOnline;
    bytes32 dataHash; // Hash of the raw monitoring data
    uint64 deadline;
}

bytes32 constant UPTIME_REPORT_TYPEHASH = keccak256(
    "UptimeReport(uint32 period,uint16 uptimeBps,uint32 gpusOnline,bytes32 dataHash,uint64 deadline)"
);

/// @notice Repayment schedule. Level payments are computed off-chain per PRD 4.5.4 and cannot change after listing.
/// @dev Due date of period k (from 1) = release time + k x periodLength.
///      The contracts never compute their own amortization table; these arrays are the only source.
struct RepaymentSchedule {
    uint32 periodLength; // Seconds per period, e.g. 30 days
    uint256[] principalDue; // Principal due each period; must sum to principal
    uint256[] interestDue; // Interest due each period
}

/// @notice Every parameter of one loan, fixed by the factory at deployment
///         (PRD 4.4 step 1: waterfall, registered wallets and release conditions cannot change after listing).
struct LoanParams {
    bytes32 loanCode; // Loan code, e.g. "NH200-1"
    bytes32 termsHash; // Hash of the term sheet
    // Subscription
    uint256 principal; // Amount raised, equal to the loan amount
    uint256 minSubscription; // Minimum subscription (example: 100,000 AIUSD)
    uint16 maxSubscribers; // Cap on subscribers; shares are minted one by one at release, so gas must be bounded
    uint64 subscriptionDeadline; // Example: about 30 days after listing
    uint64 releaseDeadline; // Example: about 6 weeks after the subscription deadline
    // Release conditions
    ConditionSpec[5] conditions; // Conditions 2-6, in order
    uint32 gpuCount; // GPUs that condition 5 must report online
    uint16 maxLtvBps; // Condition 6: principal <= appraisal x maxLtvBps; the PRD sets 8000
    // Where money goes
    address spvWallet; // Registered SPV wallet; released USDC goes here
    address operatorWallet; // Registered operator wallet; its share of rent goes here in USDC
    address feeRecipient; // Platform service fee recipient (paid in AIUSD)
    uint16 feeBps; // Service fee as a share of rent received in the period (example: 200 = 2%)
    // Repayment
    uint16 rateBps; // Annual rate, used for interest after default and for prepayment
    RepaymentSchedule schedule;
    uint8 reserveMonths; // Reserve = sum of the first reserveMonths payments, held back from the loan (PRD 4.5.5; 3)
    uint16 cureCoverageBps; // Coverage below this starts the cure period (11500 = 1.15x)
    uint32 curePeriod; // Cure period length in seconds (30 days)
    uint16 prepayFeeBps; // Prepayment fee paid to holders (example: 100 = 1%)
    uint32 prepayLockup; // Seconds after release before prepayment is allowed (example: 6 months)
}
