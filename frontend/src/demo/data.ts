// Sample data, copied from the prototype (v2-exchange/app/index.html, "示例数据" and LOANS).
// Replaced piece by piece with backend and on-chain data once the 1:1 migration is done.

export const ME = '0x7a3F09c2b5E1d84A6f2C3e90bB41d7aE5c0c91E';
export const INITIAL_BAL = 352380;
export const MIN_SUB = 100000;

export interface LoanInfo {
  gpu: string;
  site: string;
  rate: number;
  left: string;
  cov: number[];
  cond: number;
}

export interface Market {
  sym: string;
  name: string;
  cat: string;
  kind: string;
  price?: number;
  ref?: number;
  refName?: string;
  chg?: number;
  vol?: number;
  yld?: number;
  yName?: string;
  size?: number;
  sizeName?: string;
  tick?: number;
  about?: string;
  loan?: LoanInfo;
  soon?: boolean;
  index?: number;
  unit?: string;
}

export const CATS = [
  { k: 'credit', n: 'Compute credit', live: true },
  { k: 'compute', n: 'Compute price', live: false, note: 'Perpetuals on GPU rental price indexes' },
  { k: 'energy', n: 'Energy receivables', live: false, note: 'Planned' },
  { k: 'lease', n: 'Equipment leases', live: false, note: 'Planned' },
];

export const M: Market[] = [
  { sym: 'CCV', name: 'Compute Credit Vault', cat: 'credit', kind: 'Vault', price: 1.0371, ref: 1.0378, refName: 'NAV', chg: 0.0006, vol: 412300, yld: 0.062, yName: 'Net APY 30d', size: 9389000, sizeName: 'NAV', tick: 0.0001,
    about: 'Backed by the vault that holds 7 compute loans. Every loan went through the same six release conditions.' },
  { sym: 'NH200-1', name: 'Nordic H200 Cluster I', cat: 'credit', kind: 'Loan', price: 0.9984, ref: 1, refName: 'Par', chg: -0.0011, vol: 58200, yld: 0.112, yName: 'Yield to maturity', size: 5051000, sizeName: 'Outstanding', tick: 0.0001, loan: { gpu: '256 × NVIDIA H200 SXM', site: 'Oslo, Norway', rate: 0.11, left: '23 months', cov: [1.3, 1.3, 1.28, 1.3, 1.21, 1.3, 1.3], cond: 6 } },
  { sym: 'AUS-H100', name: 'Austin H100 Fleet', cat: 'credit', kind: 'Loan', price: 1.0012, ref: 1, refName: 'Par', chg: 0.0004, vol: 31500, yld: 0.103, yName: 'Yield to maturity', size: 3789000, sizeName: 'Outstanding', tick: 0.0001, loan: { gpu: '384 × NVIDIA H100 SXM', site: 'Austin, Texas, US', rate: 0.105, left: '22 months', cov: [1.29, 1.29, 1.26, 1.29, 1.29, 1.22, 1.29, 1.29], cond: 6 } },
  { sym: 'SG-H200', name: 'Singapore H200 Block', cat: 'credit', kind: 'Loan', price: 0.9971, ref: 1, refName: 'Par', chg: -0.0009, vol: 12800, yld: 0.114, yName: 'Yield to maturity', size: 4605000, sizeName: 'Outstanding', tick: 0.0001, loan: { gpu: '192 × NVIDIA H200 SXM', site: 'Singapore', rate: 0.11, left: '28 months', cov: [1.28, 1.28], cond: 6 } },
  { sym: 'REY-B200', name: 'Reykjavik B200 Pod', cat: 'credit', kind: 'Loan', price: 1.0005, ref: 1, refName: 'Par', chg: 0, vol: 4100, yld: 0.118, yName: 'Yield to maturity', size: 2038000, sizeName: 'Outstanding', tick: 0.0001, loan: { gpu: '64 × NVIDIA B200', site: 'Reykjavik, Iceland', rate: 0.12, left: '20 months', cov: [1.24, 1.24, 1.21, 1.24], cond: 6 } },
  { sym: 'OSA-H100', name: 'Osaka H100 Rack', cat: 'credit', kind: 'Loan', price: 0.994, ref: 1, refName: 'Par', chg: 0, vol: 0, yld: 0.121, yName: 'Yield to maturity', size: 1296000, sizeName: 'Outstanding', tick: 0.0001, loan: { gpu: '128 × NVIDIA H100 SXM', site: 'Osaka, Japan', rate: 0.115, left: '19 months', cov: [1.23, 1.23, 1.2, 1.23, 1.23], cond: 6 } },
  { sym: 'H100-PERP', name: 'H100 rental price', cat: 'compute', kind: 'Perpetual', soon: true, index: 2.14, unit: '$/GPU-hour' },
  { sym: 'B200-PERP', name: 'B200 rental price', cat: 'compute', kind: 'Perpetual', soon: true, index: 3.86, unit: '$/GPU-hour' },
];

/** New issues still raising. sub = share subscribed; cd = dates the 6 release conditions were signed (null = not yet); mine = this account's subscription. */
export interface NewIssue {
  sym: string;
  name: string;
  gpu: string;
  site: string;
  buyer: string;
  offtake: number;
  amt: number;
  appraisal: number;
  rent: number;
  sub: number;
  rate: number;
  term: number;
  opened: string;
  closes: string;
  full: string | null;
  deadline: string;
  cd: (string | null)[];
  mine: number;
}

export const INITIAL_NEW: NewIssue[] = [
  { sym: 'FRA-H100', name: 'Frankfurt H100 Portfolio', gpu: '512 × NVIDIA H100 SXM', site: 'Frankfurt, Germany', buyer: 'Enterprise AI platform', offtake: 30, amt: 7200000, appraisal: 9300000, rent: 352000, sub: 0.62, rate: 0.105, term: 28,
    opened: '2026-10-01', closes: '2026-10-31', full: null, deadline: '2026-12-15', cd: [null, '2026-10-06', null, null, null, '2026-09-28'], mine: 0 },
  { sym: 'DAL-B200', name: 'Dallas B200 Expansion', gpu: '128 × NVIDIA B200', site: 'Dallas, Texas, US', buyer: 'Model training lab', offtake: 26, amt: 4000000, appraisal: 5200000, rent: 224000, sub: 1, rate: 0.115, term: 24,
    opened: '2026-09-08', closes: '2026-09-30', full: '2026-09-26', deadline: '2026-11-30', cd: ['2026-09-26', '2026-09-15', '2026-10-02', null, null, '2026-09-05'], mine: 750000 },
];

/** Positions. The prototype also holds CCV, which is hidden in v1 (VAULT = false), so it is left out here. */
export const POS = [{ sym: 'NH200-1', qty: 395265, avg: 1.0 }];

export interface Loan {
  amount: number;
  appraisal: number;
  term: number;
  rate: number;
  rent: number;
  buyer: string;
  offtake: number;
  released: string;
  firstPay: string;
  got: number[];
  up: number[];
  cd: string[];
  filing: string;
  vault: number;
}

export const LOANS: Record<string, Loan> = {
  'NH200-1': { amount: 6400000, appraisal: 8200000, term: 30, rate: 0.11, rent: 318000, buyer: 'AI inference platform', offtake: 32, released: '2026-03-04', firstPay: '2026-04-05',
    got: [318000, 318000, 312400, 318000, 296400, 318000, 318000], up: [99.2, 99.5, 98.1, 99.6, 95.8, 99.4, 99.7], cd: ['2026-02-16', '2026-02-03', '2026-02-10', '2026-02-24', '2026-03-02', '2026-01-28'], filing: 'NO-LR-2026-0048213', vault: 1700000 },
  'AUS-H100': { amount: 5000000, appraisal: 6400000, term: 30, rate: 0.105, rent: 245000, buyer: 'Inference platform', offtake: 30, released: '2026-01-20', firstPay: '2026-02-20',
    got: [245000, 245000, 240100, 245000, 245000, 232800, 245000, 245000], up: [99.4, 99.6, 98.3, 99.5, 99.7, 96.1, 99.3, 99.6], cd: ['2026-01-06', '2025-12-23', '2025-12-30', '2026-01-10', '2026-01-18', '2025-12-16'], filing: 'TX-UCC-26-0102215', vault: 1800000 },
  'SG-H200': { amount: 4800000, appraisal: 6200000, term: 30, rate: 0.11, rent: 236000, buyer: 'Cloud GPU reseller', offtake: 31, released: '2026-06-30', firstPay: '2026-07-30',
    got: [236000, 236000], up: [99.4, 99.6], cd: ['2026-06-16', '2026-06-02', '2026-06-09', '2026-06-20', '2026-06-28', '2026-05-26'], filing: 'SG-ACRA-26-88310', vault: 1450000 },
  'REY-B200': { amount: 2400000, appraisal: 3100000, term: 24, rate: 0.12, rent: 140000, buyer: 'Model training lab', offtake: 25, released: '2026-05-12', firstPay: '2026-06-12',
    got: [140000, 140000, 137200, 140000], up: [99.4, 99.6, 98.3, 99.5], cd: ['2026-04-28', '2026-04-14', '2026-04-21', '2026-05-02', '2026-05-10', '2026-04-07'], filing: 'IS-VED-2026-4471', vault: 1200000 },
  'OSA-H100': { amount: 1600000, appraisal: 2100000, term: 24, rate: 0.115, rent: 92000, buyer: 'Inference platform', offtake: 24, released: '2026-04-15', firstPay: '2026-05-15',
    got: [92000, 92000, 90200, 92000, 92000], up: [99.4, 99.6, 98.3, 99.5, 99.7], cd: ['2026-04-01', '2026-03-18', '2026-03-25', '2026-04-05', '2026-04-13', '2026-03-11'], filing: 'JP-MOJ-2026-551902', vault: 800000 },
};

export const COND: [string, string][] = [
  ['Fully subscribed', 'Escrow contract, automatically'],
  ['SPV formed, equipment pledged', 'Corporate services provider · operator'],
  ['Lien filed', 'Law firm'],
  ['Rent routed to collection contract', 'Buyer · operator · platform'],
  ['Equipment verified online', 'Monitoring nodes'],
  ['Loan ≤ 80% of appraisal', 'Appraiser'],
];

export const bySym = (s: string) => M.find((m) => m.sym === s);
export const isOpen = (n: NewIssue) => n.sub < 1;
export const nDone = (n: NewIssue) => n.cd.filter(Boolean).length;
export const nState = (n: NewIssue) => (isOpen(n) ? 'Subscribing' : `Verifying · ${nDone(n)}/6 conditions`);

/** Level monthly payment of a loan. */
export const pmt = (l: Loan) => {
  const r = l.rate / 12;
  return (l.amount * r) / (1 - Math.pow(1 + r, -l.term));
};
/** Principal outstanding after k payments. */
export const bal = (l: Loan, k: number) => {
  const r = l.rate / 12;
  const p = pmt(l);
  let b = l.amount;
  for (let i = 0; i < k; i++) b -= p - b * r;
  return b;
};
/** Level monthly payment for amount a at annual rate r over t months. */
export const mo = (a: number, r: number, t: number) => {
  const i = r / 12;
  return (a * i) / (1 - Math.pow(1 + i, -t));
};
