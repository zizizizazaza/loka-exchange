// Facility view models for the v6 and v7 pages (#/v6/..., #/v7/...). Built from the shared sample data
// (src/demo/data.ts) plus the two sample construction facilities (src/pages/facilitySamples.ts); nothing here changes
// the data other pages use.

import { bal, isOpen, LOANS, M, mo, nDone, pmt, POS, type NewIssue } from './data';
import { fmtD, mon, pct } from '../lib/format';
import { BUILD_ACTIVE, BUILD_OPEN, drawnShare, MILESTONES } from '../pages/facilitySamples';

export type Kind = 'Operating' | 'Construction';
export type Phase = 'open' | 'conditions' | 'performing' | 'drawdown';
export type Tone = 'live' | 'wait' | 'ok' | 'build';

export interface Payment {
  date: string;
  due: number;
  got: number;
  up: number;
  balance: number;
}

export interface Facility {
  sym: string;
  name: string;
  gpu: string;
  model: string;
  count: string;
  site: string;
  kind: Kind;
  phase: Phase;
  status: string;
  tone: Tone;
  borrower: string;
  offtaker: string;
  size: number;
  rate: number;
  term: number;
  ratioLabel: 'Over-collateralization' | 'Loan to cost';
  ratio: number;
  /** Equipment appraisal (operating) or total project cost (construction). */
  basis: number;
  reserve: number;
  // Open for commitments / waiting on conditions
  committed?: number;
  closes?: string;
  deadline?: string;
  conds?: (string | null)[];
  mine?: number;
  /** True when the facility lives in the shared demo state, so commitments can be made and withdrawn. */
  live?: boolean;
  // Active
  principal?: number;
  cov?: number;
  paid?: number;
  matures?: string;
  released?: string;
  filing?: string;
  history?: Payment[];
  monthly?: number;
  // Construction
  drawn?: number;
}

export const MIN_COMMIT = 100000;
/** Commitments go in steps of 10,000 AIUSD; withdrawals lock 48 hours before the close (rules v0.2, 2.3 and 2.5). */
export const STEP_COMMIT = 10000;
export const lockDate = (closes: string) => {
  const d = new Date(closes + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
};
/**
 * Fees charged to lenders. None in v1: the service fee comes out of rent after lenders are paid (PRD 4.5.5, 4.8), so
 * the net return to lenders equals the interest rate. Shown separately because PRD 3.2 asks for both figures.
 */
export const LENDER_FEE = 0;
export const netReturn = (f: Facility) => f.rate - LENDER_FEE;
export const modelOf = (s: string) => s.match(/[HB]\d{3}/)?.[0] ?? 'GPU';
export const countOf = (s: string) => s.match(/^([\d,]+)/)?.[1] ?? '';
const spv = (name: string) => `${name.split(' ')[0]} Compute SPV Ltd`;

function fromIssue(n: NewIssue): Facility {
  const o = isOpen(n);
  const p = mo(n.amt, n.rate, n.term);
  return {
    sym: n.sym,
    name: n.name,
    gpu: n.gpu,
    model: modelOf(n.gpu),
    count: countOf(n.gpu),
    site: n.site,
    kind: 'Operating',
    phase: o ? 'open' : 'conditions',
    status: o ? 'Open for commitments' : `Conditions ${nDone(n)}/6`,
    tone: o ? 'live' : 'wait',
    borrower: spv(n.name),
    offtaker: `${n.buyer}, ${n.offtake}-month contract`,
    size: n.amt,
    rate: n.rate,
    term: n.term,
    ratioLabel: 'Over-collateralization',
    ratio: (n.appraisal + 3 * p) / n.amt,
    basis: n.appraisal,
    reserve: 3 * p,
    committed: n.sub,
    closes: n.closes,
    deadline: n.deadline,
    conds: n.cd,
    mine: n.mine,
    live: true,
    monthly: p,
  };
}

function buildOpen(): Facility {
  const b = BUILD_OPEN;
  return {
    sym: b.sym,
    name: b.name,
    gpu: b.gpu,
    model: modelOf(b.gpu),
    count: countOf(b.gpu),
    site: b.site,
    kind: 'Construction',
    phase: 'open',
    status: 'Open for commitments',
    tone: 'live',
    borrower: `${spv(b.name)} · sponsor equity 40%`,
    offtaker: 'Pre-signed compute contract, 36 months',
    size: b.amt,
    rate: b.rate,
    term: b.term,
    ratioLabel: 'Loan to cost',
    ratio: b.amt / b.cost,
    basis: b.cost,
    reserve: b.amt * b.rate * (b.build / 12),
    committed: b.sub,
    closes: b.closes,
    drawn: 0,
  };
}

function fromLoan(sym: string): Facility {
  const m = M.find((x) => x.sym === sym)!;
  const l = LOANS[sym];
  const k = l.got.length;
  const p = pmt(l);
  const r = l.rate / 12;
  let b = l.amount;
  const history: Payment[] = l.got.map((g, i) => {
    b -= p - b * r;
    return { date: mon(l.firstPay, i, true), due: p, got: g, up: l.up[i], balance: b };
  });
  const out = bal(l, k);
  return {
    sym,
    name: m.name,
    gpu: m.loan!.gpu,
    model: modelOf(m.loan!.gpu),
    count: countOf(m.loan!.gpu),
    site: m.loan!.site,
    kind: 'Operating',
    phase: 'performing',
    status: 'Performing',
    tone: 'ok',
    borrower: spv(m.name),
    offtaker: `${l.buyer}, ${l.offtake}-month contract`,
    size: l.amount,
    rate: l.rate,
    term: l.term,
    ratioLabel: 'Over-collateralization',
    ratio: (l.appraisal + 3 * p) / out,
    basis: l.appraisal,
    reserve: 3 * p,
    conds: l.cd,
    principal: out,
    cov: l.got.at(-1)! / p,
    paid: k,
    matures: mon(l.firstPay, l.term - 1),
    released: l.released,
    filing: l.filing,
    history,
    monthly: p,
  };
}

function buildActive(): Facility {
  const b = BUILD_ACTIVE;
  return {
    sym: b.sym,
    name: b.name,
    gpu: b.gpu,
    model: modelOf(b.gpu),
    count: countOf(b.gpu),
    site: b.site,
    kind: 'Construction',
    phase: 'drawdown',
    status: `Drawdown ${b.drawn} of ${MILESTONES.length}`,
    tone: 'build',
    borrower: `${spv(b.name)} · sponsor equity 42%`,
    offtaker: 'Model training lab, 30-month contract (signed)',
    size: b.amt,
    rate: b.rate,
    term: b.term,
    ratioLabel: 'Loan to cost',
    ratio: b.amt / b.cost,
    basis: b.cost,
    reserve: b.amt * b.rate * (b.buildLeft / 12),
    principal: b.amt * drawnShare(b.drawn),
    matures: mon('2026-06-01', b.term),
    drawn: b.drawn,
  };
}

export function facilities(issues: NewIssue[]) {
  const open = [...issues.map(fromIssue), buildOpen()];
  const active = [...M.filter((m) => m.cat === 'credit' && LOANS[m.sym]).map((m) => fromLoan(m.sym)), buildActive()];
  return { open, active, all: [...open, ...active] };
}

/** The sample lender's positions in active facilities: share of each loan's balance and the payments received. */
export function positions() {
  return POS.map((p) => {
    const f = fromLoan(p.sym);
    const share = p.qty / f.principal!;
    const r = f.rate / 12;
    // Interest and principal per payment, from the balance before each payment.
    let b = f.size;
    const payments = f.history!.map((h) => {
      const interest = b * r;
      const principal = h.due - interest;
      b -= principal;
      return { date: h.date, interest: interest * share, principal: principal * share, total: h.due * share };
    });
    return {
      f,
      qty: p.qty,
      share,
      payments,
      receivedTotal: payments.reduce((a, x) => a + x.total, 0),
      next: { date: mon(LOANS[p.sym].firstPay, f.paid!, true), amount: f.monthly! * share },
    };
  });
}

export const statusLine = (f: Facility) =>
  f.phase === 'open'
    ? `${pct(f.committed!, 0)} committed · closes ${fmtD(f.closes!)}`
    : f.phase === 'conditions'
      ? `Fully committed · conditions ${f.conds!.filter(Boolean).length}/6`
      : f.status;

export { MILESTONES };
