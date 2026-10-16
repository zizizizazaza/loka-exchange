import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { Server3D } from '../../components/Server3D';
import { useDemo } from '../../demo/state';
import { COND, isOpen, MIN_SUB, mo, nDone, type NewIssue, nState } from '../../demo/data';
import { TxLink } from '../../demo/ui';
import { useGateClick } from '../../demo/useGateClick';
import { fmtD, num, pct, usd, withArticle } from '../../lib/format';
import { InvestPanel, type InvestOptions } from './InvestPanel';

const TODAY = new Date('2026-10-12T00:00:00');
const AS_OF = 'Oct 12, 2026, 00:00 UTC';

const SECTIONS: [string, string][] = [
  ['terms', 'Key terms'],
  ['collateral', 'Collateral and cash flow'],
  ['conditions', 'Release conditions'],
  ['documents', 'Documents'],
  ['contracts', 'Contracts'],
  ['notes', 'Notes'],
];

/**
 * #/asset-v2/<sym>: a second take on the new-issue page for review against the original (#/asset/<sym>), in a more
 * institutional style: one type scale, exact figures with sources, small radii, tables for conditions and documents.
 * Same data and subscription flow as NewIssueDetail; styles are scoped under .v2 (src/styles/v2.css).
 */
export function NewIssueDetailV2({ n, tab }: { n: NewIssue; tab: string }) {
  const { ok, subscribe, withdraw } = useDemo();
  const navigate = useNavigate();
  const onGate = useGateClick();
  const o = isOpen(n);
  const raised = n.amt * n.sub;
  const left = Math.max(0, Math.round(n.amt - raised));
  const done = nDone(n);
  const ltv = n.amt / n.appraisal;
  const days = Math.max(0, Math.round((new Date(n.closes + 'T00:00:00').getTime() - TODAY.getTime()) / 864e5));
  const p = mo(n.amt, n.rate, n.term);
  const fee = Math.round(n.rent * 0.02);
  const op = Math.round(n.rent - p - fee);
  const focus = tab === 'subscribe';

  useEffect(() => {
    if (focus)
      navigate(`/asset-v2/${n.sym}`, {
        replace: true,
        preventScrollReset: true,
      });
  }, [focus, n.sym, navigate]);

  const io: InvestOptions = {
    title: 'Subscribe',
    min: Math.min(MIN_SUB, left),
    max: left,
    quick: [100000, 250000, 500000, 'max'],
    mine: n.mine,
    rows: [
      ['Rate', `${pct(n.rate, 2)} fixed · ${n.term} months`],
      [
        'Funds go to',
        <>
          Escrow <TxLink seed={n.sym + 'esc'} />
        </>,
      ],
    ],
    calcLabel: 'Expected monthly payment',
    calc: (a) => usd(Math.round(mo(a, n.rate, n.term))),
    ack: 'I have read the term sheet and the risk disclosure',
    cta: 'Subscribe',
    note: 'Signed with your wallet. AIUSD moves from your account to the escrow contract.',
    withdraw: () => withdraw(n.sym),
    done: (a) => subscribe(n.sym, a),
    toast: (a) => `Subscribed ${num(a)} AIUSD to ${n.sym}. Held in escrow until release (demo)`,
  };

  const jump = (id: string) =>
    document.getElementById(`v2-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const locked = (
    <button type="button" className="v2-lock" onClick={onGate}>
      <i className="ph ph-lock-simple"></i>Verified investors
    </button>
  );

  return (
    <div className="xwrap v2">
      <div className="v2-crumb">
        <Link to="/markets">Markets</Link>
        <span>/</span>
        <span>{n.sym}</span>
        <Link className="v2-switch" to={`/asset/${n.sym}`}>
          View the original layout
        </Link>
      </div>

      <div className="v2-top">
        <header className="v2-head">
          <div className="v2-eye">
            <span>Senior secured compute loan</span>
            <span>New issue</span>
            <span>{n.sym}</span>
          </div>
          <h1>{n.name}</h1>
          <p className="v2-meta">
            {n.gpu} · {n.site} · Offtake: {n.buyer}, {n.offtake} months
          </p>
          <div className="v2-status">
            <span className={`v2-pill ${o ? 'live' : 'wait'}`}>{nState(n)}</span>
            <span className="v2-asof">As of {AS_OF} · sample data</span>
          </div>
        </header>
        <div className="v2-art">
          <Server3D />
          <small>Illustration · {parseInt(n.gpu, 10) / 8} servers × 8 GPUs · drag to rotate</small>
        </div>
      </div>

      <dl className="v2-kpis">
        <div>
          <dt>
            Fixed rate<sup>1</sup>
          </dt>
          <dd>{ok ? <span className="v2-num">{pct(n.rate, 2)}</span> : locked}</dd>
          <small>Paid monthly · {n.term} months</small>
        </div>
        <div>
          <dt>Raising</dt>
          <dd className="v2-num">{usd(n.amt)}</dd>
          <small>Senior, single tranche</small>
        </div>
        <div>
          <dt>Subscribed</dt>
          <dd className="v2-num">{usd(Math.round(raised))}</dd>
          <small>{pct(n.sub, 1)} of target</small>
        </div>
        <div>
          <dt>{o ? 'Subscriptions close' : 'Release deadline'}</dt>
          <dd className="v2-num">{fmtD(o ? n.closes : n.deadline)}</dd>
          <small>{o ? `${days} days left` : `${done} of 6 conditions met`}</small>
        </div>
        <div>
          <dt>
            Loan to value<sup>2</sup>
          </dt>
          <dd className="v2-num">{pct(ltv, 1)}</dd>
          <small>Limit 80.0%</small>
        </div>
        <div>
          <dt>
            Rent coverage<sup>3</sup>
          </dt>
          <dd className="v2-num">{(n.rent / p).toFixed(2)}×</dd>
          <small>Cure trigger 1.15×</small>
        </div>
      </dl>

      <div className="v2-body">
        <main className="v2-main">
          <nav className="v2-nav" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <button key={id} type="button" onClick={() => jump(id)}>
                {label}
              </button>
            ))}
          </nav>

          <Section id="progress" title={o ? 'Subscription progress' : 'Release progress'}>
            <div className="v2-progress">
              <div className="v2-bar" role="img" aria-label={`${pct(n.sub, 1)} subscribed`}>
                <i style={{ width: `${n.sub * 100}%` }}></i>
              </div>
              <div className="v2-bar-legend">
                <span>
                  Subscribed <b className="v2-num">{usd(Math.round(raised))}</b>
                </span>
                <span>
                  Remaining <b className="v2-num">{usd(left)}</b>
                </span>
                <span>
                  Target <b className="v2-num">{usd(n.amt)}</b>
                </span>
              </div>
              <ol className="v2-steps">
                <Step state="done" title="Subscriptions open" sub={fmtD(n.opened)} />
                <Step
                  state={o ? 'now' : 'done'}
                  title="Fully subscribed"
                  sub={o ? `By ${fmtD(n.closes)}` : fmtD(n.full!)}
                />
                <Step state={o ? 'todo' : 'now'} title="Six conditions signed" sub={`${done} of 6`} />
                <Step state="todo" title="Funds released" sub={`By ${fmtD(n.deadline)}`} />
                <Step state="todo" title="First payment" sub="A month after release" />
              </ol>
            </div>
          </Section>

          <Section id="terms" title="Key terms">
            {ok ? (
              <dl className="v2-terms">
                <Term k="Instrument">Senior secured loan to a bankruptcy-remote SPV</Term>
                <Term k="Borrower">Single-purpose company owning the GPUs</Term>
                <Term k="Principal">
                  <span className="v2-num">{usd(n.amt)}</span>
                </Term>
                <Term k="Interest">
                  <span className="v2-num">{pct(n.rate, 2)}</span> fixed, level monthly payments
                </Term>
                <Term k="Term">{n.term} months from release</Term>
                <Term k="Minimum subscription">
                  <span className="v2-num">{usd(MIN_SUB)}</span>
                </Term>
                <Term k="Subscription window">
                  {fmtD(n.opened)} to {fmtD(n.closes)}
                </Term>
                <Term k="Release deadline">{fmtD(n.deadline)}; full refund if conditions are not met</Term>
                <Term k="Collateral">{n.gpu}; SPV equity pledged</Term>
                <Term k="Reserve">
                  3 months, <span className="v2-num">{usd(Math.round(p * 3))}</span>, funded at release
                </Term>
                <Term k="Allocation">First come, first served</Term>
                <Term k="Withdrawals">Until fully subscribed or the window closes</Term>
                <Term k="Eligible investors">Verified institutional investors</Term>
                <Term k="Settlement">AIUSD, redeemable 1:1 for USDC</Term>
              </dl>
            ) : (
              <div className="v2-gate">
                <p>Rate, full terms and documents are shown to verified institutional investors.</p>
                <button type="button" className="v2-btn" onClick={onGate}>
                  Get access
                </button>
              </div>
            )}
          </Section>

          <Section id="collateral" title="Collateral and cash flow">
            <div className="v2-two">
              <div className="v2-card">
                <h3>Collateral</h3>
                <p className="v2-card-sub">
                  Appraisal <span className="v2-num">{usd(n.appraisal)}</span>
                  <sup>2</sup>
                </p>
                <div className="v2-stack" role="img" aria-label={`Loan ${pct(ltv, 1)} of appraisal; limit 80%`}>
                  <i className="a" style={{ width: `${ltv * 100}%` }}></i>
                  <i className="b" style={{ width: `${(1 - ltv) * 100}%` }}></i>
                  <u style={{ left: '80%' }}></u>
                </div>
                <table className="v2-mini">
                  <tbody>
                    <Row k="Loan" swatch="a" v={usd(n.amt)} pc={pct(ltv, 1)} />
                    <Row k="Operator equity, first loss" swatch="b" v={usd(n.appraisal - n.amt)} pc={pct(1 - ltv, 1)} />
                    <Row k="Maximum loan allowed" swatch="lim" v={usd(Math.round(n.appraisal * 0.8))} pc="80.0%" />
                  </tbody>
                </table>
              </div>
              <div className="v2-card">
                <h3>Expected monthly cash flow</h3>
                <p className="v2-card-sub">
                  Rent <span className="v2-num">{usd(n.rent)}</span>, from the month after release
                </p>
                <div className="v2-stack" role="img" aria-label="Rent split: holders, fee, operator">
                  <i className="a" style={{ width: `${(p / n.rent) * 100}%` }}></i>
                  <i className="c" style={{ width: `${(fee / n.rent) * 100}%` }}></i>
                  <i className="b" style={{ width: `${(op / n.rent) * 100}%` }}></i>
                </div>
                <table className="v2-mini">
                  <tbody>
                    <Row k={`1 · ${n.sym} holders`} swatch="a" v={usd(Math.round(p))} pc={pct(p / n.rent, 1)} />
                    <Row k="2 · Service fee" swatch="c" v={usd(fee)} pc={pct(fee / n.rent, 1)} />
                    <Row k="3 · Operator, the rest" swatch="b" v={usd(op)} pc={pct(op / n.rent, 1)} />
                  </tbody>
                </table>
              </div>
            </div>
          </Section>

          <Section id="conditions" title="Release conditions" aside={`${done} of 6 recorded`}>
            <table className="v2-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Condition</th>
                  <th>Signed by</th>
                  <th>Status</th>
                  <th>Record</th>
                </tr>
              </thead>
              <tbody>
                {COND.map(([t, by], i) => (
                  <tr key={t}>
                    <td className="v2-num">{i + 1}</td>
                    <td>{t}</td>
                    <td className="v2-dim">{by}</td>
                    <td>
                      {n.cd[i] ? (
                        <span className="v2-tag ok">Recorded {fmtD(n.cd[i]!)}</span>
                      ) : (
                        <span className="v2-tag">{i === 0 ? `${pct(n.sub, 1)} subscribed` : 'Waiting'}</span>
                      )}
                    </td>
                    <td>{n.cd[i] ? <TxLink seed={n.sym + 'c' + i} /> : <span className="v2-dim">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="v2-note">
              Conditions can be signed in any order while the issue is open. Funds move only when all six are recorded;
              otherwise every subscriber is refunded on {fmtD(n.deadline)}.
            </p>
          </Section>

          <Section id="documents" title="Documents" aside="Each file's hash is recorded on-chain">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Issued by</th>
                  <th>Date</th>
                  <th>Hash</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Term sheet', 'Loka', n.opened],
                    ['Appraisal report', 'Independent appraiser', n.opened],
                    ['Offtake agreement, summary', 'Operator', n.opened],
                    ['Risk disclosure', 'Loka', n.opened],
                  ] as const
                ).map(([t, by, d]) => (
                  <tr key={t}>
                    <td>
                      <i className="ph-light ph-file-pdf"></i> {t}
                    </td>
                    <td className="v2-dim">{by}</td>
                    <td className="v2-dim v2-num">{fmtD(d)}</td>
                    <td>
                      <TxLink seed={n.sym + t} />
                    </td>
                    <td className="v2-r">{ok ? <DownloadBtn /> : locked}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section id="contracts" title="Contracts">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Address</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Escrow</td>
                  <td>
                    <TxLink seed={n.sym + 'esc'} />
                  </td>
                  <td className="v2-dim">
                    Holds <span className="v2-num">{usd(Math.round(raised))}</span> in subscriptions
                  </td>
                </tr>
                <tr>
                  <td>Collection</td>
                  <td>
                    <TxLink seed={n.sym + 'col'} />
                  </td>
                  <td className="v2-dim">Receives rent after release and pays holders first</td>
                </tr>
                <tr>
                  <td>{n.sym} token</td>
                  <td>
                    <TxLink seed={n.sym + 'tok'} />
                  </td>
                  <td className="v2-dim">Issued to subscribers at release; transfers limited to verified holders</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section id="about" title="About this loan">
            <p className="v2-prose">
              {n.name} is a new senior secured loan to a single-purpose company that owns {n.gpu} in {n.site}. The GPUs
              are installed and rented to {withArticle(n.buyer[0].toLowerCase() + n.buyer.slice(1))} under a {n.offtake}
              -month offtake contract. Subscriptions wait in an escrow contract and are released only after all six
              conditions are signed and recorded on-chain.
            </p>
          </Section>

          <Section id="notes" title="Notes">
            <ol className="v2-notes">
              <li>
                Fixed for the life of the loan; level monthly payments of principal and interest over {n.term} months.
              </li>
              <li>
                Principal divided by the appraised value of the GPUs, <span className="v2-num">{usd(n.appraisal)}</span>
                , by an independent appraiser. The loan may not exceed 80% of appraisal.
              </li>
              <li>
                Monthly rent under the offtake contract divided by the scheduled payment to holders. Below 1.15× for a
                month, the operator must cure from the reserve or add collateral.
              </li>
              <li>All figures as of {AS_OF}. Sample data for the prototype; not an offer.</li>
            </ol>
          </Section>
        </main>

        <aside className="v2-side">
          <div className="v2-panel">
            {o ? <InvestPanel o={io} focus={focus} /> : <Closed n={n} ok={ok} done={done} />}
          </div>
          <dl className="v2-facts">
            <Fact k="Operator">GPU operator, {n.site.split(',')[0]}</Fact>
            <Fact k="Offtake buyer">{n.buyer}</Fact>
            <Fact k="Offtake remaining">{n.offtake} months</Fact>
            <Fact k="Appraiser">Independent, named in the report</Fact>
            <Fact k="Escrow">
              <TxLink seed={n.sym + 'esc'} />
            </Fact>
            <Fact k="Settlement">AIUSD · 1:1 USDC</Fact>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Section({ id, title, aside, children }: { id: string; title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="v2-sec" id={`v2-${id}`}>
      <div className="v2-sec-h">
        <h2>{title}</h2>
        {aside ? <span>{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Step({ state, title, sub }: { state: 'done' | 'now' | 'todo'; title: string; sub: string }) {
  return (
    <li className={state}>
      <i></i>
      <b>{title}</b>
      <small>{sub}</small>
    </li>
  );
}

function Term({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Row({ k, swatch, v, pc }: { k: string; swatch: string; v: string; pc: string }) {
  return (
    <tr>
      <td>
        <i className={`v2-sw ${swatch}`}></i>
        {k}
      </td>
      <td className="v2-num v2-r">{v}</td>
      <td className="v2-num v2-r v2-dim">{pc}</td>
    </tr>
  );
}

function DownloadBtn() {
  const { toast } = useDemo();
  return (
    <button type="button" className="v2-link" onClick={() => toast('Download (demo)')}>
      Download
    </button>
  );
}

function Closed({ n, ok, done }: { n: NewIssue; ok: boolean; done: number }) {
  return (
    <div className="inv">
      <div className="inv-h">
        <b>Subscription closed</b>
      </div>
      <p className="inv-p">
        Fully subscribed on {fmtD(n.full!)}. Waiting for {6 - done} of 6 release conditions.
      </p>
      {ok && n.mine ? (
        <div className="inv-mine">
          <span>Your subscription</span>
          <b className="num">{usd(n.mine)}</b>
          <small>Locked until release</small>
        </div>
      ) : null}
    </div>
  );
}
