// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {IERC5267} from "@openzeppelin/contracts/interfaces/IERC5267.sol";
import {UptimeReport, VaultState} from "../types/LoanTypes.sol";

/// @title Collection vault
/// @notice One per loan. Receives rent, holds the reserve, pays out each period in order (PRD 4.5.4),
///         and handles cure and default (PRD 4.6).
/// @dev States: Inactive -> (release) Repaying <-> Cure -> Default; Repaying -> Matured.
///
///      Waterfall for each period (settle), using the rent deposited since the last settlement:
///      1. Holders: unpaid interest first, then unpaid principal, including this period's payment.
///         If rent falls short, draw on the reserve; anything still unpaid becomes arrears.
///      2. Refill the reserve up to reserveTarget.
///      3. Service fee: feeBps x rent received this period, to feeRecipient. Skipped unless holders are paid
///         in full and the reserve is full.
///      4. The rest: in Repaying it is credited to the operator (paid out in USDC by payOperator).
///         In Cure it is held in the vault; it goes to the operator if the loan is cured, or to holders on default.
///      The PRD states "holders -> service fee -> operator" and that a used reserve is refilled before the
///      operator is paid again. Placing step 2 before the fee, and holding the rest during Cure, are this
///      contract's reading and need product sign-off.
///
///      Coverage for a period = rent received that period / that period's scheduled payment (PRD 4.5.6).
///      In Repaying, coverage below cureCoverageBps starts a cure period of curePeriod seconds.
///      The loan is cured once a settlement shows coverage back at or above cureCoverageBps with no arrears and
///      a full reserve; otherwise it defaults when the cure period ends.
///
///      Holders' money is credited, not pushed: they call claim, and if an address stops working the money stays
///      in the vault (PRD 4.6.5 #22). Amounts are split pro rata to loan shares, which never change after release.
///      eip712Domain() (ERC-5267) returns the domain used to sign uptime reports.
interface ICollectionVault is IERC5267 {
    /* ---------- Events ---------- */

    event Activated(uint64 releasedAt, uint256 reserve);
    event RentDeposited(address indexed from, uint256 amount);
    /// @param dueToHolders What holders were owed this period, including arrears
    /// @param coverageBps Coverage for the period
    event PeriodSettled(
        uint32 indexed period,
        uint256 rentReceived,
        uint256 dueToHolders,
        uint256 paidToHolders,
        uint256 fromReserve,
        uint256 arrears,
        uint256 fee,
        uint256 toOperator,
        uint16 coverageBps
    );
    event SurplusHeld(uint32 indexed period, uint256 amount);
    event UptimeRecorded(uint32 indexed period, uint16 uptimeBps, uint32 gpusOnline, bytes32 dataHash);
    event CureStarted(uint32 indexed period, uint16 coverageBps, uint64 cureDeadline);
    event Cured();
    /// @param automatic True if entered automatically after the cure period; false if declared by the multisig
    ///        based on off-chain facts
    /// @param holderClaim What holders are owed at declaration = unpaid principal + unpaid and accrued interest
    event DefaultDeclared(bool automatic, bytes32 reasonHash, uint256 holderClaim);
    event RecoveryDeposited(address indexed from, uint256 amount, bytes32 evidenceHash);
    event DispositionRecorded(bytes32 indexed docHash, bytes32 noteHash);
    event Prepaid(uint256 principal, uint256 interest, uint256 prepayFee);
    /// @param returnedToOperator Reserve, held surplus and unsettled rent left after holders are paid in full
    event Matured(uint256 returnedToOperator);
    event Claimed(address indexed holder, uint256 amount);
    event OperatorPaid(uint256 amount);

    /* ---------- Errors ---------- */

    error WrongState(VaultState actual);
    error NotEscrow(address caller);
    error NotMultisig(address caller);
    error NotOperator(address caller);
    error NotDueYet(uint32 period, uint64 dueDate);
    error AllPeriodsSettled();
    error ZeroAmount();
    error SignatureExpired(uint64 deadline);
    error SignatureCountMismatch(uint256 expected, uint256 actual);
    error NotEnoughSignatures(uint256 valid, uint8 threshold);
    error PrepayLocked(uint64 allowedFrom);
    error CureNotOver(uint64 cureDeadline);
    error HolderFrozen(address holder);
    error NothingToClaim(address account);

    /* ---------- Called by the escrow at release ---------- */

    /// @notice Activates the vault at release: records the release time (due dates count from it) and the reserve.
    ///         Only this loan's escrow can call it, after transferring the reserve here.
    function activate(uint256 reserve) external;

    /* ---------- Incoming funds ---------- */

    /// @notice Deposits rent in AIUSD. Anyone may deposit; usually a registered rent channel.
    /// @dev Kept for the next settlement. The operator's top-ups during a cure period also come in here.
    ///      In Default, rent goes straight to holders until their claim is paid in full.
    function depositRent(uint256 amount) external;

    /// @notice Deposits proceeds from default disposal (re-leasing rent, sale proceeds) (PRD 4.6.4 #15).
    ///         Anyone may deposit. Only in Default; holders are paid first, the rest goes to the operator.
    function depositRecovery(uint256 amount, bytes32 evidenceHash) external;

    /* ---------- Settlement ---------- */

    /// @notice Settles the next period. Anyone may call; the keeper calls it after each due date.
    /// @dev Requires: Repaying or Cure; the next period's due date has passed. Settles one period per call;
    ///      a late keeper calls repeatedly. Once the last period is settled in Repaying with no arrears,
    ///      the vault matures.
    function settle() external;

    /// @notice Records the monitoring nodes' uptime for a period (PRD 4.4 step 5, item 3). Anyone may submit.
    /// @dev Signers and threshold are those of condition 5; signatures[i] belongs to signers[i], empty if unsigned.
    ///      Recorded only; it does not affect payouts.
    function recordUptime(UptimeReport calldata r, bytes[] calldata signatures) external;

    /* ---------- Cure and default ---------- */

    /// @notice Resolves the cure period. Anyone may call.
    /// @dev In Cure: if the latest coverage >= cureCoverageBps, there are no arrears and the reserve is full,
    ///      return to Repaying (PRD 4.6, key rule 2). Otherwise, after the cure period, move to Default
    ///      automatically; before it ends, revert with CureNotOver.
    function checkCure() external;

    /// @notice Declares default based on off-chain facts: equipment offline too long, revaluation over the limit,
    ///         buyer terminated with no replacement, operator collecting rent privately
    ///         (PRD 4.6.3 #10, #12, #13; 4.6.4 #16). Only the operations multisig.
    /// @dev Default accelerates the loan: holders are owed unpaid principal plus unpaid interest, and interest keeps
    ///      accruing on unpaid principal at rateBps. The reserve, held surplus and unsettled rent are paid to holders
    ///      at once. Later rent and disposal proceeds go to holders first; the operator gets only what remains once
    ///      holders are paid in full.
    function declareDefault(bytes32 reasonHash) external;

    /// @notice Records the document hash of each disposal step (taking over the SPV, removing the equipment,
    ///         selling it). Only the operations multisig, only in Default.
    function recordDisposition(bytes32 docHash, bytes32 noteHash) external;

    /* ---------- Prepayment ---------- */

    /// @notice The operator repays all remaining principal, unpaid interest and the next period's interest,
    ///         plus a prepayment fee on the principal paid to holders (PRD 4.6.3 #14).
    /// @dev Only operatorWallet, after approving AIUSD; only once prepayLockup has passed since release.
    ///      To hold AIUSD the operator wallet must be able to mint, e.g. be registered as a rent channel.
    ///      Moves the vault to Matured.
    function prepay() external;

    /* ---------- Payouts ---------- */

    /// @notice Claims what the caller is owed, in AIUSD. Frozen holders cannot claim; their amounts keep accruing
    ///         (PRD 4.6.5 #21).
    function claim() external returns (uint256 amount);

    /// @notice Pays a list of holders what they are owed; funds only ever go to each holder's own address.
    ///         Frozen holders and holders owed nothing are skipped. Anyone may call.
    function claimFor(address[] calldata holders) external;

    /// @notice Redeems the operator's credited share to USDC and sends it to operatorWallet. Anyone may call.
    function payOperator() external;

    /* ---------- Views ---------- */

    function state() external view returns (VaultState);

    /// @return Number of periods settled
    function settledPeriods() external view returns (uint32);

    function dueDate(uint32 period) external view returns (uint64);

    /// @return Rent deposited and not yet settled
    function rentPool() external view returns (uint256);

    function reserveBalance() external view returns (uint256);

    /// @return Reserve target = sum of the first reserveMonths payments
    function reserveTarget() external view returns (uint256);

    /// @return Surplus held during a cure period
    function heldSurplus() external view returns (uint256);

    /// @return Credited to the operator and not yet paid out
    function operatorClaimable() external view returns (uint256);

    /// @return Scheduled principal and interest that came due and was not paid
    function arrears() external view returns (uint256);

    /// @return Principal not yet repaid to holders
    function outstandingPrincipal() external view returns (uint256);

    /// @return In Default, what holders are still owed including interest accrued to now; otherwise zero
    function defaultClaim() external view returns (uint256);

    function claimable(address holder) external view returns (uint256);

    function lastCoverageBps() external view returns (uint16);

    /// @return End of the cure period; zero when not in Cure
    function cureDeadline() external view returns (uint64);

    function hashUptimeReport(UptimeReport calldata r) external view returns (bytes32);

    function escrow() external view returns (address);

    function shares() external view returns (address);
}
