import { Link } from 'react-router';

import { Server3D } from '../components/Server3D';
import { facilities, MILESTONES, type Facility } from '../demo/facilities';
import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, num, pct, usd, usdM } from '../lib/format';
import { AS_OF, Locked, Rate, Status } from './Shell';
import { stateOf } from './state';

// Facilities (#/v7/facilities): the PRD v0.3 list (3.4) — open facilities with size, rate, term, stage,
// over-collateralization or loan to cost, and closing date; active facilities with balance, coverage and status —
// for both facility types (4.2) and their states (4.4).

const POINTS: [string, string][] = [
  ['Its own escrow', 'One escrow contract per facility. Loka Capital never holds lender funds.'],
  [
    'Conditions before every drawdown',
    'Six signed conditions for operating facilities; four engineer-signed milestones for construction.',
  ],
  ['Lenders paid first', 'Rent goes to a collection contract; lenders are paid before the borrower.'],
  ['Senior secured', 'First lien on GPUs or equipment contracts, receivables, SPV equity and a reserve.'],
];

export function V7Facilities() {
  const { ok, issues } = useDemo();
  const { open, active } = facilities(issues);
  const perf = active.filter((f) => f.phase === 'performing');
  const out = active.reduce((a, f) => a + f.principal!, 0);
  const perfOut = perf.reduce((a, f) => a + f.principal!, 0);
  const paid = perf.reduce((a, f) => a + f.paid!, 0);
  const cure = perf.filter((f) => f.cov! < 1.15).length;
  const avail = open.filter((f) => f.phase === 'open');

  return (
    <>
      <section className="mk7-hero">
        <div className="mk7-w">
          <div className="mk7-hero-top">
            <div>
              <p className="mk7-eye">Facilities · As of {fmtD(AS_OF)}</p>
              <h1>Private credit for AI infrastructure</h1>
              <p className="mk7-lead">
                Senior secured loans to operating and under-construction compute centers, backed by GPUs, contracts and
                rent.
              </p>
            </div>
            <div className="mk7-art">
              <Server3D tone="dark" />
            </div>
          </div>
          <dl className="mk7-stats">
            <div>
              <dt>Principal outstanding</dt>
              <dd>{usdM(out)}</dd>
              <small>{active.length} active facilities</small>
            </div>
            <div>
              <dt>Weighted interest rate</dt>
              <dd className="brand">{ok ? pct(active.reduce((a, f) => a + f.principal! * f.rate, 0) / out) : <Locked />}</dd>
              <small>By principal outstanding</small>
            </div>
            <div>
              <dt>DSCR, last month</dt>
              <dd>{(perf.reduce((a, f) => a + f.principal! * f.cov!, 0) / perfOut).toFixed(2)}×</dd>
              <small>Covenant minimum 1.15×</small>
            </div>
            <div>
              <dt>Monthly payments</dt>
              <dd>
                {paid} of {paid}
              </dd>
              <small>Received on schedule · none missed</small>
            </div>
          </dl>
        </div>
      </section>

      <section className="mk7-sec">
        <div className="mk7-w">
          <header className="mk7-sh">
            <h2>Open for commitments</h2>
            <p className="mk7-eye">
              {avail.length} open · {usdM(avail.reduce((a, f) => a + f.size * (1 - f.committed!), 0))} available
            </p>
          </header>
          <div className="mk7-open">
            {open.map((f) => (
              <OpenCard f={f} key={f.sym} />
            ))}
          </div>
        </div>
      </section>

      <section className="mk7-sec">
        <div className="mk7-w">
          <header className="mk7-sh">
            <h2>Active facilities</h2>
            <p className="mk7-eye">
              {perf.length - cure} performing · {active.length - perf.length} drawing ·{' '}
              {cure ? `${cure} in cure` : 'none in cure'}
            </p>
          </header>
          <div className="mk7-tbl">
            <div className="mk7-row hd">
              <span>Facility</span>
              <span className="r">Principal (USD)</span>
              <span className="r">Interest rate</span>
              <span className="r">Remaining term</span>
              <span className="r">DSCR</span>
              <span className="r">OC / LTC</span>
              <span>Status</span>
              <span></span>
            </div>
            {active.map((f) => {
              const op = f.kind === 'Operating';
              const [st, tone] = stateOf(f);
              return (
                <Link className="mk7-row" to={`/v7/facility/${f.sym}`} title={`${f.name} details`} key={f.sym}>
                  <span className="mk7-fac">
                    <b>{f.name}</b>
                    <small>
                      {f.sym} · {f.site}
                    </small>
                  </span>
                  <span className="r">
                    {num(Math.round(f.principal!))}
                    <small>of {num(f.size)}</small>
                  </span>
                  <span className="r">
                    <Rate r={f.rate} d={1} compact />
                  </span>
                  <span className="r">
                    {op ? f.term - f.paid! : f.term} months
                    <small>Matures {f.matures}</small>
                  </span>
                  {op ? (
                    <span className={`r ${f.cov! < 1.25 ? 'warn' : ''}`}>{f.cov!.toFixed(2)}×</span>
                  ) : (
                    <span className="r">
                      —<small>In build</small>
                    </span>
                  )}
                  <span className="r">
                    {pct(f.ratio, 0)}
                    <small>{op ? 'OC' : 'LTC'}</small>
                  </span>
                  <span>
                    <Status tone={tone}>{st}</Status>
                    <small>{op ? `Payment ${f.paid} of ${f.term}` : 'Interest-only'}</small>
                  </span>
                  <span className="go" aria-hidden="true">
                    <i className="ph ph-arrow-right"></i>
                  </span>
                </Link>
              );
            })}
          </div>
          <p className="mk7-fine">
            DSCR is last month's rent over scheduled debt service; amber below 1.25×. OC is the equipment appraisal plus
            the cash reserve, over principal outstanding; LTC is the loan over total project cost.
          </p>
        </div>
      </section>

      <section className="mk7-sec">
        <div className="mk7-w">
          <header className="mk7-sh">
            <h2>How every facility is structured</h2>
          </header>
          <ol className="mk7-pts">
            {POINTS.map(([t, d], i) => (
              <li key={t}>
                <span className="mk7-eye">{String(i + 1).padStart(2, '0')}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}

function OpenCard({ f }: { f: Facility }) {
  const { ok } = useDemo();
  const onGate = useGateClick();
  const o = f.phase === 'open';
  const op = f.kind === 'Operating';
  const [st, tone] = stateOf(f);
  return (
    <article className="mk7-card">
      <div className="mk7-card-top">
        <p className="mk7-eye">
          {f.kind} · {f.sym}
        </p>
        <Status tone={tone}>{st}</Status>
      </div>
      <h3>
        <Link to={`/v7/facility/${f.sym}`}>{f.name}</Link>
      </h3>
      <p className="mk7-meta">
        {f.gpu} · {f.site}
      </p>
      <dl className="mk7-figs">
        <div>
          <dt>Facility size</dt>
          <dd>{usd(f.size)}</dd>
        </div>
        <div>
          <dt>Interest rate</dt>
          <dd className="brand">
            <Rate r={f.rate} compact />
          </dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{f.term} months</dd>
        </div>
        <div>
          <dt>{f.ratioLabel}</dt>
          <dd>{pct(f.ratio, 0)}</dd>
        </div>
      </dl>
      <div className="mk7-meter">
        <div className="mk7-meter-l">
          <span>{o ? `${pct(f.committed!, 0)} committed` : 'Fully committed'}</span>
          <span>{o ? `${usd(f.size * (1 - f.committed!))} available` : `Drawdown by ${fmtD(f.deadline!)}`}</span>
        </div>
        <div className="mk7-bar">
          <i style={{ width: `${f.committed! * 100}%` }}></i>
        </div>
      </div>
      <dl className="mk7-kv">
        {o ? (
          <div>
            <dt>Commitments close</dt>
            {/* 17:00 US Eastern on the closing date (PRD 4.5.2). */}
            <dd>{fmtD(f.closes!)}, 17:00 ET</dd>
          </div>
        ) : null}
        <div>
          <dt>Drawdown</dt>
          <dd>{op ? 'Single draw, six conditions' : `${MILESTONES.length} milestones`}</dd>
        </div>
        {ok && f.mine ? (
          <div>
            <dt>Your lending commitment</dt>
            <dd>{usd(f.mine)} · in escrow</dd>
          </div>
        ) : null}
      </dl>
      <div className="mk7-act">
        {o ? (
          ok ? (
            <Link className="btn btn-primary btn-sm" to={`/v7/facility/${f.sym}`}>
              Lend
            </Link>
          ) : (
            <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
              Lend
            </button>
          )
        ) : null}
        <Link className="mk7-more" to={`/v7/facility/${f.sym}`}>
          {o ? 'View facility' : 'View conditions'}
          <i className="ph ph-arrow-right" aria-hidden="true"></i>
        </Link>
      </div>
    </article>
  );
}
