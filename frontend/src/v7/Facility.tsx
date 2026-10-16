import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Server3D } from '../components/Server3D';
import { COND, POS } from '../demo/data';
import { facilities, MIN_COMMIT, MILESTONES, netReturn, type Facility, type Payment } from '../demo/facilities';
import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, num, pct, usd, usdK } from '../lib/format';
import { stateOf } from './state';
import { AS_OF, KV, Rate, Section, Status } from './Shell';

// Facility detail (#/v7/facility/:sym), PRD v0.3 3.4: summary, risk (security layers, over-collateralization or LTC,
// coverage, reserve, covenants), construction milestones, the lending box, documents, repayment record and on-chain
// record. Logic follows the v6 page (src/v6/Facility.tsx); the hero follows the original detail page.

export function V7Facility() {
  const { sym = '' } = useParams();
  const { issues } = useDemo();
  const f = facilities(issues).all.find((x) => x.sym === sym);

  if (!f) {
    return (
      <main className="mk7-w mk7-main">
        <div className="mk7-gate">
          <h2>Facility not found</h2>
          <p>{sym} is not on the platform.</p>
          <Link className="btn btn-primary btn-sm" to="/v7/facilities">
            Back to facilities
          </Link>
        </div>
      </main>
    );
  }

  const active = f.phase === 'performing' || f.phase === 'drawdown';
  const op = f.kind === 'Operating';
  const [st, tone] = stateOf(f);
  const servers = Math.round(parseInt(f.count.replace(/,/g, ''), 10) / 8);

  return (
    <main className="mk7-w mk7-main">
      <Link className="mk7-back" to="/v7/facilities">
        <i className="ph ph-arrow-left" aria-hidden="true"></i>Facilities
      </Link>

      <section className="mk7-dh">
        <div className="mk7-dh-l">
          <div>
            <p className="mk7-eye">
              {f.kind} facility · {f.sym}
            </p>
            <h1>{f.name}</h1>
            <p className="mk7-dh-meta">
              <span>
                <i className="ph-light ph-cpu" aria-hidden="true"></i>
                {f.gpu}
              </span>
              <span>
                <i className="ph-light ph-map-pin" aria-hidden="true"></i>
                {f.site}
              </span>
              <span>
                <i className="ph-light ph-handshake" aria-hidden="true"></i>
                {f.offtaker}
              </span>
            </p>
            <p className="mk7-dh-st">
              <Status tone={tone}>{st}</Status>
              <small>As of {fmtD(AS_OF)} · sample data</small>
            </p>
          </div>
          <dl className="mk7-dh-k">
            <div>
              <dt>{active ? 'Principal outstanding' : 'Facility size'}</dt>
              <dd>{usd(Math.round(active ? f.principal! : f.size))}</dd>
              <small>{active ? `of ${usd(f.size)}` : `Min. ${num(MIN_COMMIT)} AIUSD`}</small>
            </div>
            <div>
              <dt>Interest rate</dt>
              <dd className="brand">
                <Rate r={f.rate} />
              </dd>
              <small>{op ? 'Fixed, paid monthly' : 'Interest-only for now'}</small>
            </div>
            <div>
              <dt>Term</dt>
              <dd>{f.term} months</dd>
              <small>{f.matures ? `Matures ${f.matures}` : op ? 'Level monthly' : 'Amortizing after build'}</small>
            </div>
            <div>
              <dt>{f.ratioLabel}</dt>
              <dd>{pct(f.ratio, 0)}</dd>
              <small>{op ? 'Appraisal + reserve' : 'Loan ÷ project cost'}</small>
            </div>
            <div>
              {f.cov ? (
                <>
                  <dt>DSCR, last month</dt>
                  <dd>{f.cov.toFixed(2)}×</dd>
                  <small>Covenant 1.15×</small>
                </>
              ) : f.phase === 'drawdown' ? (
                <>
                  <dt>Drawn</dt>
                  <dd>{pct(f.principal! / f.size, 0)}</dd>
                  <small>
                    Milestone {f.drawn} of {MILESTONES.length}
                  </small>
                </>
              ) : (
                <>
                  <dt>Committed</dt>
                  <dd>{pct(f.committed!, 0)}</dd>
                  <small>
                    {f.phase === 'open' ? `${usdK(f.size * (1 - f.committed!))} available` : 'Waiting for conditions'}
                  </small>
                </>
              )}
            </div>
          </dl>
        </div>
        <div className="mk7-dh-r">
          <Server3D />
          <small>
            Illustration · {servers} servers × 8 GPUs
          </small>
        </div>
      </section>

      <div className="mk7-dbody">
        <div className="mk7-dmain">
          <Section title="Summary of terms">
            <dl className="mk7-tkv">
              <KV k="Borrower" v={f.borrower} />
              <KV k="Offtaker" v={f.offtaker} />
              <KV k="Seniority" v="Senior secured, first lien" />
              <KV k="Facility size" v={usd(f.size)} />
              <KV k="Interest rate" v={<Rate r={f.rate} suffix=" fixed, paid monthly" />} />
              <KV k="Net return to lenders" v={<Rate r={netReturn(f)} suffix=" · no fees charged to lenders" />} />
              <KV
                k="Repayment"
                v={op ? 'Level monthly payments of principal and interest' : 'Interest-only during build, then level monthly'}
              />
              <KV k={op ? 'Equipment appraisal' : 'Total project cost'} v={usd(f.basis)} />
              <KV k={op ? 'Cash reserve' : 'Interest reserve'} v={`${usd(Math.round(f.reserve))}${op ? ' · 3 months' : ' · full build period'}`} />
              {op ? null : (
                <KV k="Lending" v="Committed in full at once; drawn by milestone; undrawn funds stay in escrow" />
              )}
              {f.closes ? <KV k="Commitments close" v={`${fmtD(f.closes)}, 17:00 ET`} /> : null}
              {f.deadline ? <KV k="Drawdown deadline" v={`${fmtD(f.deadline)} · refunded in full if missed`} /> : null}
              {f.released ? <KV k="Drawn" v={fmtD(f.released)} /> : null}
              <KV k="Minimum commitment" v={`${num(MIN_COMMIT)} AIUSD`} />
              <KV k="Transfers" v="Held to maturity; not transferable in v1" />
            </dl>
          </Section>

          {op ? (
            <Section
              title="Drawdown conditions"
              meta={`${(f.conds ?? []).filter(Boolean).length} of 6 signed`}
              note={
                active
                  ? 'All six were signed and recorded on-chain before the loan was drawn.'
                  : 'Funds stay in escrow until all six are signed. If they are not met by the deadline, every commitment is refunded.'
              }
            >
              <ol className="mk7-steps">
                {COND.map(([c, who], i) => {
                  const d = f.conds?.[i];
                  return (
                    <li key={c} className={d ? 'done' : ''}>
                      <i>{d ? <span className="ph ph-check"></span> : i + 1}</i>
                      <span>
                        <b>{c}</b>
                        <small>{who}</small>
                      </span>
                      <em>{d ? fmtD(d) : 'Open'}</em>
                    </li>
                  );
                })}
              </ol>
            </Section>
          ) : (
            <Section
              title="Drawdown schedule"
              meta={`${f.drawn ?? 0} of ${MILESTONES.length} drawn`}
              note="Four milestones, each signed by the independent engineer. Cost overruns are funded by the sponsor before the next draw."
            >
              <ol className="mk7-steps">
                {MILESTONES.map(([m, s], i) => {
                  const done = i < (f.drawn ?? 0);
                  // A milestone is only under way once the facility has started drawing.
                  const now = f.phase === 'drawdown' && i === f.drawn;
                  return (
                    <li key={m} className={done ? 'done' : now ? 'now' : ''}>
                      <i>{done ? <span className="ph ph-check"></span> : i + 1}</i>
                      <span>
                        <b>{m}</b>
                        <small>
                          {pct(s, 0)} of the facility · {usd(f.size * s)}
                        </small>
                      </span>
                      <em>{done ? 'Drawn' : now ? 'In progress' : 'Pending'}</em>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}

          {f.history ? (
            <Section
              title="Performance"
              meta={`Payment ${f.paid} of ${f.term}`}
              note="Rent collected into the collection contract, against scheduled debt service."
            >
              <CoverageChart history={f.history} />
              <div className="mk7-tscroll">
                <table className="mk7-table">
                  <thead>
                    <tr>
                      <th>Payment date</th>
                      <th className="r">Scheduled</th>
                      <th className="r">Rent collected</th>
                      <th className="r">DSCR</th>
                      <th className="r">Uptime</th>
                      <th className="r">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...f.history].reverse().map((h, i) => (
                      <tr key={h.date}>
                        <td>{fmtD(h.date)}</td>
                        <td className="r">{usd(Math.round(h.due))}</td>
                        <td className="r">{usd(h.got)}</td>
                        <td className={`r ${h.got / h.due < 1.25 ? 'warn' : ''}`}>{(h.got / h.due).toFixed(2)}×</td>
                        <td className="r">{h.up.toFixed(1)}%</td>
                        <td className="r">
                          <TxLink seed={`${f.sym}-pay-${f.history!.length - 1 - i}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          <Section title="Security package" note="Enforced in this order on default; proceeds go to lenders first.">
            <ol className="mk7-layers">
              {(op
                ? [
                    ['First-priority lien on GPU equipment', usd(f.basis), 'Independent appraisal · counts toward over-collateralization'],
                    ['Assignment of lease receivables', 'Repayment source', 'Rent paid straight into the collection contract'],
                    ['Pledge of SPV equity', 'Not valued', 'Step-in right on default'],
                    ['Cash reserve, 3 months of debt service', usd(Math.round(f.reserve)), 'Held in the collection contract · counts toward over-collateralization'],
                  ]
                : [
                    ['Assignment of equipment purchase contracts', usd(f.basis), 'Converts to a first-priority lien on delivery'],
                    ['Assignment of compute contract receivables', 'Repayment source', 'Paid into the collection contract'],
                    ['Pledge of SPV equity', 'Not valued', 'Step-in right on default'],
                    ['Sponsor completion guarantee', 'Not valued', 'Sponsor funds cost overruns'],
                    ['Interest reserve for the build period', usd(Math.round(f.reserve)), 'Held in the collection contract'],
                  ]
              ).map(([t, v, d], i) => (
                <li key={t}>
                  <span className="mk7-eye">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <b>{t}</b>
                    <small>{d}</small>
                  </span>
                  <em>{v}</em>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Covenants">
            <dl className="mk7-tkv">
              {(op
                ? [
                    ['Maximum LTV', '80% at drawdown; above 85% on revaluation requires a top-up within 60 days'],
                    ['Minimum DSCR', '1.15×; below it starts a 30-day cure period, then default'],
                    ['Cash reserve', 'Replenished to 3 months before any borrower distribution'],
                    ['Rent routing', 'Paid by the offtaker into the controlled account only'],
                    ['Equipment', 'Monitored online; 7 days offline triggers a remedy notice'],
                  ]
                : [
                    ['Maximum LTC', '60%; sponsor equity of 40% funded first'],
                    ['Milestone delay', 'Up to 60 days per milestone, then further draws stop'],
                    ['Cost overruns', 'Funded by the sponsor within 30 days, before the next draw'],
                    ['Offtake', 'Cancellation stops draws; 90 days to replace the offtaker'],
                    ['Conversion', 'Amortizing from the first rent received'],
                  ]
              ).map(([k, v]) => (
                <KV key={k} k={k} v={v} />
              ))}
            </dl>
          </Section>

          <Section title="Counterparties" note="Placeholder roles in this prototype; named parties sign each step on-chain.">
            <dl className="mk7-tkv">
              <KV k="Escrow and collection" v="One escrow and one collection contract for this facility" />
              <KV k="Legal counsel" v="Named in the data room" />
              <KV k={op ? 'Appraiser' : 'Independent engineer'} v="Named in the data room" />
              <KV k="Lien registration" v={f.filing ?? 'Filed at drawdown'} />
              <KV k="Equipment monitoring" v="Independent monitoring nodes" />
            </dl>
          </Section>

          <OnChain f={f} />

          <Section title="Documents" note="Originals stay with the signer; the hash on-chain shows they have not been altered.">
            <Docs f={f} />
          </Section>
        </div>

        <aside className="mk7-daside">
          <LendBox f={f} />
          <Desk />
        </aside>
      </div>
    </main>
  );
}

/** DSCR by month: a line on one axis (1.00–1.40×) with the covenant line; the payment table below is its table view. */
function CoverageChart({ history }: { history: Payment[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const W = 720;
  const H = 220;
  const L = 48;
  const R = 56;
  const T = 16;
  const B = 30;
  const LO = 1;
  const TOP = 1.4;
  const n = history.length;
  const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - (Math.min(TOP, Math.max(LO, v)) - LO) / (TOP - LO)) * (H - T - B);
  const pts = history.map((h, i) => [x(i), y(h.got / h.due)] as const);
  const step = n === 1 ? W - L - R : (W - L - R) / (n - 1);
  const last = n - 1;
  const month = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });

  return (
    <div className="mk7-chart">
      <div className="mk7-chart-in">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`DSCR by month, latest ${(history[last].got / history[last].due).toFixed(2)}×`}>
          {[1, 1.1, 1.2, 1.3, 1.4].map((t) => (
            <g key={t}>
              <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
              <text className="tick" x={L - 10} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {t.toFixed(2)}×
              </text>
            </g>
          ))}
          <line className="th" x1={L} x2={W - R} y1={y(1.15)} y2={y(1.15)} />
          <text className="th-l" x={L + 6} y={y(1.15) - 7}>
            Covenant 1.15×
          </text>
          {hi !== null ? <line className="cross" x1={pts[hi][0]} x2={pts[hi][0]} y1={T} y2={H - B} /> : null}
          {n > 1 ? <polyline className="ln" points={pts.map((p) => p.join(',')).join(' ')} /> : null}
          {pts.map(([px, py], i) => (
            <circle key={history[i].date} className="pt" cx={px} cy={py} r={hi === i ? 5.5 : 4.5} />
          ))}
          <text className="lbl" x={pts[last][0] + 10} y={pts[last][1]} dominantBaseline="middle">
            {(history[last].got / history[last].due).toFixed(2)}×
          </text>
          {history.map((h, i) => (
            <text key={h.date} className="tick" x={x(i)} y={H - 8} textAnchor="middle">
              {month(h.date)}
            </text>
          ))}
          {/* Hit areas: the full column for each month, keyboard-focusable. */}
          {history.map((h, i) => (
            <rect
              key={h.date}
              className="hit"
              x={x(i) - step / 2}
              y={T}
              width={step}
              height={H - T - B}
              tabIndex={0}
              aria-label={`${fmtD(h.date)}: ${(h.got / h.due).toFixed(2)}×`}
              onMouseEnter={() => setHi(i)}
              onMouseLeave={() => setHi(null)}
              onFocus={() => setHi(i)}
              onBlur={() => setHi(null)}
            />
          ))}
        </svg>
        {hi !== null ? (
          <div className="mk7-tip" style={{ left: `${(pts[hi][0] / W) * 100}%`, top: `${(pts[hi][1] / H) * 100}%` }}>
            <b>{fmtD(history[hi].date)}</b>
            <span>DSCR {(history[hi].got / history[hi].due).toFixed(2)}×</span>
            <span>
              Rent {usd(history[hi].got)} · due {usd(Math.round(history[hi].due))}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Contracts and the latest signed events: conditions, drawdown and payments. */
function OnChain({ f }: { f: Facility }) {
  const events: [string, string, string][] = [];
  f.conds?.forEach((d, i) => {
    if (d) events.push([d, `${COND[i][0]} · signed`, `${f.sym}-cond-${i}`]);
  });
  if (f.released) events.push([f.released, 'Drawdown to the SPV', `${f.sym}-draw`]);
  f.history?.forEach((h, i) => events.push([h.date, `Payment ${i + 1} distributed to lenders`, `${f.sym}-pay-${i}`]));
  events.sort((a, b) => b[0].localeCompare(a[0]));
  const shown = events.slice(0, 8);

  return (
    <Section title="On-chain record" meta={events.length > shown.length ? `Latest ${shown.length} of ${events.length}` : undefined}>
      <dl className="mk7-tkv">
        <KV k="Escrow contract" v={<TxLink seed={`${f.sym}-escrow`} />} />
        <KV k="Collection contract" v={<TxLink seed={`${f.sym}-collect`} />} />
      </dl>
      {shown.length ? (
        <ul className="mk7-events">
          {shown.map(([d, t, seed]) => (
            <li key={seed}>
              <span>{fmtD(d)}</span>
              <b>{t}</b>
              <TxLink seed={seed} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mk7-note">
          {f.kind === 'Construction' && f.drawn
            ? `${f.drawn} milestone draws recorded; each signed by the independent engineer.`
            : 'No events yet. Commitments and signed conditions appear here as they are recorded.'}
        </p>
      )}
    </Section>
  );
}

function Docs({ f }: { f: Facility }) {
  const { ok, toast } = useDemo();
  const onGate = useGateClick();
  const active = f.phase === 'performing' || f.phase === 'drawdown';
  const docs: [string, string][] = [
    ['Term sheet', 'PDF · v3'],
    ['Credit agreement', active ? 'PDF · executed' : 'PDF · draft'],
    [f.kind === 'Operating' ? 'Equipment appraisal' : 'Independent engineer report', 'PDF'],
    ['Offtake contract summary', 'PDF'],
    ['Legal opinion', active ? 'PDF' : 'Pending'],
    ...(active ? ([['Monthly servicer report', 'PDF · latest']] as [string, string][]) : []),
  ];
  return (
    <>
      <ul className="mk7-docs">
        {docs.map(([t, d]) => (
          <li key={t}>
            <button type="button" onClick={ok ? () => toast(`${t} (demo)`) : onGate}>
              <i className="ph-light ph-file-text" aria-hidden="true"></i>
              <span>
                <b>{t}</b>
                <small>{d} · hash on-chain</small>
              </span>
              <i className={`ph ${ok ? 'ph-download-simple' : 'ph-lock-simple'}`} aria-hidden="true"></i>
            </button>
          </li>
        ))}
      </ul>
      {ok ? null : <p className="mk7-fine">Documents open to verified lenders under NDA.</p>}
    </>
  );
}

function Desk() {
  const { ok, toast } = useDemo();
  const onGate = useGateClick();
  return (
    <div className="mk7-box soft">
      <h3>Questions on this facility?</h3>
      <p>Our capital markets desk answers diligence questions within one business day.</p>
      <button type="button" className="btn btn-ghost btn-sm" onClick={ok ? () => toast('Call request sent (demo)') : onGate}>
        Schedule a call
      </button>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mk7-box">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/** Lending box for open facilities; position or status for the others. */
function LendBox({ f }: { f: Facility }) {
  const { ok, access, bal, subscribe, withdraw, toast } = useDemo();
  const onGate = useGateClick();
  const go = useNavigate();
  const [amount, setAmount] = useState(0);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  if (f.phase === 'performing' || f.phase === 'drawdown') {
    const pos = POS.find((p) => p.sym === f.sym);
    return (
      <Box title={pos && ok ? 'Your position' : 'Not open for commitments'}>
        {pos && ok ? (
          <dl className="mk7-kv">
            <KV k="Principal" v={usd(pos.qty)} />
            <KV k="Share of facility" v={pct(pos.qty / f.principal!, 1)} />
            <KV k="Next payment" v={`est. ${usd(Math.round((f.monthly ?? 0) * (pos.qty / f.principal!)))}`} />
          </dl>
        ) : f.phase === 'drawdown' ? (
          <p>
            Fully committed and drawing by milestone. The undrawn {usd(Math.round(f.size - f.principal!))} stays in
            escrow until the next milestones are signed.
          </p>
        ) : (
          <p>This facility is fully drawn. Transfers between lenders are planned for a later release.</p>
        )}
        <Link className="btn btn-ghost btn-sm mk7-wide" to="/v7/portfolio">
          View portfolio
        </Link>
      </Box>
    );
  }

  const left = Math.round(f.size * (1 - f.committed!));
  if (f.phase === 'conditions') {
    return (
      <Box title="Fully committed">
        <p>
          The loan draws when all six conditions are signed. If they are not met by {fmtD(f.deadline!)}, every
          commitment is refunded in full.
        </p>
        {ok && f.mine ? (
          <dl className="mk7-kv">
            <KV k="Your lending commitment" v={`${usd(f.mine)} · in escrow`} />
          </dl>
        ) : null}
      </Box>
    );
  }

  if (!ok) {
    return (
      <Box title="Lend to this facility">
        <p>
          {access === 'pending'
            ? 'Your business verification is in review. You can lend as soon as it is approved.'
            : 'Open to verified institutional lenders. Interest rate, full terms and documents appear after verification.'}
        </p>
        {access === 'pending' ? null : (
          <button type="button" className="btn btn-primary btn-sm mk7-wide" onClick={onGate}>
            {access === 'public' ? 'Request access' : 'Verify your business'}
          </button>
        )}
      </Box>
    );
  }

  let label = `Lend ${num(amount)} AIUSD`;
  let ready = false;
  let fund = false;
  if (busy) label = 'Confirming…';
  else if (!amount) label = 'Enter an amount';
  else if (amount < MIN_COMMIT) label = `Minimum ${num(MIN_COMMIT)} AIUSD`;
  else if (amount > left) label = `Only ${num(left)} AIUSD remaining`;
  else if (amount > bal) {
    label = 'Fund your account first';
    fund = true;
  } else if (!ack) label = 'Confirm you have read the documents';
  else ready = true;

  const submit = () => {
    if (fund) return go('/v7/fund-account');
    const n = amount;
    setBusy(true);
    setTimeout(() => {
      if (f.live) subscribe(f.sym, n);
      toast(`Lending commitment of ${num(n)} AIUSD to ${f.sym}; held in escrow until drawdown (demo)`);
      setBusy(false);
      setAmount(0);
      setAck(false);
    }, 800);
  };

  return (
    <Box title="Lend to this facility">
      <div className="mk7-avail">
        <span>Available</span>
        <b>{num(bal)} AIUSD</b>
      </div>
      {f.mine ? (
        <div className="mk7-mine">
          <span>
            Your lending commitment <b>{usd(f.mine)}</b>
          </span>
          <button type="button" onClick={() => withdraw(f.sym)}>
            Withdraw
          </button>
        </div>
      ) : null}
      <label className="mk7-input">
        <input
          inputMode="numeric"
          placeholder={`${num(MIN_COMMIT)} minimum`}
          aria-label="Amount in AIUSD"
          disabled={busy}
          value={amount ? num(amount) : ''}
          onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
        />
        <span>AIUSD</span>
      </label>
      <div className="mk7-quick">
        {[100000, 250000, 500000].map((q) => (
          <button key={q} type="button" onClick={() => setAmount(q)}>
            {usdK(q)}
          </button>
        ))}
      </div>
      <dl className="mk7-kv">
        <KV k="Remaining capacity" v={`${num(left)} AIUSD`} />
        <KV k="Net return to lenders" v={<span className="mk7-brand">{pct(netReturn(f), 2)} fixed</span>} />
        <KV k="Est. monthly interest" v={amount ? usd(Math.round(amount * (f.rate / 12))) : '—'} />
        <KV k="Withdrawable until" v={`${fmtD(f.closes!)}, 17:00 ET`} />
      </dl>
      <label className="mk7-ack">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I have read the term sheet, credit agreement and risk disclosures.</span>
      </label>
      <button type="button" className="btn btn-primary mk7-wide" disabled={busy || !(ready || fund)} onClick={submit}>
        {label}
      </button>
      <p className="mk7-fine">
        {f.kind === 'Construction'
          ? 'The full amount moves to this facility’s escrow now and is drawn by milestone. Undrawn funds are refunded if the project stops.'
          : 'Funds move to this facility’s escrow contract, not to Loka Capital. Refunded in full if the facility does not draw.'}
      </p>
    </Box>
  );
}
