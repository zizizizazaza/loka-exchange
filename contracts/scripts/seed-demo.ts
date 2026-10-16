// Fills a local chain with the loans shown in the exchange prototype, so the backend and the app have real
// on-chain state to read. Local only: it moves the chain clock forward to simulate monthly repayments.
//
//   npx hardhat node                                             # terminal 1
//   npx hardhat run scripts/deploy.ts --network localhost        # terminal 2
//   npx hardhat run scripts/seed-demo.ts --network localhost
//
// Result:
//   NH200-1   Nordic H200 Cluster I     released, 7 of 30 payments made
//   AUS-H100  Austin H100 Fleet         released, 7 of 30 payments made
//   FRA-H100  Frankfurt H100 Portfolio  subscribing, 62% of 7.2M
//   DAL-B200  Dallas B200 Expansion     fully subscribed, 4 of 6 conditions
//
// Hardhat node accounts: #0 admin (multisig, compliance, platform signer), #1 Northwind Capital (the demo
// investor), #2-3 other investors, #4-10 condition signers, #11 SPV, #12 fee recipient, #13 rent channel.
import { readFileSync } from "node:fs";
import { keccak256, parseUnits, stringToHex, toHex, type Address, type WalletClient } from "viem";
import { network } from "hardhat";

const { viem, networkName, networkHelpers } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();
if ((await publicClient.getChainId()) !== 31337) throw new Error("seed-demo only runs on a local Hardhat chain");

const d = JSON.parse(readFileSync(`deployments/${networkName}.json`, "utf8"));
const c = d.contracts as Record<string, Address>;

const w = await viem.getWalletClients();
const [admin, northwind, harbor, meridian, corp, lienAgent, buyer, operator, node1, node2, appraiser, spv, fees, rent] =
  w;
const investors = [northwind, harbor, meridian];

const usdc = await viem.getContractAt("MockUSDC", c.USDC);
const aiusd = await viem.getContractAt("AIUSD", c.AIUSD);
const registry = await viem.getContractAt("Registry", c.Registry);
const gateway = await viem.getContractAt("AIUSDGateway", c.AIUSDGateway);
const factory = await viem.getContractAt("LoanFactory", c.LoanFactory);

const usd = (n: number) => parseUnits(n.toFixed(6), 6);
const role = (r: string) => stringToHex(r, { size: 32 });
const wait = async (hash: Promise<`0x${string}`>) => publicClient.waitForTransactionReceipt({ hash: await hash });
const as = (wallet: WalletClient) => ({ account: wallet.account! });
const now = async () => (await publicClient.getBlock()).timestamp;
const DAY = 86_400n;

/* ---------- Accounts ---------- */

console.log("Whitelisting investors, registering signers and the rent channel");
for (const inv of investors) await wait(registry.write.addInvestor([inv.account.address, keccak256(toHex("kyb"))]));
const signerRoles: [WalletClient, string][] = [
  [corp, "CORPORATE_SERVICES"],
  [lienAgent, "LIEN_AGENT"],
  [buyer, "BUYER"],
  [operator, "OPERATOR"],
  [admin, "PLATFORM"],
  [node1, "MONITORING_NODE"],
  [node2, "MONITORING_NODE"],
  [appraiser, "APPRAISER"],
];
for (const [s, r] of signerRoles) await wait(registry.write.setSigner([s.account!.address, role(r), true]));
await wait(registry.write.setRentChannel([rent.account.address, true]));

console.log("Funding wallets with USDC and minting AIUSD");
for (const [wallet, amount] of [[northwind, 12_000_000], [harbor, 10_000_000], [meridian, 10_000_000], [rent, 20_000_000]] as const) {
  await wait(usdc.write.mint([wallet.account.address, usd(amount)]));
  await wait(usdc.write.approve([gateway.address, usd(amount)], as(wallet)));
  await wait(gateway.write.mint([usd(amount)], as(wallet)));
}
// Northwind keeps 120,000 USDC in its wallet, as in the Deposit page.
await wait(usdc.write.mint([northwind.account.address, usd(120_000)]));

/* ---------- Loans ---------- */

type Loan = { code: string; escrow: Address; vault: Address; payment: bigint; periods: number };

/** Level monthly payments; the last period absorbs rounding so principal sums exactly. */
function schedule(principal: number, rateBps: number, months: number) {
  const r = rateBps / 10_000 / 12;
  const payment = (principal * r) / (1 - Math.pow(1 + r, -months));
  let balance = principal;
  const principalDue: bigint[] = [];
  const interestDue: bigint[] = [];
  for (let i = 0; i < months; i++) {
    const interest = balance * r;
    const p = i === months - 1 ? balance : payment - interest;
    interestDue.push(usd(interest));
    principalDue.push(usd(p));
    balance -= p;
  }
  const drift = usd(principal) - principalDue.reduce((a, b) => a + b, 0n);
  principalDue[months - 1] += drift;
  return { principalDue, interestDue, payment: usd(payment) };
}

async function createLoan(code: string, principal: number, rateBps: number, months: number, gpuCount: number) {
  const s = schedule(principal, rateBps, months);
  const t = await now();
  const spec = (signers: WalletClient[], threshold: number) => ({
    signers: signers.map((x) => x.account!.address),
    threshold,
  });
  await wait(
    factory.write.createLoan([
      {
        loanCode: role(code),
        termsHash: keccak256(toHex(`${code} term sheet`)),
        principal: usd(principal),
        minSubscription: usd(100_000),
        maxSubscribers: 50,
        subscriptionDeadline: t + 30n * DAY,
        releaseDeadline: t + 72n * DAY,
        conditions: [
          spec([corp, operator], 2),
          spec([lienAgent], 1),
          spec([buyer, operator, admin], 3),
          spec([node1, node2], 2),
          spec([appraiser], 1),
        ],
        gpuCount,
        maxLtvBps: 8000,
        spvWallet: spv.account.address,
        operatorWallet: operator.account.address,
        feeRecipient: fees.account.address,
        feeBps: 200,
        rateBps,
        schedule: { periodLength: Number(30n * DAY), principalDue: s.principalDue, interestDue: s.interestDue },
        reserveMonths: 3,
        cureCoverageBps: 11_500,
        curePeriod: Number(30n * DAY),
        prepayFeeBps: 100,
        prepayLockup: Number(180n * DAY),
      },
    ]),
  );
  const [escrow, vault] = await factory.read.loanOf([role(code)]);
  await wait(aiusd.write.approve([vault, 2n ** 255n], as(rent)));
  console.log(`Listed ${code.padEnd(9)} escrow ${escrow}  vault ${vault}`);
  return { code, escrow, vault, payment: s.payment, periods: months } as Loan;
}

async function subscribe(loan: Loan, wallet: WalletClient, amount: number) {
  const escrow = await viem.getContractAt("LoanEscrow", loan.escrow);
  await wait(aiusd.write.approve([loan.escrow, usd(amount)], as(wallet)));
  await wait(escrow.write.subscribe([usd(amount)], as(wallet)));
}

const ATTESTATION_TYPES = {
  Attestation: [
    { name: "conditionId", type: "uint8" },
    { name: "docHash", type: "bytes32" },
    { name: "refNo", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/** Signs one condition with every listed signer, in the order the loan lists them, and submits it. */
async function attest(loan: Loan, conditionId: number, signers: WalletClient[], amount = 0n, refNo = "") {
  const escrow = await viem.getContractAt("LoanEscrow", loan.escrow);
  const [, name, version, chainId, verifyingContract] = await escrow.read.eip712Domain();
  const message = {
    conditionId,
    docHash: keccak256(toHex(`${loan.code} condition ${conditionId}`)),
    refNo: refNo ? stringToHex(refNo, { size: 32 }) : toHex(0, { size: 32 }),
    amount,
    deadline: (await now()) + 7n * DAY,
  };
  const signatures = await Promise.all(
    signers.map((s) =>
      s.signTypedData({
        account: s.account!,
        domain: { name, version, chainId, verifyingContract },
        types: ATTESTATION_TYPES,
        primaryType: "Attestation",
        message,
      }),
    ),
  );
  await wait(escrow.write.attest([message, signatures]));
}

async function attestAll(loan: Loan, gpuCount: number, appraisal: number) {
  await attest(loan, 2, [corp, operator]);
  await attest(loan, 3, [lienAgent], 0n, "UCC-2026-0412");
  await attest(loan, 4, [buyer, operator, admin]);
  await attest(loan, 5, [node1, node2], BigInt(gpuCount));
  await attest(loan, 6, [appraiser], usd(appraisal));
}

/* ---------- Two loans released and repaying ---------- */

const nh = await createLoan("NH200-1", 6_400_000, 1100, 30, 256);
await subscribe(nh, northwind, 1_200_000);
await subscribe(nh, harbor, 3_000_000);
await subscribe(nh, meridian, 2_200_000);
await attestAll(nh, 256, 8_200_000);

const aus = await createLoan("AUS-H100", 5_000_000, 1050, 30, 384);
await subscribe(aus, northwind, 800_000);
await subscribe(aus, harbor, 2_400_000);
await subscribe(aus, meridian, 1_800_000);
await attestAll(aus, 384, 6_400_000);

for (const loan of [nh, aus]) {
  await wait((await viem.getContractAt("LoanEscrow", loan.escrow)).write.release());
  console.log(`Released ${loan.code}`);
}

// Seven monthly payments. Coverage per month mirrors the prototype (one weaker month on NH200-1).
const coverage: Record<string, number[]> = {
  "NH200-1": [1.3, 1.3, 1.28, 1.3, 1.21, 1.3, 1.3],
  "AUS-H100": [1.29, 1.29, 1.26, 1.29, 1.29, 1.22, 1.29],
};
const holders = investors.map((i) => i.account.address);
for (let k = 1; k <= 7; k++) {
  for (const loan of [nh, aus]) {
    const vault = await viem.getContractAt("CollectionVault", loan.vault);
    const rentAmount = (loan.payment * BigInt(Math.round(coverage[loan.code][k - 1] * 10_000))) / 10_000n;
    await wait(vault.write.depositRent([rentAmount], as(rent)));
  }
  // The two loans were released a few seconds apart; move to the later due date.
  let due = 0n;
  for (const loan of [nh, aus]) {
    const d = await (await viem.getContractAt("CollectionVault", loan.vault)).read.dueDate([k]);
    if (d > due) due = d;
  }
  await networkHelpers.time.increaseTo(due);
  for (const loan of [nh, aus]) {
    const vault = await viem.getContractAt("CollectionVault", loan.vault);
    await wait(vault.write.settle());
    await wait(vault.write.claimFor([holders]));
  }
  console.log(`Settled month ${k}`);
}

/* ---------- One loan subscribing, one waiting for conditions ---------- */

const fra = await createLoan("FRA-H100", 7_200_000, 1050, 28, 512);
await subscribe(fra, harbor, 2_500_000);
await subscribe(fra, meridian, 1_964_000); // 62% of 7.2M

const dal = await createLoan("DAL-B200", 4_000_000, 1150, 24, 128);
await subscribe(dal, northwind, 750_000);
await subscribe(dal, harbor, 1_850_000);
await subscribe(dal, meridian, 1_400_000);
await attest(dal, 2, [corp, operator]);
await attest(dal, 3, [lienAgent], 0n, "UCC-2026-0533");
await attest(dal, 6, [appraiser], usd(5_200_000));

/* ---------- Summary ---------- */

for (const loan of [nh, aus, fra, dal]) {
  const escrow = await viem.getContractAt("LoanEscrow", loan.escrow);
  const vault = await viem.getContractAt("CollectionVault", loan.vault);
  const states = ["Subscribing", "Verifying", "Released", "Refunding"];
  const vstates = ["Inactive", "Repaying", "Cure", "Default", "Matured"];
  console.log(
    `${loan.code.padEnd(9)} escrow ${states[await escrow.read.state()].padEnd(11)} ` +
      `subscribed ${(Number(await escrow.read.totalSubscribed()) / 1e6).toLocaleString()} · ` +
      `conditions ${await escrow.read.conditionsMet()}/6 · vault ${vstates[await vault.read.state()]} · ` +
      `paid ${await vault.read.settledPeriods()}/${loan.periods}`,
  );
}
console.log(`Northwind AIUSD balance: ${(Number(await aiusd.read.balanceOf([northwind.account.address])) / 1e6).toLocaleString()}`);
