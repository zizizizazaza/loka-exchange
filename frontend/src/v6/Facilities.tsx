import { useNavigate } from 'react-router';

import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';
import { num, pct } from '../lib/format';
import { facilities, statusLine } from '../demo/facilities';
import { Chip, Rate } from './Shell';

/** Facilities list: open facilities as cards, active facilities as a list. Details live on the facility page. */
export function V6Facilities() {
  const { ok, issues } = useDemo();
  const onGate = useGateClick();
  const go = useNavigate();
  const { open, active } = facilities(issues);

  const outstanding = active.reduce((a, f) => a + f.principal!, 0);
  const payments = active.reduce((a, f) => a + (f.paid ?? 0), 0);
  const asOf = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const to = (sym: string) => () => go(`/v6/facility/${sym}`);
  const enter = (sym: string) => (e: React.KeyboardEvent) => e.key === 'Enter' && go(`/v6/facility/${sym}`);

  return (
    <>
      <section className="mk6-hero">
        <div className="mk6-w">
          <div>
            <h1>Private credit for AI infrastructure</h1>
            <p>Senior secured loans to operating and under-construction compute centers.</p>
          </div>
          <dl>
            <div>
              <dt>Outstanding (USD)</dt>
              <dd>{num(Math.round(outstanding))}</dd>
            </div>
            <div>
              <dt>Facilities</dt>
              <dd>{open.length + active.length}</dd>
            </div>
            <div>
              <dt>Missed payments</dt>
              <dd>0</dd>
            </div>
          </dl>
        </div>
      </section>

      <main className="mk6-w mk6-main">
        <section>
          <header className="mk6-h">
            <h2>Open for commitments</h2>
            <p>Each facility has its own escrow. Funds draw only after every condition is signed on-chain.</p>
          </header>
          <div className="mk6-cards">
            {open.map((f) => (
              <article key={f.sym} className="mk6-card" onClick={to(f.sym)} onKeyDown={enter(f.sym)} tabIndex={0}>
                <div className="mk6-card-h">
                  <Chip model={f.model} />
                  <h3>{f.name}</h3>
                  <span className="mk6-sym">{f.sym}</span>
                </div>
                <dl className="mk6-big">
                  <div>
                    <dt>Facility size (USD)</dt>
                    <dd>{num(f.size)}</dd>
                  </div>
                  <div>
                    <dt>Interest rate</dt>
                    <dd>
                      <Rate r={f.rate} />
                    </dd>
                  </div>
                </dl>
                <dl className="mk6-rows">
                  <div>
                    <dt>Facility type</dt>
                    <dd>{f.kind}</dd>
                  </div>
                  <div>
                    <dt>Term</dt>
                    <dd>{f.term} months</dd>
                  </div>
                  <div>
                    <dt>{f.ratioLabel}</dt>
                    <dd>{pct(f.ratio, 0)}</dd>
                  </div>
                  <div>
                    <dt>Min. commitment</dt>
                    <dd>100K USD</dd>
                  </div>
                </dl>
                <p className={`mk6-status ${f.tone}`}>{statusLine(f)}</p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <header className="mk6-h">
            <h2>Active facilities</h2>
            <p>Repaid monthly from contracted rent. Every payment is recorded on-chain.</p>
          </header>
          <div className="mk6-list" role="table" aria-label="Active facilities">
            <div className="mk6-li mk6-li-h" role="row">
              <span role="columnheader">Facility</span>
              <span role="columnheader">Principal (USD)</span>
              <span role="columnheader">Interest rate</span>
              <span role="columnheader">Coverage</span>
              <span role="columnheader">Status</span>
            </div>
            {active.map((f) => (
              <div key={f.sym} className="mk6-li" role="row" onClick={to(f.sym)} onKeyDown={enter(f.sym)} tabIndex={0}>
                <span className="mk6-fac" role="cell">
                  <Chip model={f.model} size="sm" />
                  <span>
                    <b>
                      {f.name}
                      <em>
                        {f.model} [{f.count}]
                      </em>
                    </b>
                    <small>
                      {f.site} · matures {f.matures}
                    </small>
                  </span>
                </span>
                <span className="mk6-num" role="cell">
                  {num(Math.round(f.principal!))}
                  <small>of {num(f.size)}</small>
                </span>
                <span className="mk6-num" role="cell">
                  {ok ? pct(f.rate, 1) : <i className="ph ph-lock-simple mk6-lock" title="Verified lenders"></i>}
                </span>
                <span className="mk6-num" role="cell">
                  {f.cov ? (
                    <span className={f.cov < 1.25 ? 'warn' : ''}>{f.cov.toFixed(2)}×</span>
                  ) : (
                    <>
                      —<small>Interest reserve</small>
                    </>
                  )}
                </span>
                <span role="cell">
                  <span className={`mk6-tag ${f.tone}`}>{f.status}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mk6-note">
            {payments} monthly payments received, none missed. Coverage is rent collected ÷ scheduled debt service; the
            cure trigger is 1.15×. Data as of {asOf}.
            {ok ? null : (
              <>
                {' '}
                <button type="button" onClick={onGate}>
                  Request access
                </button>{' '}
                to see interest rates and documents.
              </>
            )}
          </p>
        </section>
      </main>
    </>
  );
}
