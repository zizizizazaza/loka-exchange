import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';

import '../styles/markets-v5.css';

import { bal, COND, isOpen, LOANS, M, mo, nDone, pmt } from '../demo/data';
import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, mon, pct, usd, usdM } from '../lib/format';
import { BUILD_ACTIVE, BUILD_OPEN, drawnShare, MILESTONES } from './facilitySamples';

// Fifth take on Markets (#/markets-v5): an institutional portal in the manner of iCapital, Carta and Marquee.
// Table first, documents first: a pipeline and an active book, each row opening a detail pane with terms, security
// package, covenants, counterparties and documents. No slogans, countdowns or one-click "Lend"; the actions are
// "Request allocation" and "Open data room". PRD v0.3 wording. The page draws its own header and hides the shared one
// while open, so no other page changes. Styles scoped under .mk5.

type Tone = 'live' | 'wait' | 'build' | 'ok';
type Kind = 'Operating' | 'Construction';

interface Fac {
  sym: string;
  name: string;
  kind: Kind;
  borrower: string;
  offtaker: string;
  site: string;
  gpu: string;
  size: number;
  rate: number;
  term: number;
  ratio: number;
  ratioLabel: 'OC' | 'LTC';
  stage: string;
  tone: Tone;
  open?: boolean;
  committed?: number;
  close?: string;
  closeLabel?: string;
  conds?: (string | null)[];
  balance?: number;
  dscr?: number;
  paid?: [number, number];
  history?: { date: string; due: number; got: number }[];
  drawn?: number;
  mine?: number;
  report?: string;
}

const pipelineDocs = (kind: Kind): [string, string][] => [
  ['Term sheet', 'v3 · Oct 02, 2026'],
  ['Credit agreement', 'Draft · Oct 08, 2026'],
  [kind === 'Operating' ? 'Equipment appraisal' : 'Independent engineer report', 'Sep 24, 2026'],
  ['Offtake contract summary', 'Sep 18, 2026'],
  ['Legal opinion', 'Pending'],
];
const activeDocs = (f: Fac): [string, string][] => [
  ['Monthly servicer report', f.report ?? 'Oct 05, 2026'],
  ['Credit agreement', 'Executed'],
  [f.kind === 'Operating' ? 'Equipment appraisal' : 'Independent engineer report', 'Latest'],
  ['Lien registration', 'Filed'],
];

export function MarketsV5() {
  const { ok, issues, access, toast, bal: aiusd } = useDemo();
  const onGate = useGateClick();
  const [tab, setTab] = useState<'pipeline' | 'active'>('pipeline');
  const [sel, setSel] = useState<string>('FRA-H100');

  useEffect(() => {
    document.body.classList.add('mk5-page');
    return () => document.body.classList.remove('mk5-page');
  }, []);

  // Pipeline: open for commitments or waiting on drawdown conditions.
  const pipeline: Fac[] = [
    ...issues.map((n): Fac => {
      const o = isOpen(n);
      const p = mo(n.amt, n.rate, n.term);
      return {
        sym: n.sym,
        name: n.name,
        kind: 'Operating',
        borrower: `${n.name.split(' ')[0]} compute SPV`,
        offtaker: `${n.buyer}, ${n.offtake}-month contract`,
        site: n.site,
        gpu: n.gpu,
        size: n.amt,
        rate: n.rate,
        term: n.term,
        ratio: (n.appraisal + 3 * p) / n.amt,
        ratioLabel: 'OC',
        stage: o ? 'Open for commitments' : `Conditions ${nDone(n)}/6`,
        tone: o ? 'live' : 'wait',
        open: o,
        committed: n.sub,
        close: o ? n.closes : n.deadline,
        closeLabel: o ? 'Commitments close' : 'Drawdown deadline',
        conds: n.cd,
        mine: n.mine,
      };
    }),
    {
      sym: BUILD_OPEN.sym,
      name: BUILD_OPEN.name,
      kind: 'Construction',
      borrower: 'Abilene compute SPV · sponsor equity 40%',
      offtaker: 'Pre-signed compute contract, 36 months',
      site: BUILD_OPEN.site,
      gpu: BUILD_OPEN.gpu,
      size: BUILD_OPEN.amt,
      rate: BUILD_OPEN.rate,
      term: BUILD_OPEN.term,
      ratio: BUILD_OPEN.amt / BUILD_OPEN.cost,
      ratioLabel: 'LTC',
      stage: 'Open for commitments',
      tone: 'live',
      open: true,
      committed: BUILD_OPEN.sub,
      close: BUILD_OPEN.closes,
      closeLabel: 'Commitments close',
      drawn: 0,
    },
  ];

  // Active book: performing operating loans and the construction loan in drawdown.
  const active: Fac[] = [
    ...M.filter((m) => m.cat === 'credit' && LOANS[m.sym]).map((m): Fac => {
      const l = LOANS[m.sym];
      const k = l.got.length;
      const p = pmt(l);
      const out = bal(l, k);
      return {
        sym: m.sym,
        name: m.name,
        kind: 'Operating',
        borrower: `${m.name.split(' ')[0]} compute SPV`,
        offtaker: `${l.buyer}, ${l.offtake}-month contract`,
        site: m.loan!.site,
        gpu: m.loan!.gpu,
        size: l.amount,
        rate: l.rate,
        term: l.term,
        ratio: (l.appraisal + 3 * p) / out,
        ratioLabel: 'OC',
        stage: 'Performing',
        tone: 'ok',
        balance: out,
        dscr: l.got.at(-1)! / p,
        paid: [k, l.term],
        history: l.got.map((g, i) => ({ date: mon(l.firstPay, i, true), due: p, got: g })).reverse(),
        report: fmtD(mon(l.firstPay, k - 1, true)),
      };
    }),
    {
      sym: BUILD_ACTIVE.sym,
      name: BUILD_ACTIVE.name,
      kind: 'Construction',
      borrower: 'Phoenix compute SPV · sponsor equity 42%',
      offtaker: 'Model training lab, 30-month contract (signed)',
      site: BUILD_ACTIVE.site,
      gpu: BUILD_ACTIVE.gpu,
      size: BUILD_ACTIVE.amt,
      rate: BUILD_ACTIVE.rate,
      term: BUILD_ACTIVE.term,
      ratio: BUILD_ACTIVE.amt / BUILD_ACTIVE.cost,
      ratioLabel: 'LTC',
      stage: `Drawdown ${BUILD_ACTIVE.drawn} of ${MILESTONES.length}`,
      tone: 'build',
      balance: BUILD_ACTIVE.amt * drawnShare(BUILD_ACTIVE.drawn),
      drawn: BUILD_ACTIVE.drawn,
      report: 'Oct 01, 2026',
    },
  ];

  const all = [...pipeline, ...active];
  const f = all.find((x) => x.sym === sel) ?? pipeline[0];
  const rows = tab === 'pipeline' ? pipeline : active;
  const pick = (t: 'pipeline' | 'active') => {
    setTab(t);
    setSel((t === 'pipeline' ? pipeline : active)[0].sym);
  };

  const ops = active.filter((x) => x.kind === 'Operating');
  const outstanding = active.reduce((a, x) => a + (x.balance ?? 0), 0);
  const opsOut = ops.reduce((a, x) => a + x.balance!, 0);
  const wOc = ops.reduce((a, x) => a + x.balance! * x.ratio, 0) / opsOut;
  const wDscr = ops.reduce((a, x) => a + x.balance! * x.dscr!, 0) / opsOut;
  const payments = ops.reduce((a, x) => a + x.paid![0], 0);
  const asOf = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Sample lender account (verified view): the prototype's positions and escrowed commitments.
  const myCommitted = issues.reduce((a, n) => a + n.mine, 0);
  const myFunded = 395265;

  const restricted = (
    <button type="button" className="mk5-restricted" onClick={onGate} title="Shown to verified lenders">
      <i className="ph ph-lock-simple"></i>Restricted
    </button>
  );

  const exportCsv = () => {
    const head = ['Facility', 'Type', 'Size', 'Rate', 'Tenor (mo)', 'Ratio', 'Stage'];
    const lines = rows.map((x) =>
      [x.sym, x.kind, x.size, x.rate, x.term, `${x.ratioLabel} ${(x.ratio * 100).toFixed(0)}%`, x.stage].join(','),
    );
    const url = URL.createObjectURL(new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `loka-facilities-${tab}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mk5">
      <div className="mk5-preview">
        <span>Preview · v5 institutional portal</span>
        <Link to="/markets">Current</Link>
        <Link to="/markets-v4">v4</Link>
      </div>

      <header className="mk5-top">
        <a className="mk5-brand" href="../index.html" title="Back to site">
          <span className="brand-mark" aria-hidden="true"></span>Loka Capital
        </a>
        <nav aria-label="Main">
          <NavLink to="/markets-v5">Facilities</NavLink>
          <NavLink to="/portfolio">Portfolio</NavLink>
          <NavLink to="/deposit">Fund account</NavLink>
          <NavLink to="/issue">Borrow</NavLink>
        </nav>
        <div className="mk5-right">
          <AccountMenu />
        </div>
      </header>

      <div className="mk5-page-h">
        <div>
          <h1>Facilities</h1>
          <p>Senior secured credit to operating and under-construction compute centers · Data as of {asOf}</p>
        </div>
        <div className="mk5-tools">
          <button type="button" className="mk5-btn ghost" onClick={ok ? exportCsv : onGate}>
            <i className="ph ph-download-simple"></i>Export CSV
          </button>
          <button type="button" className="mk5-btn ghost" onClick={ok ? () => toast('Monthly report (demo)') : onGate}>
            <i className="ph ph-file-text"></i>Monthly report
          </button>
        </div>
      </div>

      {ok ? (
        <section className="mk5-acct" aria-label="Your account">
          <div>
            <dt>Commitments in escrow</dt>
            <dd>{usd(myCommitted)}</dd>
          </div>
          <div>
            <dt>Funded, outstanding</dt>
            <dd>{usd(myFunded)}</dd>
          </div>
          <div>
            <dt>Available to commit</dt>
            <dd>{usd(aiusd)}</dd>
          </div>
          <div>
            <dt>Next distribution</dt>
            <dd>
              {fmtD('2026-11-05')}
              <small>NH200-1 · est. {usd(Math.round(myFunded * 0.0383))}</small>
            </dd>
          </div>
          <div className="mk5-desk">
            <dt>Capital markets desk</dt>
            <dd>
              <button type="button" className="mk5-link" onClick={() => toast('Call request sent (demo)')}>
                Schedule a call
              </button>
              <small>Response within one business day</small>
            </dd>
          </div>
        </section>
      ) : (
        <section className="mk5-notice">
          <i className="ph ph-info"></i>
          <p>
            {access === 'pending'
              ? 'Your business verification is in review. Interest rates, documents and allocations open once it is approved.'
              : 'You are viewing public facility data. Interest rates, full terms, documents and allocations require a verified institutional account.'}
          </p>
          {access === 'pending' ? null : (
            <button type="button" className="mk5-btn" onClick={onGate}>
              {access === 'public' ? 'Request access' : 'Verify your business'}
            </button>
          )}
        </section>
      )}

      <dl className="mk5-kpis">
        <div>
          <dt>Outstanding</dt>
          <dd>{usd(Math.round(outstanding))}</dd>
        </div>
        <div>
          <dt>Active facilities</dt>
          <dd>{active.length}</dd>
        </div>
        <div>
          <dt>Weighted OC, operating</dt>
          <dd>{pct(wOc, 0)}</dd>
        </div>
        <div>
          <dt>Weighted DSCR, last month</dt>
          <dd>{wDscr.toFixed(2)}×</dd>
        </div>
        <div>
          <dt>Payments missed</dt>
          <dd>
            0 <small>of {payments}</small>
          </dd>
        </div>
        <div>
          <dt>Realized losses</dt>
          <dd>{usd(0)}</dd>
        </div>
      </dl>

      <div className="mk5-body">
        <section className="mk5-main">
          <div className="mk5-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'pipeline'} onClick={() => pick('pipeline')}>
              Pipeline <span>{pipeline.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={tab === 'active'} onClick={() => pick('active')}>
              Active <span>{active.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={false} disabled>
              Repaid <span>0</span>
            </button>
          </div>

          <div className="mk5-table-wrap">
            {tab === 'pipeline' ? (
              <table className="mk5-table">
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th>Type</th>
                    <th className="r">Size</th>
                    <th className="r">Committed</th>
                    <th className="r">Rate</th>
                    <th className="r">Tenor</th>
                    <th className="r">OC / LTC</th>
                    <th>Stage</th>
                    <th className="r">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.map((x) => (
                    <tr key={x.sym} aria-selected={x.sym === f.sym} onClick={() => setSel(x.sym)}>
                      <td>
                        <button type="button" className="mk5-fac" onClick={() => setSel(x.sym)}>
                          <b>{x.name}</b>
                          <span>
                            {x.sym} · {x.site}
                          </span>
                        </button>
                      </td>
                      <td>{x.kind}</td>
                      <td className="r">{usdM(x.size)}</td>
                      <td className="r">{pct(x.committed!, 0)}</td>
                      <td className="r">{ok ? pct(x.rate, 2) : <span className="mk5-dash">—</span>}</td>
                      <td className="r">{x.term} mo</td>
                      <td className="r">
                        {pct(x.ratio, 0)} <small>{x.ratioLabel}</small>
                      </td>
                      <td>
                        <Stage f={x} />
                      </td>
                      <td className="r">{fmtD(x.close!)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="mk5-table">
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th>Type</th>
                    <th className="r">Balance</th>
                    <th className="r">Rate</th>
                    <th className="r">Payments</th>
                    <th className="r">DSCR</th>
                    <th className="r">OC / LTC</th>
                    <th>Status</th>
                    <th className="r">Last report</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((x) => (
                    <tr key={x.sym} aria-selected={x.sym === f.sym} onClick={() => setSel(x.sym)}>
                      <td>
                        <button type="button" className="mk5-fac" onClick={() => setSel(x.sym)}>
                          <b>{x.name}</b>
                          <span>
                            {x.sym} · {x.site}
                          </span>
                        </button>
                      </td>
                      <td>{x.kind}</td>
                      <td className="r">{usd(Math.round(x.balance!))}</td>
                      <td className="r">{ok ? pct(x.rate, 2) : <span className="mk5-dash">—</span>}</td>
                      <td className="r">{x.paid ? `${x.paid[0]} / ${x.paid[1]}` : 'Interest-only'}</td>
                      <td className={`r ${x.dscr && x.dscr < 1.25 ? 'warn' : ''}`}>
                        {x.dscr ? `${x.dscr.toFixed(2)}×` : '—'}
                      </td>
                      <td className="r">
                        {pct(x.ratio, 0)} <small>{x.ratioLabel}</small>
                      </td>
                      <td>
                        <Stage f={x} />
                      </td>
                      <td className="r">{x.report}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mk5-note">
            OC = (equipment appraisal + cash reserve) ÷ balance. LTC = loan ÷ total project cost. DSCR = rent collected ÷
            scheduled debt service; below 1.15× starts a 30-day cure period. All facilities are senior secured, first
            lien, held to maturity.
          </p>
        </section>

        <aside className="mk5-pane" aria-label={`${f.name} details`}>
          <div className="mk5-pane-h">
            <div>
              <span className="mk5-sym">
                {f.sym} · {f.kind}
              </span>
              <h2>{f.name}</h2>
              <p>
                {f.gpu} · {f.site}
              </p>
            </div>
            <Stage f={f} />
          </div>

          <div className="mk5-pane-act">
            {f.open ? (
              ok ? (
                f.kind === 'Operating' ? (
                  <Link className="mk5-btn" to={`/asset/${f.sym}/subscribe`}>
                    Request allocation
                  </Link>
                ) : (
                  <button type="button" className="mk5-btn" onClick={() => toast('Allocation request (demo)')}>
                    Request allocation
                  </button>
                )
              ) : (
                <button type="button" className="mk5-btn" onClick={onGate}>
                  Request allocation
                </button>
              )
            ) : null}
            <button type="button" className="mk5-btn ghost" onClick={ok ? () => toast('Data room (demo)') : onGate}>
              <i className={`ph ${ok ? 'ph-folder-open' : 'ph-lock-simple'}`}></i>Open data room
            </button>
            <button type="button" className="mk5-btn ghost" onClick={ok ? () => toast('Question sent (demo)') : onGate}>
              Ask a question
            </button>
          </div>
          {ok && f.mine ? <p className="mk5-mine">Your commitment: {usd(f.mine)} in escrow</p> : null}

          <h3>Summary of terms</h3>
          <dl className="mk5-kv">
            <div>
              <dt>Borrower</dt>
              <dd>{f.borrower}</dd>
            </div>
            <div>
              <dt>Offtaker</dt>
              <dd>{f.offtaker}</dd>
            </div>
            <div>
              <dt>Facility size</dt>
              <dd>{usd(f.size)}</dd>
            </div>
            {f.balance !== undefined ? (
              <div>
                <dt>Balance</dt>
                <dd>{usd(Math.round(f.balance))}</dd>
              </div>
            ) : null}
            <div>
              <dt>Interest rate</dt>
              <dd>{ok ? `${pct(f.rate, 2)} fixed` : restricted}</dd>
            </div>
            <div>
              <dt>Tenor</dt>
              <dd>
                {f.term} months
                {f.kind === 'Construction' ? ', interest-only during build' : ', amortizing monthly'}
              </dd>
            </div>
            <div>
              <dt>Seniority</dt>
              <dd>Senior secured, first lien</dd>
            </div>
            <div>
              <dt>{f.ratioLabel === 'OC' ? 'Over-collateralization' : 'Loan to cost'}</dt>
              <dd>{pct(f.ratio, 0)}</dd>
            </div>
            {f.close ? (
              <div>
                <dt>{f.closeLabel}</dt>
                <dd>{fmtD(f.close)}, 5:00 pm ET</dd>
              </div>
            ) : null}
            {f.committed !== undefined ? (
              <div>
                <dt>Committed</dt>
                <dd>
                  {usd(Math.round(f.size * f.committed))} ({pct(f.committed, 0)})
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Minimum commitment</dt>
              <dd>100,000 AIUSD</dd>
            </div>
          </dl>

          {f.conds ? (
            <>
              <h3>Drawdown conditions</h3>
              <table className="mk5-mini">
                <tbody>
                  {COND.map(([c, who], i) => (
                    <tr key={c}>
                      <td>
                        <i className={`mk5-ck ${f.conds![i] ? 'on' : ''}`}></i>
                        {c}
                        <small>{who}</small>
                      </td>
                      <td className="r">{f.conds![i] ? fmtD(f.conds![i]!) : 'Open'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {f.kind === 'Construction' ? (
            <>
              <h3>Drawdown schedule</h3>
              <table className="mk5-mini">
                <tbody>
                  {MILESTONES.map(([m, s], i) => (
                    <tr key={m}>
                      <td>
                        <i className={`mk5-ck ${i < (f.drawn ?? 0) ? 'on' : ''}`}></i>
                        {i + 1}. {m}
                        <small>Signed by independent engineer</small>
                      </td>
                      <td className="r">
                        {pct(s, 0)} · {usdM(f.size * s)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {f.history ? (
            <>
              <h3>Payment history</h3>
              <table className="mk5-mini">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="r">Scheduled</th>
                    <th className="r">Rent collected</th>
                    <th className="r">DSCR</th>
                  </tr>
                </thead>
                <tbody>
                  {f.history.slice(0, 6).map((h) => (
                    <tr key={h.date}>
                      <td>{fmtD(h.date)}</td>
                      <td className="r">{usd(Math.round(h.due))}</td>
                      <td className="r">{usd(h.got)}</td>
                      <td className="r">{(h.got / h.due).toFixed(2)}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          <h3>Security package</h3>
          <ol className="mk5-sec">
            {(f.kind === 'Operating'
              ? [
                  ['First-priority lien on GPU equipment', 'Independent appraisal · counts toward OC'],
                  ['Assignment of lease receivables', 'Paid into the collection contract'],
                  ['Pledge of SPV equity', 'Step-in right on default'],
                  ['Cash reserve, 3 months of debt service', 'Held in the collection contract · counts toward OC'],
                ]
              : [
                  ['Assignment of equipment purchase contracts', 'Converts to a first-priority lien on delivery'],
                  ['Assignment of compute contract receivables', 'Paid into the collection contract'],
                  ['Pledge of SPV equity', 'Step-in right on default'],
                  ['Sponsor completion guarantee', 'Cost overruns funded by the sponsor'],
                  ['Interest reserve for the build period', 'Held in the collection contract'],
                ]
            ).map(([t, d]) => (
              <li key={t}>
                <b>{t}</b>
                <span>{d}</span>
              </li>
            ))}
          </ol>

          <h3>Covenants</h3>
          <dl className="mk5-kv">
            {(f.kind === 'Operating'
              ? [
                  ['Maximum LTV', '80% at drawdown; above 85% on revaluation requires top-up within 60 days'],
                  ['Minimum DSCR', '1.15×; 30-day cure period, then default'],
                  ['Cash reserve', '3 months of debt service, replenished before borrower distributions'],
                  ['Rent', 'Paid by the offtaker to the controlled account only'],
                ]
              : [
                  ['Maximum LTC', '60%; sponsor equity funded first'],
                  ['Milestones', 'Each draw signed by the independent engineer; 60-day delay limit'],
                  ['Cost overruns', 'Funded by the sponsor before the next draw'],
                  ['Conversion', 'Amortizing from first rent received'],
                ]
            ).map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>

          <h3>Counterparties</h3>
          <dl className="mk5-kv">
            {[
              ['Escrow and collection', 'Facility contracts on-chain, one per facility'],
              ['Legal counsel', 'Named in the data room'],
              [f.kind === 'Operating' ? 'Appraiser' : 'Independent engineer', 'Named in the data room'],
              ['Equipment monitoring', 'Independent monitoring nodes'],
              ['Recovery partner', 'Named in the credit agreement'],
            ].map(([t, d]) => (
              <div key={t}>
                <dt>{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>

          <h3>Documents</h3>
          <ul className="mk5-docs">
            {(f.balance !== undefined ? activeDocs(f) : pipelineDocs(f.kind)).map(([t, d]) => (
              <li key={t}>
                <button type="button" onClick={ok ? () => toast(`${t} (demo)`) : onGate}>
                  <i className="ph ph-file-pdf"></i>
                  <span>
                    <b>{t}</b>
                    <small>{d}</small>
                  </span>
                  <i className={`ph ${ok ? 'ph-download-simple' : 'ph-lock-simple'}`}></i>
                </button>
              </li>
            ))}
          </ul>
          {ok ? null : <p className="mk5-note">Documents open to verified lenders under NDA.</p>}
        </aside>
      </div>

      <footer className="mk5-foot">
        <p>
          Offered to verified institutional lenders only. Facilities are illiquid, held to maturity, and can lose value;
          interest is not guaranteed. Loka Capital does not lend, pool or hold lender funds; amounts are denominated in
          AIUSD, redeemable 1:1 for USDC. Design prototype with sample data and placeholder counterparties.
        </p>
      </footer>
    </div>
  );
}

function Stage({ f }: { f: Fac }) {
  return <span className={`mk5-stage ${f.tone}`}>{f.stage}</span>;
}

/** Header account area: the organization, not a wallet. Same access states as the shared header. */
function AccountMenu() {
  const { access, loading, signIn, signOut, sessionError } = useDemo();
  const onGate = useGateClick();
  if (loading) return null;
  if (sessionError)
    return (
      <button className="mk5-btn ghost" type="button" onClick={signOut}>
        Sign out
      </button>
    );
  if (access === 'public')
    return (
      <>
        <button className="mk5-hlink" type="button" onClick={signIn}>
          Sign in
        </button>
        <button className="mk5-btn" type="button" onClick={onGate}>
          Request access
        </button>
      </>
    );
  const org = access === 'verified' ? 'Northbridge Capital LP' : 'Your organization';
  const role = { unverified: 'Not verified', pending: 'Verification in review', verified: 'Admin · 3 users' }[access];
  return (
    <button className="mk5-org" type="button" onClick={signOut} title="Sign out">
      <span className="mk5-av">{org[0]}</span>
      <span>
        <b>{org}</b>
        <small className={access === 'verified' ? '' : 'wait'}>{role}</small>
      </span>
    </button>
  );
}

