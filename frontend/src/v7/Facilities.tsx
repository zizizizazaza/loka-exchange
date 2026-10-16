import type { CSSProperties } from 'react';
import { Link } from 'react-router';

import { facilities, type Facility } from '../demo/facilities';
import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, pct, usd, usdM } from '../lib/format';
import { BannerArt } from './BannerArt';
import { AS_OF, Info, Locked, PageHero, Rate, Status } from './Shell';
import { stateOf } from './state';

// Facilities (#/v7/facilities): the PRD v0.3 list (3.4) — open facilities with size, rate, term, commitments and
// closing date; active facilities with balance, coverage and status — for both facility types (4.2) and their states
// (4.4). A short white header with the book's key figures in large type, open facilities as cards (rate first), and
// active facilities as a table, one line per cell.
// Per-facility detail (site, over-collateralization, drawdown method, payment count) lives on the facility page.

export function V7Facilities() {
  const { ok, issues } = useDemo();
  const { open, active } = facilities(issues);
  const perf = active.filter((f) => f.phase === 'performing');
  const out = active.reduce((a, f) => a + f.principal!, 0);
  const perfOut = perf.reduce((a, f) => a + f.principal!, 0);
  const paid = perf.reduce((a, f) => a + f.paid!, 0);

  return (
    <>
      <PageHero
        big
        title="Loans"
        sub={
          <>
            Senior secured loans to operating and under-construction compute centers, backed by GPUs, contracts and
            rent.
            <span className="mk7-asof">As of {fmtD(AS_OF)}</span>
          </>
        }
        actions={<BannerArt />}
      >
        <div>
          <dt>
            Principal outstanding
            <Info>{`Across ${active.length} active loans.`}</Info>
          </dt>
          <dd>{usdM(out)}</dd>
        </div>
        <div>
          <dt>
            Weighted interest rate
            <Info>Weighted by principal outstanding.</Info>
          </dt>
          <dd className="brand">
            {ok ? pct(active.reduce((a, f) => a + f.principal! * f.rate, 0) / out) : <Locked />}
          </dd>
        </div>
        <div>
          <dt>
            DSCR, last month
            <Info>Last month's rent over scheduled debt service, across performing loans. Covenant minimum 1.15×.</Info>
          </dt>
          <dd>{(perf.reduce((a, f) => a + f.principal! * f.cov!, 0) / perfOut).toFixed(2)}×</dd>
        </div>
        <div>
          <dt>
            Monthly payments<Info>Received on schedule; none missed.</Info>
          </dt>
          <dd>
            {paid} of {paid}
          </dd>
        </div>
      </PageHero>

      <section className="mk7-sec">
        <div className="mk7-w">
          <header className="mk7-sh">
            <h2>Open for commitments</h2>
          </header>
          <div className="mk7-open">
            {open.map((f, i) => (
              <OpenCard f={f} i={i} key={f.sym} />
            ))}
          </div>
        </div>
      </section>

      <section className="mk7-sec">
        <div className="mk7-w">
          <header className="mk7-sh">
            <h2>Active loans</h2>
          </header>
          <div className="mk7-tbl">
            <div className="mk7-row hd">
              <span>Loan</span>
              <span className="r">Principal</span>
              <span className="r">Interest rate</span>
              <span className="r">Matures</span>
              <span className="r">
                DSCR
                <Info>Last month's rent over scheduled debt service; amber below 1.25×.</Info>
              </span>
              <span className="r">
                OC / LTC
                <Info>
                  OC: equipment appraisal plus cash reserve, over principal outstanding. LTC, for construction loans:
                  loan amount over total project cost.
                </Info>
              </span>
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
                    <span className="mono">{f.sym}</span>
                  </span>
                  <span className="r">{usd(Math.round(f.principal!))}</span>
                  <span className="r">
                    <Rate r={f.rate} d={1} compact />
                  </span>
                  <span className="r">{f.matures}</span>
                  {op ? (
                    <span className={`r ${f.cov! < 1.25 ? 'warn' : ''}`}>{f.cov!.toFixed(2)}×</span>
                  ) : (
                    <span className="r" title="In build">
                      —
                    </span>
                  )}
                  <span className="r">{pct(f.ratio, 0)}</span>
                  <span>
                    <Status tone={tone}>{st}</Status>
                  </span>
                  <span className="go" aria-hidden="true">
                    <i className="ph ph-arrow-right"></i>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * One open facility. The rate is the card's headline figure; size, term and the closing date sit under it, then the
 * commitment bar and one action. The whole card opens the facility (the title link covers it); the Lend button sits
 * above that link. `i` staggers the entrance.
 */
function OpenCard({ f, i }: { f: Facility; i: number }) {
  const { ok } = useDemo();
  const onGate = useGateClick();
  const o = f.phase === 'open';
  const [st, tone] = stateOf(f);
  return (
    <article className={`mk7-oc ${f.kind === 'Operating' ? 'op' : 'con'}`} style={{ '--i': i } as CSSProperties}>
      <div className="mk7-oc-top">
        <span>
          <span className="mk7-kind">{f.kind}</span>
          <span className="mono">{f.sym}</span>
        </span>
        <Status tone={tone}>{st}</Status>
      </div>
      <h3>
        <Link className="mk7-oc-link" to={`/v7/facility/${f.sym}`}>
          {f.name}
        </Link>
      </h3>
      <div className="mk7-oc-rate">
        <span>Interest rate</span>
        <b>{ok ? `${(f.rate * 100).toFixed(2)}%` : <Locked />}</b>
      </div>
      <dl className="mk7-oc-figs">
        <div>
          <dt>Size</dt>
          <dd>{usdM(f.size)}</dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{f.term} months</dd>
        </div>
        <div>
          <dt>{o ? 'Closes' : 'Drawdown by'}</dt>
          <dd>{fmtD(o ? f.closes! : f.deadline!)}</dd>
        </div>
      </dl>
      <div className="mk7-oc-cmt">
        <p>
          <span>{o ? `${pct(f.committed!, 0)} committed` : 'Fully committed'}</span>
          {o ? <span>{usd(f.size * (1 - f.committed!))} available</span> : null}
        </p>
        <span className="mk7-oc-bar">
          <i style={{ transform: `scaleX(${f.committed!})` }}></i>
        </span>
      </div>
      <div className="mk7-oc-act">
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
        <span className="mk7-oc-more" aria-hidden="true">
          {o ? 'View loan' : 'View conditions'}
          <i className="ph ph-arrow-right"></i>
        </span>
      </div>
    </article>
  );
}
