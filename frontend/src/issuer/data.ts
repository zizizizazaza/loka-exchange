// Sample data for the issuer console, copied from the prototype (v2-exchange/app/issuer/index.html, "示例数据").
// Replaced with backend and on-chain data once the 1:1 migration is done.

export const TODAY = new Date('2026-10-09');

export const CO = {
  name: 'Northwind Compute Ltd.',
  short: 'Northwind Compute',
  reg: 'Delaware, US · file no. 7741920',
  since: '2026-07-14',
  wallet: '0x3b91C4e7aD02f5B8e6A19d4C0F7e2B55a8d0E4c2',
};

export type TaskState = 'done' | 'action';

/** One of the six release conditions, shown to the borrower as a task. */
export interface Task {
  t: string;
  d: string;
  yours: string;
  who: string;
  s: TaskState;
  date?: string;
  files?: string[];
  filing?: string;
  /** Three-party agreement: buyer, you, platform; 1 = signed. */
  sigs?: number[];
  /** [rack, GPUs, GPUs reporting] */
  racks?: [string, number, number][];
}

export interface ReviewStep {
  t: string;
  s: 'done' | 'progress' | 'todo';
  date?: string;
  note?: string;
}

interface Base {
  id: string;
  name: string;
  gpu: string;
  qty: number;
  site: string;
  amount: number;
  rent: number;
  buyer: string;
}

export interface VerifyingLoan extends Base {
  status: 'verifying';
  appraisal: number;
  rate: number;
  term: number;
  spv: string;
  subscribed: number;
  investors: number;
  vault: number;
  refundBy: string;
  tasks: Task[];
}

export interface RepayingLoan extends Base {
  status: 'repaying';
  appraisal: number;
  rate: number;
  term: number;
  spv: string;
  released: string;
  firstPay: string;
  feeRate: number;
  /** [rent received, uptime %] per month */
  months: [number, number][];
}

export interface ReviewLoan extends Base {
  status: 'review';
  appraisal: null;
  offtake: number;
  submitted: string;
  review: ReviewStep[];
}

export type IssuerLoan = VerifyingLoan | RepayingLoan | ReviewLoan;

export const LOANS: IssuerLoan[] = [
  { id: 'cf-002', name: 'Dallas B200 Expansion', gpu: 'NVIDIA B200', qty: 128, site: 'Dallas, Texas, US', status: 'verifying',
    amount: 4000000, appraisal: 5100000, rate: 0.115, term: 24, rent: 225000, buyer: 'Model training lab', spv: 'Northwind Dallas SPV LLC',
    subscribed: 4000000, investors: 6, vault: 1400000, refundBy: '2026-11-30',
    tasks: [
      { t: 'Fully committed', d: 'Lenders fill the loan in its escrow contract.', yours: 'No action.', who: 'Lenders · escrow contract', s: 'done', date: '2026-09-26' },
      { t: 'SPV and equipment transfer', d: 'The borrower SPV is registered and the 128 GPUs are pledged to it.', yours: 'Uploaded SPV registration, serial-number list and pledge agreement.', who: 'Corporate services provider · you', s: 'done', date: '2026-09-18',
        files: ['SPV registration.pdf', 'Equipment list · 128 serials.csv', 'Pledge agreement.pdf'] },
      { t: 'Lien filing', d: 'A law firm files a lien on the equipment.', yours: 'No action. We coordinate with the law firm.', who: 'Law firm', s: 'done', date: '2026-09-30', filing: 'TX-UCC-26-0917734' },
      { t: 'Rent routed to collection contract', d: 'Your buyer signs the three-party agreement that changes their payment address to the loan’s collection contract.', yours: 'Ask your buyer to sign. You and the platform have signed.', who: 'Buyer · you · platform', s: 'action', sigs: [0, 1, 1] },
      { t: 'Equipment online', d: 'The monitoring agent runs on every GPU server; monitoring nodes verify model, count and uptime.', yours: 'Install the agent on the 32 GPUs that are not reporting.', who: 'Monitoring nodes', s: 'action',
        racks: [['Rack A1–A4', 64, 64], ['Rack B1–B2', 32, 32], ['Rack B3–B4', 32, 0]] },
      { t: 'Appraisal', d: 'A third-party appraiser values the equipment. The loan must be no more than 80% of the value.', yours: 'No action.', who: 'Appraiser', s: 'done', date: '2026-09-09' },
    ] },
  { id: 'cf-004', name: 'Austin H100 Fleet', gpu: 'NVIDIA H100 SXM', qty: 384, site: 'Austin, Texas, US', status: 'repaying',
    amount: 5000000, appraisal: 6400000, rate: 0.105, term: 30, rent: 245000, buyer: 'Inference platform', spv: 'Northwind Austin SPV LLC',
    released: '2026-01-20', firstPay: '2026-02-20', feeRate: 0.02,
    months: [[245000, 99.4], [245000, 99.6], [240100, 98.3], [245000, 99.5], [245000, 99.7], [232800, 96.1], [245000, 99.3], [245000, 99.6]] },
  { id: 'app-011', name: 'Phoenix B300 Phase 2', gpu: 'NVIDIA B300', qty: 144, site: 'Phoenix, Arizona, US', status: 'review',
    amount: 6200000, appraisal: null, rent: 298000, offtake: 30, buyer: 'Inference platform', submitted: '2026-10-02',
    review: [
      { t: 'Company and directors verified', s: 'done', date: '2026-10-02' },
      { t: 'Offtake contract received', s: 'done', date: '2026-10-02', note: '30 months remaining · $298,000 a month' },
      { t: 'Equipment list received', s: 'done', date: '2026-10-03', note: '144 × NVIDIA B300, installed Aug 2026' },
      { t: 'Appraisal', s: 'progress', note: 'Appraiser on site Oct 14' },
      { t: 'Buyer confirms the three-party agreement', s: 'todo', note: 'We send it once terms are agreed' },
      { t: 'Term sheet', s: 'todo', note: 'Amount, rate and term, after the appraisal' },
    ] },
];

export const byId = (id: string) => LOANS.find((l) => l.id === id);

const D = (s: string) => new Date(s + 'T00:00:00');
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addMonth = (s: string, i: number) => {
  const d = D(s);
  d.setMonth(d.getMonth() + i);
  return d;
};
export const daysTo = (s: string) => Math.round((D(s).getTime() - TODAY.getTime()) / 864e5);

export function payment(l: { amount: number; rate: number; term: number }) {
  const r = l.rate / 12;
  return (l.amount * r) / (1 - Math.pow(1 + r, -l.term));
}
export function balanceAfter(l: { amount: number; rate: number; term: number }, k: number) {
  const r = l.rate / 12;
  const p = payment(l);
  let b = l.amount;
  for (let i = 0; i < k; i++) b -= p - b * r;
  return Math.max(b, 0);
}

export const STATUS: Record<IssuerLoan['status'], [string, string]> = {
  verifying: ['Verifying', 'verifying'],
  repaying: ['Performing', 'repaying'],
  review: ['In review', 'open'],
};

/** Release tasks waiting on the borrower. */
export const need = (l: IssuerLoan) => (l.status === 'verifying' ? l.tasks.filter((t) => t.s === 'action').length : 0);
