import { Link } from 'react-router';

import { useDemo } from '../demo/state';
import { bySym, isOpen, ME, nState, POS } from '../demo/data';
import { fmtD, num, pct, px, sgn, short, usd } from '../lib/format';

/** Portfolio for a verified account: the prototype's renderPortfolio(). Open orders are hidden with trading. */
export function Portfolio() {
  const { bal, issues, withdraw } = useDemo();
  const pv = POS.reduce((s, p) => s + p.qty * bySym(p.sym)!.price!, 0);
  const un = POS.reduce((s, p) => s + p.qty * (bySym(p.sym)!.price! - p.avg), 0);
  const pend = issues.reduce((s, n) => s + n.mine, 0);
  const signed = (v: number) => (v >= 0 ? '+' + usd(Math.round(v)) : '−' + usd(Math.round(-v)));
  const mine = issues.filter((n) => n.mine);

  return (
    <div className="xwrap">
      <div className="page-head">
        <div>
          <h1>Portfolio</h1>
          <p>
            One account in AIUSD across every market. <span className="mono">{short(ME)}</span>
          </p>
        </div>
        <div className="vact">
          <Link className="btn btn-ghost btn-sm" to="/deposit">
            Withdraw
          </Link>
          <Link className="btn btn-primary btn-sm" to="/deposit">
            Deposit
          </Link>
        </div>
      </div>
      <div className="dsum" style={{ marginTop: 0 }}>
        <div className="kstats">
          <div>
            <span>Total equity</span>
            <b className="num">{usd(Math.round(pv + bal + pend))}</b>
            <em>Positions, cash and escrow</em>
          </div>
          <div>
            <span>Positions</span>
            <b className="num">{usd(Math.round(pv))}</b>
            <em className={sgn(un)}>{signed(un)} unrealized</em>
          </div>
          <div>
            <span>AIUSD available</span>
            <b className="num">{num(bal)}</b>
            <em>No yield · redeem 1:1</em>
          </div>
          <div>
            <span>In escrow</span>
            <b className="num">{usd(pend)}</b>
            <em>New issues waiting for release</em>
          </div>
        </div>
      </div>
      <section className="block">
        <div className="sec-t">
          <h2>Positions</h2>
        </div>
        <div className="panel tbl-wrap">
          {POS.length ? (
            <table className="tbl xt">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Size</th>
                  <th>Avg price</th>
                  <th>Mark</th>
                  <th>Value</th>
                  <th>Unrealized</th>
                  <th>Yield</th>
                </tr>
              </thead>
              <tbody>
                {POS.map((p) => {
                  const m = bySym(p.sym)!;
                  const v = p.qty * m.price!;
                  const u = p.qty * (m.price! - p.avg);
                  return (
                    <tr key={p.sym}>
                      <td>
                        <Link to={`/asset/${p.sym}`}>
                          <b>{p.sym}</b>
                        </Link>
                      </td>
                      <td>
                        {num(p.qty)} <small className="muted">{p.sym}</small>
                      </td>
                      <td>{px(p.avg)}</td>
                      <td>{px(m.price!)}</td>
                      <td>{usd(Math.round(v))}</td>
                      <td className={sgn(u)}>{signed(u)}</td>
                      <td>{pct(m.yld!)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="muted" style={{ fontSize: 13, margin: '14px 0' }}>
              No position in this market.
            </p>
          )}
        </div>
      </section>
      <section className="block">
        <div className="sec-t">
          <h2>Subscriptions in escrow</h2>
          <p>Released when all six conditions are met; refunded in full if not met by the deadline</p>
        </div>
        <div className="panel tbl-wrap">
          {mine.length ? (
            <table className="tbl xt">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Deadline</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {mine.map((n) => (
                  <tr key={n.sym}>
                    <td>
                      <Link to={`/asset/${n.sym}`}>
                        <b>{n.sym}</b>
                      </Link>{' '}
                      <small className="muted">{n.name}</small>
                    </td>
                    <td>{usd(n.mine)}</td>
                    <td>
                      <span className={`pill ${isOpen(n) ? 'open' : 'verifying'}`}>{nState(n)}</span>
                    </td>
                    <td>{isOpen(n) ? 'Closes ' + fmtD(n.closes) : 'Release by ' + fmtD(n.deadline)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {isOpen(n) ? (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => withdraw(n.sym)}>
                          Withdraw
                        </button>
                      ) : (
                        <span className="muted">Locked until release</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted" style={{ margin: 0, padding: '22px 24px' }}>
              No subscriptions in escrow. <Link to="/markets">See what is open</Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
