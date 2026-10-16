import { Link } from 'react-router';

import { useDemo } from '../demo/state';
import { bal, CATS, isOpen, LOANS, M, nState, pmt } from '../demo/data';
import { LockV } from '../demo/ui';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, pct, usd, usdM } from '../lib/format';

// The prototype has category tabs and a CCV row; both are hidden in this phase (only compute credit, VAULT off).
const CAT = 'credit';

/** Markets: the prototype's renderMarkets(). */
export function Markets() {
  const { ok, issues } = useDemo();
  const onGate = useGateClick();

  const live = M.filter((m) => !m.soon);
  const list = M.filter((m) => m.cat === CAT && m.sym !== 'CCV');
  const c = CATS.find((x) => x.k === CAT)!;
  const ls = live
    .filter((m) => LOANS[m.sym])
    .map((m) => {
      const l = LOANS[m.sym];
      const k = l.got.length;
      return { m, l, out: bal(l, k), left: l.term - k, cov: l.got.at(-1)! / pmt(l), ltv: l.amount / l.appraisal };
    });
  const info = (sym: string) => {
    const x = ls.find((y) => y.m.sym === sym)!;
    return { term: `${x.left} mo`, cov: x.cov, ltv: pct(x.ltv, 0) };
  };
  const totalOut = ls.reduce((a, x) => a + x.out, 0);

  return (
    <div className="xwrap">
      <div className="dsum" style={{ marginTop: 0 }}>
        <div className="kstats">
          <div>
            <span>Loans outstanding</span>
            <b className="num">{usdM(totalOut)}</b>
            <em>{ls.length} loans repaying</em>
          </div>
          {ok ? (
            <div>
              <span>Weighted yield</span>
              <b className="num">{pct(ls.reduce((a, x) => a + x.out * x.m.yld!, 0) / totalOut)}</b>
              <em>By principal outstanding</em>
            </div>
          ) : (
            <div>
              <span>Weighted yield</span>
              <b className="lockb">
                <i className="ph ph-lock-simple"></i>Verified investors
              </b>
              <em>
                <button type="button" onClick={onGate}>
                  See who can invest
                </button>
              </em>
            </div>
          )}
          <div>
            <span>Coverage, last month</span>
            <b className="num">{(ls.reduce((a, x) => a + x.out * x.cov, 0) / totalOut).toFixed(2)}×</b>
            <em>Weighted · cure trigger 1.15×</em>
          </div>
          <div>
            <span>Raising</span>
            <b className="num">{issues.length}</b>
            <em>{usdM(issues.reduce((a, n) => a + n.amt * (1 - n.sub), 0))} left to subscribe</em>
          </div>
        </div>
      </div>

      <section className="block mk-raise">
        <div className="sec-t">
          <h2>Open for subscription</h2>
        </div>
        <div className="nissue">
          {issues.map((n) => {
            const o = isOpen(n);
            return (
              <div className="panel card ni" key={n.sym}>
                <h3>
                  <Link to={`/asset/${n.sym}`}>{n.name}</Link>
                  <span className={`pill ${o ? 'open' : 'verifying'}`}>{nState(n)}</span>
                </h3>
                <p className="small" style={{ margin: '0 0 14px' }}>
                  {n.gpu} · {n.site}
                </p>
                <div className="meter">
                  <span className="num">
                    {pct(n.sub, 0)} of {usdM(n.amt)}
                  </span>
                  <div className="bar">
                    <i style={{ width: `${n.sub * 100}%` }}></i>
                  </div>
                </div>
                <dl className="kv">
                  {ok ? (
                    <div>
                      <dt>Rate</dt>
                      <dd>
                        {pct(n.rate)} fixed · {n.term} months
                      </dd>
                    </div>
                  ) : (
                    <>
                      <div>
                        <dt>Term</dt>
                        <dd>{n.term} months</dd>
                      </div>
                      <div>
                        <dt>Rate</dt>
                        <dd>
                          <LockV />
                        </dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>{o ? 'Closes' : 'Release deadline'}</dt>
                    <dd>{fmtD(o ? n.closes : n.deadline)}</dd>
                  </div>
                  {ok && n.mine ? (
                    <div>
                      <dt>Your subscription</dt>
                      <dd className="num">{usd(n.mine)} · in escrow</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="ni-act">
                  {o ? (
                    ok ? (
                      <Link className="btn btn-primary btn-sm" to={`/asset/${n.sym}/subscribe`}>
                        Subscribe
                      </Link>
                    ) : (
                      <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
                        Subscribe
                      </button>
                    )
                  ) : null}
                  <Link className="btn btn-ghost btn-sm" to={`/asset/${n.sym}`}>
                    {o ? 'Details' : 'View progress'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="block mk-funded">
        <div className="sec-t">
          <h2>Funded</h2>
        </div>
        {list.length ? (
          <div className="panel mlist">
            <div className="mrow mhd">
              <span>Asset</span>
              <span>{ok ? 'Yield' : 'Yield · verified'}</span>
              <span>Size</span>
              <span>Term left</span>
              <span>Coverage</span>
              <span>LTV</span>
              <span>Status</span>
              <span></span>
            </div>
            {list.map((m) => {
              const f = info(m.sym);
              return (
                <Link className="mrow" to={`/asset/${m.sym}`} title={`${m.name} details`} key={m.sym}>
                  <span className="mn">
                    <b>{m.sym}</b>
                    <small>{m.name}</small>
                  </span>
                  {ok ? (
                    <span className="num">
                      <b className="yl">{pct(m.yld!)}</b>
                      <small>to maturity</small>
                    </span>
                  ) : (
                    <span className="lockv" title="Shown to verified investors">
                      <i className="ph ph-lock-simple"></i>
                    </span>
                  )}
                  <span className="num">{usdM(m.size!)}</span>
                  <span className="num">{f.term}</span>
                  <span className={`num ${f.cov < 1.25 ? 'neg' : ''}`}>{f.cov.toFixed(2)}×</span>
                  <span className="num">{f.ltv}</span>
                  <span>
                    <span className="pill repaying">Repaying</span>
                  </span>
                  <span className="go">
                    <i className="ph ph-arrow-right"></i>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="panel empty">
            <p style={{ margin: '0 0 6px', color: 'var(--ink)' }}>{c.n}</p>
            <p style={{ margin: 0 }}>{c.note}. Listing templates for this asset class are being designed.</p>
          </div>
        )}
      </section>
    </div>
  );
}
