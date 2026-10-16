import { useEffect } from 'react';
import { Link } from 'react-router';

import '../styles/markets-v3.css';

import { Server3D } from '../components/Server3D';
import { bal, isOpen, LOANS, M, nDone, pmt } from '../demo/data';
import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, pct, usd, usdM } from '../lib/format';

// Third take on Markets (#/markets-v3): the original's character (serif, warm paper) with an institutional frame.
// A compact dark band (headline figures plus the collateral illustration), then open offerings and the loan book.
// Same sample data and access rules as Markets; styles scoped under .mk3 (src/styles/markets-v3.css).

const DAY = 86400000;
const daysTo = (d: string) => Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / DAY);

export function MarketsV3() {
  const { ok, issues } = useDemo();
  const onGate = useGateClick();

  useEffect(() => {
    document.body.classList.add('mk3-page');
    return () => document.body.classList.remove('mk3-page');
  }, []);

  const rows = M.filter((m) => m.cat === 'credit' && LOANS[m.sym]).map((m) => {
    const l = LOANS[m.sym];
    const k = l.got.length;
    const out = bal(l, k);
    return { m, l, out, left: l.term - k, cov: l.got.at(-1)! / pmt(l), ltv: l.amount / l.appraisal };
  });
  const totalOut = rows.reduce((a, r) => a + r.out, 0);
  const wYield = rows.reduce((a, r) => a + r.out * r.m.yld!, 0) / totalOut;
  const wCov = rows.reduce((a, r) => a + r.out * r.cov, 0) / totalOut;
  const payments = rows.reduce((a, r) => a + r.l.got.length, 0);
  const rentIn = rows.reduce((a, r) => a + r.l.got.reduce((x, y) => x + y, 0), 0);
  const repaid = rows.reduce((a, r) => a + r.l.amount - r.out, 0);
  const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="mk3">
      <section className="mk3-hero">
        <div className="mk3-in">
          <div className="mk3-crumb">
            <span>Preview · v3</span>
            <Link to="/markets">Current version</Link>
            <Link to="/markets-v2">v2</Link>
          </div>
          <div className="mk3-hero-grid">
            <div>
              <p className="mk3-eye">Compute credit · Senior secured</p>
              <h1>Private credit, secured by the machines that run AI.</h1>
              <dl className="mk3-figs">
                <div>
                  <dt>Principal outstanding</dt>
                  <dd>{usd(totalOut)}</dd>
                  <small>{rows.length} loans repaying</small>
                </div>
                <div>
                  <dt>Weighted yield</dt>
                  {ok ? (
                    <dd>{pct(wYield, 2)}</dd>
                  ) : (
                    <dd>
                      <button type="button" className="mk3-gate" onClick={onGate}>
                        <i className="ph-light ph-lock-simple"></i>Verified only
                      </button>
                    </dd>
                  )}
                  <small>By principal outstanding</small>
                </div>
                <div>
                  <dt>Coverage, last month</dt>
                  <dd>{wCov.toFixed(2)}×</dd>
                  <small>Cure trigger 1.15×</small>
                </div>
              </dl>
            </div>
            <figure className="mk3-art">
              <Server3D />
              <figcaption>HGX 8-GPU boards · pledged, insured and monitored online</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="mk3-sec">
        <header className="mk3-sec-h">
          <h2>Open for subscription</h2>
          <span>{usdM(issues.reduce((a, n) => a + n.amt * (1 - n.sub), 0))} left to subscribe</span>
        </header>
        <div className="mk3-offers">
          {issues.map((n) => {
            const o = isOpen(n);
            const d = daysTo(o ? n.closes : n.deadline);
            return (
              <article className="mk3-offer" key={n.sym}>
                <div className="mk3-offer-top">
                  <span className="mk3-sym">{n.sym}</span>
                  <span className={`mk3-state ${o ? 'live' : 'wait'}`}>
                    {o ? 'Subscribing' : `Verifying · ${nDone(n)} of 6 conditions`}
                  </span>
                </div>
                <h3>
                  <Link to={`/asset-v2/${n.sym}`}>{n.name}</Link>
                </h3>
                <p className="mk3-sub">
                  {n.gpu} · {n.site}
                </p>
                <dl className="mk3-terms">
                  <div>
                    <dt>Size</dt>
                    <dd>{usdM(n.amt)}</dd>
                  </div>
                  <div>
                    <dt>Rate</dt>
                    <dd>
                      {ok ? (
                        pct(n.rate, 1)
                      ) : (
                        <button type="button" className="mk3-verify" onClick={onGate}>
                          <i className="ph-light ph-lock-simple"></i>Verify to view
                        </button>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Term</dt>
                    <dd>{n.term} mo</dd>
                  </div>
                  <div>
                    <dt>LTV</dt>
                    <dd>{pct(n.amt / n.appraisal, 0)}</dd>
                  </div>
                </dl>
                <div className="mk3-fill">
                  <div className="mk3-bar">
                    <i style={{ width: `${n.sub * 100}%` }}></i>
                  </div>
                  <span>
                    {pct(n.sub, 0)} subscribed
                    <em>
                      {o ? 'Closes' : 'Release by'} {fmtD(o ? n.closes : n.deadline)}
                      {d > 0 ? ` · ${d} days` : ''}
                    </em>
                  </span>
                </div>
                {ok && n.mine ? <p className="mk3-mine">Your subscription {usd(n.mine)} · in escrow</p> : null}
                <div className="mk3-act">
                  {o ? (
                    ok ? (
                      <Link className="mk3-btn" to={`/asset/${n.sym}/subscribe`}>
                        Subscribe
                      </Link>
                    ) : (
                      <button className="mk3-btn" type="button" onClick={onGate}>
                        Subscribe
                      </button>
                    )
                  ) : null}
                  {o ? (
                    <Link className="mk3-link" to={`/asset-v2/${n.sym}`}>
                      View term sheet <i className="ph-light ph-arrow-right"></i>
                    </Link>
                  ) : (
                    <Link className="mk3-btn ghost" to={`/asset-v2/${n.sym}`}>
                      View progress
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mk3-sec">
        <header className="mk3-sec-h">
          <h2>Loan book</h2>
          <span>
            Data as of {asOf} · <TxLink seed="loka-loan-registry" />
          </span>
        </header>
        <dl className="mk3-record">
          <div>
            <dt>Payments received</dt>
            <dd>{payments}</dd>
          </div>
          <div>
            <dt>Missed</dt>
            <dd>0</dd>
          </div>
          <div>
            <dt>Rent collected</dt>
            <dd>{usd(rentIn)}</dd>
          </div>
          <div>
            <dt>Principal repaid</dt>
            <dd>{usd(repaid)}</dd>
          </div>
          <div>
            <dt>Settlement</dt>
            <dd>AIUSD, on-chain</dd>
          </div>
        </dl>
        <div className="mk3-table-wrap">
          <table className="mk3-table">
            <thead>
              <tr>
                <th>Loan</th>
                <th className="r">Outstanding</th>
                {ok ? <th className="r">Yield</th> : null}
                <th className="r">Term left</th>
                <th className="r">Coverage</th>
                <th className="r">LTV</th>
                <th aria-label="Open"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.m.sym}>
                  <td>
                    <Link className="mk3-loan" to={`/asset/${r.m.sym}`}>
                      <b>{r.m.name}</b>
                      <span>
                        {r.m.sym} · {r.m.loan!.site}
                      </span>
                    </Link>
                  </td>
                  <td className="r">{usdM(r.out)}</td>
                  {ok ? <td className="r">{pct(r.m.yld!, 1)}</td> : null}
                  <td className="r">{r.left} mo</td>
                  <td className={`r ${r.cov < 1.25 ? 'warn' : ''}`}>{r.cov.toFixed(2)}×</td>
                  <td className="r">{pct(r.ltv, 0)}</td>
                  <td className="go">
                    <Link to={`/asset/${r.m.sym}`} aria-label={`${r.m.name} details`}>
                      <i className="ph-light ph-arrow-right"></i>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mk3-note">
          Coverage is rent collected divided by scheduled debt service.
          {ok ? null : (
            <>
              {' '}Yields are shown to verified institutional investors.{' '}
              <button type="button" onClick={onGate}>
                See who can invest
              </button>
            </>
          )}
        </p>
      </section>
    </div>
  );
}
