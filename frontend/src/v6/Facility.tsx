import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { COND, POS } from '../demo/data';
import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, num, pct, usd, usdK } from '../lib/format';
import { facilities, MIN_COMMIT, MILESTONES, type Facility } from '../demo/facilities';
import { Chip, Rate } from './Shell';

/** Facility detail: figures, then terms, drawdown, performance, security, covenants and documents; commit box aside. */
export function V6Facility() {
  const { sym = '' } = useParams();
  const { issues } = useDemo();
  const f = facilities(issues).all.find((x) => x.sym === sym);

  if (!f) {
    return (
      <main className="mk6-w mk6-main">
        <div className="mk6-gate">
          <h2>Facility not found</h2>
          <p>{sym} is not on the platform.</p>
          <Link className="mk6-btn" to="/v6/facilities">
            Back to facilities
          </Link>
        </div>
      </main>
    );
  }

  const active = f.phase === 'performing' || f.phase === 'drawdown';
  const op = f.kind === 'Operating';

  return (
    <main className="mk6-w mk6-detail">
      <Link className="mk6-back" to="/v6/facilities">
        <i className="ph ph-arrow-left"></i>Facilities
      </Link>

      <header className="mk6-dh">
        <Chip model={f.model} size="lg" />
        <div>
          <p className="mk6-eyebrow">
            {f.sym} · {f.kind} facility
          </p>
          <h1>{f.name}</h1>
          <p>
            {f.gpu} · {f.site}
          </p>
        </div>
        <span className={`mk6-tag ${f.tone}`}>{f.status}</span>
      </header>

      <dl className="mk6-figs">
        <div>
          <dt>{active ? 'Principal outstanding (USD)' : 'Facility size (USD)'}</dt>
          <dd>{num(Math.round(active ? f.principal! : f.size))}</dd>
          {active ? <small>of {num(f.size)}</small> : null}
        </div>
        <div>
          <dt>Interest rate</dt>
          <dd>
            <Rate r={f.rate} suffix=" fixed" />
          </dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{f.term} months</dd>
          {f.matures ? <small>Matures {f.matures}</small> : null}
        </div>
        <div>
          <dt>{f.ratioLabel}</dt>
          <dd>{pct(f.ratio, 0)}</dd>
          <small>{op ? 'Appraisal + reserve ÷ balance' : 'Loan ÷ total project cost'}</small>
        </div>
        {f.cov ? (
          <div>
            <dt>Coverage, last month</dt>
            <dd className={f.cov < 1.25 ? 'warn' : ''}>{f.cov.toFixed(2)}×</dd>
            <small>Cure trigger 1.15×</small>
          </div>
        ) : (
          <div>
            <dt>{f.phase === 'drawdown' ? 'Drawn' : 'Committed'}</dt>
            <dd>{f.phase === 'drawdown' ? pct(f.principal! / f.size, 0) : pct(f.committed!, 0)}</dd>
            <small>
              {f.phase === 'drawdown' ? `Milestone ${f.drawn} of ${MILESTONES.length}` : `of ${usdK(f.size)}`}
            </small>
          </div>
        )}
      </dl>

      <div className="mk6-dbody">
        <div className="mk6-dmain">
          <Section title="Summary of terms">
            <dl className="mk6-kv">
              <KV k="Borrower" v={f.borrower} />
              <KV k="Offtaker" v={f.offtaker} />
              <KV k="Seniority" v="Senior secured, first lien" />
              <KV k="Facility size" v={usd(f.size)} />
              <KV k="Interest rate" v={<Rate r={f.rate} suffix=" fixed, paid monthly" />} />
              <KV
                k="Repayment"
                v={op ? 'Level monthly payments of principal and interest' : 'Interest-only during build, then level monthly'}
              />
              <KV k={op ? 'Equipment appraisal' : 'Total project cost'} v={usd(f.basis)} />
              <KV k={op ? 'Cash reserve' : 'Interest reserve'} v={`${usd(Math.round(f.reserve))}${op ? ' · 3 months' : ''}`} />
              {f.closes ? <KV k="Commitments close" v={`${fmtD(f.closes)}, 5:00 pm ET`} /> : null}
              {f.deadline ? <KV k="Drawdown deadline" v={`${fmtD(f.deadline)} · refunded in full if missed`} /> : null}
              {f.released ? <KV k="Drawn" v={fmtD(f.released)} /> : null}
              <KV k="Minimum commitment" v={`${num(MIN_COMMIT)} AIUSD`} />
              <KV k="Transfers" v="Held to maturity; not transferable in v1" />
            </dl>
          </Section>

          {op ? (
            <Section
              title="Drawdown conditions"
              note={
                active
                  ? 'All six signed and recorded on-chain before the loan was drawn.'
                  : 'Funds stay in escrow until all six are signed. If they are not met by the deadline, every commitment is refunded.'
              }
            >
              <ol className="mk6-steps">
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
              note="Four milestones, each signed by the independent engineer. Cost overruns are funded by the sponsor before the next draw."
            >
              <ol className="mk6-steps">
                {MILESTONES.map(([m, s], i) => {
                  const done = i < (f.drawn ?? 0);
                  // A milestone is only under way once the facility has started drawing.
                  const now = f.phase === 'drawdown' && i === f.drawn;
                  return (
                    <li key={m} className={done ? 'done' : now ? 'now' : ''}>
                      <i>{done ? <span className="ph ph-check"></span> : i + 1}</i>
                      <span>
                        <b>{m}</b>
                        <small>{pct(s, 0)} of the facility · {usd(f.size * s)}</small>
                      </span>
                      <em>{done ? 'Drawn' : now ? 'In progress' : 'Pending'}</em>
                    </li>
                  );
                })}
              </ol>
            </Section>
          )}

          {f.history ? (
            <Section title="Performance" note="Rent collected into the collection contract against scheduled debt service.">
              <div className="mk6-bars" role="img" aria-label="Coverage by month">
                {/* Scale: 1.00× at the baseline, 1.40× at the top. */}
                <div className="plot">
                  {f.history.map((h) => {
                    const c = h.got / h.due;
                    return (
                      <div key={h.date} title={`${fmtD(h.date)}: ${c.toFixed(2)}×`}>
                        <span>{c.toFixed(2)}×</span>
                        <i style={{ height: `${Math.min(100, Math.max(4, ((c - 1) / 0.4) * 100))}%` }}></i>
                      </div>
                    );
                  })}
                  <u style={{ bottom: `${((1.15 - 1) / 0.4) * 100}%` }}>
                    <em>Cure 1.15×</em>
                  </u>
                </div>
                <div className="lbls">
                  {f.history.map((h) => (
                    <small key={h.date}>
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}
                    </small>
                  ))}
                </div>
              </div>
              <table className="mk6-table">
                <thead>
                  <tr>
                    <th>Payment date</th>
                    <th className="r">Scheduled</th>
                    <th className="r">Rent collected</th>
                    <th className="r">Coverage</th>
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
                      <td className="r">{(h.got / h.due).toFixed(2)}×</td>
                      <td className="r">{h.up.toFixed(1)}%</td>
                      <td className="r">
                        <TxLink seed={`${f.sym}-pay-${f.history!.length - 1 - i}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          <Section title="Security package" note="Enforced in this order on default; proceeds go to lenders first.">
            <ol className="mk6-layers">
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
              ).map(([t, v, d]) => (
                <li key={t}>
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
            <dl className="mk6-kv">
              {(op
                ? [
                    ['Maximum LTV', '80% at drawdown; above 85% on revaluation requires a top-up within 60 days'],
                    ['Minimum coverage', '1.15×; below it starts a 30-day cure period, then default'],
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
            <dl className="mk6-kv">
              <KV k="Escrow and collection" v="One escrow and one collection contract for this facility" />
              <KV k="Legal counsel" v="Named in the data room" />
              <KV k={op ? 'Appraiser' : 'Independent engineer'} v="Named in the data room" />
              <KV k="Lien registration" v={f.filing ?? 'Filed at drawdown'} />
              <KV k="Equipment monitoring" v="Independent monitoring nodes" />
            </dl>
          </Section>

          <Section title="Documents">
            <Docs f={f} />
          </Section>
        </div>

        <aside className="mk6-daside">
          <Commit f={f} />
          <div className="mk6-desk">
            <b>Questions on this facility?</b>
            <p>Our capital markets desk answers diligence questions within one business day.</p>
            <DeskButton />
          </div>
        </aside>
      </div>
    </main>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mk6-sec">
      <header>
        <h2>{title}</h2>
        {note ? <p>{note}</p> : null}
      </header>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
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
      <ul className="mk6-docs">
        {docs.map(([t, d]) => (
          <li key={t}>
            <button type="button" onClick={ok ? () => toast(`${t} (demo)`) : onGate}>
              <i className="ph ph-file-text"></i>
              <span>
                <b>{t}</b>
                <small>
                  {d} · hash on-chain
                </small>
              </span>
              <i className={`ph ${ok ? 'ph-download-simple' : 'ph-lock-simple'}`}></i>
            </button>
          </li>
        ))}
      </ul>
      {ok ? null : <p className="mk6-note">Documents open to verified lenders under NDA.</p>}
    </>
  );
}

function DeskButton() {
  const { ok, toast } = useDemo();
  const onGate = useGateClick();
  return (
    <button type="button" className="mk6-btn ghost" onClick={ok ? () => toast('Call request sent (demo)') : onGate}>
      Schedule a call
    </button>
  );
}

/** Commit box for open facilities; position or status for the others. */
function Commit({ f }: { f: Facility }) {
  const { ok, access, bal, subscribe, withdraw, toast } = useDemo();
  const onGate = useGateClick();
  const go = useNavigate();
  const [amount, setAmount] = useState(0);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  if (f.phase === 'performing' || f.phase === 'drawdown') {
    const pos = POS.find((p) => p.sym === f.sym);
    return (
      <div className="mk6-box">
        <h3>{pos && ok ? 'Your position' : 'Not open for commitments'}</h3>
        {pos && ok ? (
          <dl className="mk6-kv tight">
            <KV k="Principal" v={usd(pos.qty)} />
            <KV k="Share of facility" v={pct(pos.qty / f.principal!, 1)} />
            <KV k="Next payment" v={`est. ${usd(Math.round((f.monthly ?? 0) * (pos.qty / f.principal!)))}`} />
          </dl>
        ) : (
          <p>This facility is fully drawn. Transfers between lenders are planned for a later release.</p>
        )}
        <Link className="mk6-btn ghost wide" to="/v6/portfolio">
          View portfolio
        </Link>
      </div>
    );
  }

  const left = Math.round(f.size * (1 - f.committed!));
  if (f.phase === 'conditions') {
    return (
      <div className="mk6-box">
        <h3>Fully committed</h3>
        <p>
          The loan draws when all six conditions are signed. If they are not met by {fmtD(f.deadline!)}, every commitment
          is refunded in full.
        </p>
        {ok && f.mine ? (
          <dl className="mk6-kv tight">
            <KV k="Your commitment" v={`${usd(f.mine)} · in escrow`} />
          </dl>
        ) : null}
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="mk6-box">
        <h3>Commit to this facility</h3>
        <p>
          {access === 'pending'
            ? 'Your business verification is in review. You can commit as soon as it is approved.'
            : 'Open to verified institutional lenders. Interest rate, full terms and documents appear after verification.'}
        </p>
        {access === 'pending' ? null : (
          <button type="button" className="mk6-btn wide" onClick={onGate}>
            {access === 'public' ? 'Request access' : 'Verify your business'}
          </button>
        )}
      </div>
    );
  }

  const monthlyInterest = amount * (f.rate / 12);
  let label = `Commit ${num(amount)} AIUSD`;
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
    if (fund) return go('/v6/fund-account');
    const n = amount;
    setBusy(true);
    setTimeout(() => {
      if (f.live) subscribe(f.sym, n);
      toast(`Committed ${num(n)} AIUSD to ${f.sym}; held in escrow until drawdown (demo)`);
      setBusy(false);
      setAmount(0);
      setAck(false);
    }, 800);
  };

  return (
    <div className="mk6-box">
      <h3>Commit to this facility</h3>
      <div className="mk6-avail">
        <span>Available</span>
        <b>{num(bal)} AIUSD</b>
      </div>
      {f.mine ? (
        <div className="mk6-mine">
          <span>
            Your commitment <b>{usd(f.mine)}</b>
          </span>
          <button type="button" onClick={() => withdraw(f.sym)}>
            Withdraw
          </button>
        </div>
      ) : null}
      <label className="mk6-input">
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
      <div className="mk6-quick">
        {[100000, 250000, 500000].map((q) => (
          <button key={q} type="button" onClick={() => setAmount(q)}>
            {usdK(q)}
          </button>
        ))}
      </div>
      <dl className="mk6-kv tight">
        <KV k="Remaining capacity" v={`${num(left)} AIUSD`} />
        <KV k="Est. monthly interest" v={amount ? usd(Math.round(monthlyInterest)) : '—'} />
        <KV k="Withdrawable until" v={fmtD(f.closes!)} />
      </dl>
      <label className="mk6-ack">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I have read the term sheet, credit agreement and risk disclosures.</span>
      </label>
      <button type="button" className="mk6-btn wide" disabled={busy || !(ready || fund)} onClick={submit}>
        {label}
      </button>
      <p className="mk6-fine">
        Funds move to this facility's escrow contract, not to Loka Capital. Refunded in full if the facility does not
        draw.
      </p>
    </div>
  );
}
