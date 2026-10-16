import { useState } from 'react';
import { Link } from 'react-router';

import { isOpen } from '../demo/data';
import { positions } from '../demo/facilities';
import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { fmtD, mon, num, pct, usd, usdK } from '../lib/format';
import { LenderGate, ORG, PageHero, Section, Status } from './Shell';

// Portfolio (#/v7/portfolio), PRD v0.3 3.4: lending positions, payments received (chart and table), commitments
// waiting for drawdown, and statements. Logic follows the v6 page (src/v6/Portfolio.tsx).

export function V7Portfolio() {
  const { ok, bal, issues, withdraw, toast } = useDemo();
  if (!ok) {
    return (
      <>
        <PageHero eyebrow="Lender account" title="Portfolio" compact />
        <main className="mk7-w mk7-after">
          <LenderGate what="Portfolio" />
        </main>
      </>
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
    <>
      <PageHero
        eyebrow={`${ORG} · AIUSD, redeemable 1:1 for USD`}
        title="Portfolio"
        cols={5}
        compact
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast('Statement downloaded (demo)')}>
              <i className="ph ph-download-simple" aria-hidden="true"></i>Statement
            </button>
            <Link className="btn mk7-btn-light btn-sm" to="/v7/fund-account">
              Fund account
            </Link>
          </>
        }
      >
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
          <dd className="brand">{num(Math.round(received))}</dd>
          <small>{usd(Math.round(interest))} interest</small>
        </div>
      </PageHero>

      <main className="mk7-w mk7-after">
        <Section
          title="Active lending"
          meta={next ? `Next payment ${fmtD(next.date)} · est. ${usd(Math.round(next.amount))}` : undefined}
        >
          <div className="mk7-tscroll">
            <table className="mk7-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th className="r">Principal</th>
                  <th className="r">Interest rate</th>
                  <th className="r">Received</th>
                  <th className="r">DSCR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.f.sym}>
                    <td>
                      <Link to={`/v7/facility/${p.f.sym}`}>
                        <b>{p.f.name}</b>
                      </Link>
                      <small>
                        {pct(p.share, 1)} of facility · matures {p.f.matures}
                      </small>
                    </td>
                    <td className="r">{num(Math.round(p.qty))}</td>
                    <td className="r">{pct(p.f.rate, 2)}</td>
                    <td className="r">{num(Math.round(p.receivedTotal))}</td>
                    <td className={`r ${p.f.cov! < 1.25 ? 'warn' : ''}`}>{p.f.cov!.toFixed(2)}×</td>
                    <td>
                      <Status tone="ok">Performing</Status>
                      <small>
                        Payment {p.f.paid} of {p.f.term}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Payments received"
          meta={`${pays.length} payments · none missed`}
          note="Your share of each monthly payment. The outlined bar is the next one, estimated."
        >
          <ReceiptsChart pays={pays} next={next} />
          <div className="mk7-tscroll">
            <table className="mk7-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Facility</th>
                  <th className="r">Interest</th>
                  <th className="r">Principal</th>
                  <th className="r">Total</th>
                  <th className="r">Record</th>
                </tr>
              </thead>
              <tbody>
                {pays.map((x) => (
                  <tr key={x.sym + x.i}>
                    <td>{fmtD(x.date)}</td>
                    <td>{x.sym}</td>
                    <td className="r">{usd(Math.round(x.interest))}</td>
                    <td className="r">{usd(Math.round(x.principal))}</td>
                    <td className="r">{usd(Math.round(x.total))}</td>
                    <td className="r">
                      <TxLink seed={`${x.sym}-dist-${x.i}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Commitments in escrow"
          note="Held in each facility's escrow contract. Refunded in full if the facility does not draw."
        >
          {commits.length ? (
            <div className="mk7-tscroll">
              <table className="mk7-table">
                <thead>
                  <tr>
                    <th>Facility</th>
                    <th className="r">Lending commitment</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="r"></th>
                  </tr>
                </thead>
                <tbody>
                  {commits.map((n) => (
                    <tr key={n.sym}>
                      <td>
                        <Link to={`/v7/facility/${n.sym}`}>
                          <b>{n.name}</b>
                        </Link>
                        <small>{n.sym}</small>
                      </td>
                      <td className="r">{usd(n.mine)}</td>
                      <td>
                        {isOpen(n) ? (
                          <Status tone="open">Open for commitments</Status>
                        ) : (
                          <Status tone="wait">Conditions {n.cd.filter(Boolean).length} of 6</Status>
                        )}
                      </td>
                      <td>{isOpen(n) ? `Closes ${fmtD(n.closes)}, 17:00 ET` : `Drawdown by ${fmtD(n.deadline)}`}</td>
                      <td className="r">
                        {isOpen(n) ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => withdraw(n.sym)}>
                            Withdraw
                          </button>
                        ) : (
                          <span className="mk7-dim">Locked until drawdown</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mk7-empty">
              No commitments in escrow. <Link to="/v7/facilities">See open facilities</Link>
            </div>
          )}
        </Section>

        <Section title="Statements" note="Monthly: funding, lending, payments, withdrawals and balance.">
          <ul className="mk7-docs">
            {months.map((m) => (
              <li key={m}>
                <button type="button" onClick={() => toast(`${m} statement (demo)`)}>
                  <i className="ph-light ph-file-text" aria-hidden="true"></i>
                  <span>
                    <b>{m} statement</b>
                    <small>PDF and CSV</small>
                  </span>
                  <i className="ph ph-download-simple" aria-hidden="true"></i>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </main>
    </>
  );
}

type Pay = { date: string; interest: number; principal: number; total: number };

/** Round a maximum up to a tidy axis top, in four or so steps. */
function axisTop(max: number) {
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= rough)! * mag;
  return { top: Math.ceil(max / step) * step, step };
}

/**
 * Amount received by month, stacked: principal (series 1, the brand green) and interest (series 2). Payments are level,
 * so the split is what changes: principal grows as interest falls. Bars from zero with a 2px gap between the parts; the
 * next payment as an outlined (estimated) bar; only the latest bar labelled. The payments table below is its table view.
 */
function ReceiptsChart({ pays, next }: { pays: Pay[]; next?: { date: string; amount: number } }) {
  const [hi, setHi] = useState<number | null>(null);
  // One bar per month across all positions.
  const byMonth = new Map<string, Pay>();
  for (const p of pays) {
    const k = p.date.slice(0, 7);
    const m = byMonth.get(k) ?? { date: p.date, interest: 0, principal: 0, total: 0 };
    byMonth.set(k, {
      date: m.date,
      interest: m.interest + p.interest,
      principal: m.principal + p.principal,
      total: m.total + p.total,
    });
  }
  const rows = [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return null;

  const W = 1160;
  const H = 230;
  const L = 56;
  const R = 8;
  const T = 24;
  const B = 30;
  const slots = rows.length + (next ? 1 : 0);
  const step = (W - L - R) / slots;
  const bw = Math.min(56, step * 0.5);
  const { top, step: tick } = axisTop(Math.max(...rows.map((r) => r.total), next?.amount ?? 0));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const cx = (i: number) => L + step * (i + 0.5);
  // One part of a bar, from value `from` up to `to`; `gap` leaves surface between stacked parts, `round` rounds the top
  // corners (4px) of the part that ends the bar.
  const seg = (i: number, from: number, to: number, gap: number, round: boolean) => {
    const x = cx(i) - bw / 2;
    const yb = y(from) - gap;
    const yt = y(to);
    const r = round ? Math.min(4, Math.max(0, yb - yt), bw / 2) : 0;
    return `M${x},${yb} V${yt + r} Q${x},${yt} ${x + r},${yt} H${x + bw - r} Q${x + bw},${yt} ${x + bw},${yt + r} V${yb} Z`;
  };
  const month = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' });
  const last = rows.length - 1;
  const dates = [...rows.map((r) => r.date), ...(next ? [next.date] : [])];
  const valueAt = (i: number) => (i < rows.length ? rows[i].total : next!.amount);

  return (
    <div className="mk7-chart">
      <p className="mk7-legend">
        <span>
          <i className="s1"></i>Principal
        </span>
        <span>
          <i className="s2"></i>Interest
        </span>
      </p>
      <div className="mk7-chart-in">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Payments received by month, principal and interest; latest ${usd(Math.round(rows[last].total))}`}
        >
          {Array.from({ length: Math.round(top / tick) + 1 }, (_, k) => k * tick).map((t) => (
            <g key={t}>
              <line className={t ? 'grid' : 'base'} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
              <text className="tick" x={L - 10} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {t ? usdK(t) : '0'}
              </text>
            </g>
          ))}
          {rows.map((r, i) => (
            <g key={r.date} className={hi !== null && hi !== i ? 'dim' : ''}>
              <path className="bar p" d={seg(i, 0, r.principal, 0, false)} />
              <path className="bar i" d={seg(i, r.principal, r.total, 2, true)} />
            </g>
          ))}
          {next ? <path className="est" d={seg(rows.length, 0, next.amount, 0, true)} /> : null}
          <text className="lbl" x={cx(last)} y={y(rows[last].total) - 8} textAnchor="middle">
            {usd(Math.round(rows[last].total))}
          </text>
          {next ? (
            <text className="tick" x={cx(rows.length)} y={y(next.amount) - 8} textAnchor="middle">
              Est.
            </text>
          ) : null}
          {dates.map((d, i) => (
            <text key={d} className="tick" x={cx(i)} y={H - 8} textAnchor="middle">
              {month(d)}
            </text>
          ))}
          {/* Hit areas: the full column for each month, keyboard-focusable. */}
          {dates.map((d, i) => (
            <rect
              key={d}
              className="hit"
              x={L + step * i}
              y={T}
              width={step}
              height={H - T - B}
              tabIndex={0}
              aria-label={
                i < rows.length
                  ? `${fmtD(d)}: ${usd(Math.round(rows[i].total))}`
                  : `Next payment, est. ${usd(Math.round(next!.amount))}`
              }
              onMouseEnter={() => setHi(i)}
              onMouseLeave={() => setHi(null)}
              onFocus={() => setHi(i)}
              onBlur={() => setHi(null)}
            />
          ))}
        </svg>
        {hi !== null ? (
          <div className="mk7-tip" style={{ left: `${(cx(hi) / W) * 100}%`, top: `${(y(valueAt(hi)) / H) * 100}%` }}>
            <b>{fmtD(dates[hi])}</b>
            {hi < rows.length ? (
              <>
                <span>Received {usd(Math.round(rows[hi].total))}</span>
                <span>
                  Interest {usd(Math.round(rows[hi].interest))} · principal {usd(Math.round(rows[hi].principal))}
                </span>
              </>
            ) : (
              <span>Next payment, est. {usd(Math.round(next!.amount))}</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
