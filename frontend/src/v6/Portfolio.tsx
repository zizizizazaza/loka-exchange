import { Link } from 'react-router';

import { isOpen } from '../demo/data';
import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { fmtD, mon, num, pct, usd } from '../lib/format';
import { positions } from '../demo/facilities';
import { Chip, LenderGate, PageHead } from './Shell';

const ORG = 'Northwind Capital Ltd';

/** Lender portfolio: account figures, active lending, escrowed commitments, payments received and statements. */
export function V6Portfolio() {
  const { ok, bal, issues, withdraw, toast } = useDemo();
  if (!ok) {
    return (
      <main className="mk6-w mk6-main">
        <LenderGate what="Portfolio" />
      </main>
    );
  }

  const pos = positions();
  const lending = pos.reduce((a, p) => a + p.qty, 0);
  const escrow = issues.reduce((a, n) => a + n.mine, 0);
  const received = pos.reduce((a, p) => a + p.receivedTotal, 0);
  const interest = pos.reduce((a, p) => a + p.payments.reduce((x, y) => x + y.interest, 0), 0);
  const next = pos.map((p) => p.next).sort((a, b) => a.date.localeCompare(b.date))[0];
  const commits = issues.filter((n) => n.mine);
  const pays = pos
    .flatMap((p) => p.payments.map((x, i) => ({ ...x, sym: p.f.sym, i })))
    .sort((a, b) => b.date.localeCompare(a.date));
  const months = Array.from({ length: 4 }, (_, i) => mon('2026-09-01', -i));

  return (
    <main className="mk6-w mk6-main tight">
      <PageHead title="Portfolio" sub={`${ORG} · All amounts in AIUSD, redeemable 1:1 for USD`}>
        <button type="button" className="mk6-btn ghost" onClick={() => toast('Statement downloaded (demo)')}>
          <i className="ph ph-download-simple"></i>Statement
        </button>
        <Link className="mk6-btn" to="/v6/fund-account">
          Fund account
        </Link>
      </PageHead>

      <dl className="mk6-figs five">
        <div>
          <dt>Account value</dt>
          <dd>{num(Math.round(lending + escrow + bal))}</dd>
          <small>Lending, escrow and cash</small>
        </div>
        <div>
          <dt>Lending outstanding</dt>
          <dd>{num(Math.round(lending))}</dd>
          <small>
            {pos.length} facilit{pos.length === 1 ? 'y' : 'ies'}
          </small>
        </div>
        <div>
          <dt>Commitments in escrow</dt>
          <dd>{num(escrow)}</dd>
          <small>Waiting for drawdown</small>
        </div>
        <div>
          <dt>Available</dt>
          <dd>{num(bal)}</dd>
          <small>No interest on idle AIUSD</small>
        </div>
        <div>
          <dt>Received to date</dt>
          <dd>{num(Math.round(received))}</dd>
          <small>{usd(Math.round(interest))} interest</small>
        </div>
      </dl>

      <section className="mk6-sec">
        <header>
          <h2>Active lending</h2>
          {next ? <p>Next payment {fmtD(next.date)}, est. {usd(Math.round(next.amount))}</p> : null}
        </header>
        <div className="mk6-list">
          <div className="mk6-li mk6-li-h p6">
            <span>Facility</span>
            <span>Principal</span>
            <span>Rate</span>
            <span>Received</span>
            <span>Coverage</span>
            <span>Status</span>
          </div>
          {pos.map((p) => (
            <Link key={p.f.sym} className="mk6-li p6" to={`/v6/facility/${p.f.sym}`}>
              <span className="mk6-fac">
                <Chip model={p.f.model} size="sm" />
                <span>
                  <b>{p.f.name}</b>
                  <small>
                    {pct(p.share, 1)} of facility · matures {p.f.matures}
                  </small>
                </span>
              </span>
              <span className="mk6-num">{num(Math.round(p.qty))}</span>
              <span className="mk6-num">{pct(p.f.rate, 2)}</span>
              <span className="mk6-num">{num(Math.round(p.receivedTotal))}</span>
              <span className="mk6-num">{p.f.cov!.toFixed(2)}×</span>
              <span>
                <span className="mk6-tag ok">Performing</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mk6-sec">
        <header>
          <h2>Commitments in escrow</h2>
          <p>Held in each facility's escrow contract. Refunded in full if the facility does not draw.</p>
        </header>
        {commits.length ? (
          <table className="mk6-table boxed">
            <thead>
              <tr>
                <th>Facility</th>
                <th className="r">Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th className="r"></th>
              </tr>
            </thead>
            <tbody>
              {commits.map((n) => (
                <tr key={n.sym}>
                  <td>
                    <Link to={`/v6/facility/${n.sym}`}>
                      <b>{n.name}</b>
                    </Link>
                    <small>{n.sym}</small>
                  </td>
                  <td className="r">{usd(n.mine)}</td>
                  <td>{isOpen(n) ? 'Open for commitments' : `Conditions ${n.cd.filter(Boolean).length}/6`}</td>
                  <td>{isOpen(n) ? `Closes ${fmtD(n.closes)}` : `Drawdown by ${fmtD(n.deadline)}`}</td>
                  <td className="r">
                    {isOpen(n) ? (
                      <button type="button" className="mk6-btn ghost sm" onClick={() => withdraw(n.sym)}>
                        Withdraw
                      </button>
                    ) : (
                      <span className="mk6-dim">Locked until drawdown</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="mk6-empty">
            No commitments in escrow. <Link to="/v6/facilities">See open facilities</Link>
          </div>
        )}
      </section>

      <div className="mk6-two">
        <section className="mk6-sec">
          <header>
            <h2>Payments received</h2>
            <p>Your share of each monthly payment, split into interest and principal.</p>
          </header>
          <table className="mk6-table boxed">
            <thead>
              <tr>
                <th>Date</th>
                <th>Facility</th>
                <th className="r">Interest</th>
                <th className="r">Principal</th>
                <th className="r">Record</th>
              </tr>
            </thead>
            <tbody>
              {pays.slice(0, 6).map((x) => (
                <tr key={x.sym + x.i}>
                  <td>{fmtD(x.date)}</td>
                  <td>{x.sym}</td>
                  <td className="r">{usd(Math.round(x.interest))}</td>
                  <td className="r">{usd(Math.round(x.principal))}</td>
                  <td className="r">
                    <TxLink seed={`${x.sym}-dist-${x.i}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mk6-sec">
          <header>
            <h2>Statements</h2>
            <p>Monthly account statements: funding, commitments, payments, withdrawals and balance.</p>
          </header>
          <ul className="mk6-docs">
            {months.map((m) => (
              <li key={m}>
                <button type="button" onClick={() => toast(`${m} statement (demo)`)}>
                  <i className="ph ph-file-text"></i>
                  <span>
                    <b>{m} statement</b>
                    <small>PDF and CSV</small>
                  </span>
                  <i className="ph ph-download-simple"></i>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
