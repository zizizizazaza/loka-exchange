import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import '../styles/markets-v2.css';

import { useDemo } from '../demo/state';
import { bal, isOpen, LOANS, M, mo, nDone, pmt, type Loan, type Market, type NewIssue } from '../demo/data';
import { TxLink } from '../demo/ui';
import { useGateClick } from '../demo/useGateClick';
import { fmtD, mon, num, pct, usd, usdM } from '../lib/format';

// Institutional take on Markets (#/markets-v2), for review against the original (src/pages/Markets.tsx).
// Same sample data and access rules; everything is scoped under .mk2 (src/styles/markets-v2.css).

const CURE = 1.15;
const DAY = 86400000;

const gpuType = (s: string) => s.match(/[HB]\d{3}/)?.[0] ?? 'Other';
const region = (site: string) =>
  /US$/.test(site) ? 'North America' : /Singapore|Japan/.test(site) ? 'Asia-Pacific' : 'Europe';
const daysTo = (d: string) => Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / DAY);

interface Row {
  m: Market;
  l: Loan;
  k: number;
  out: number;
  left: number;
  cov: number[];
  ltv: number;
  next: string;
  gpu: string;
  region: string;
}

type SortKey = 'out' | 'yld' | 'left' | 'cov' | 'ltv';

export function MarketsV2() {
  const { ok, issues } = useDemo();
  const onGate = useGateClick();
  const [gpu, setGpu] = useState('All');
  const [sort, setSort] = useState<{ k: SortKey; d: 1 | -1 }>({ k: 'out', d: -1 });

  // Cooler page background while this page is open.
  useEffect(() => {
    document.body.classList.add('mk2-page');
    return () => document.body.classList.remove('mk2-page');
  }, []);

  const rows: Row[] = useMemo(
    () =>
      M.filter((m) => m.cat === 'credit' && LOANS[m.sym]).map((m) => {
        const l = LOANS[m.sym];
        const k = l.got.length;
        const p = pmt(l);
        const out = bal(l, k);
        return {
          m,
          l,
          k,
          out,
          left: l.term - k,
          cov: l.got.map((g) => g / p),
          ltv: out / l.appraisal,
          next: mon(l.firstPay, k, true),
          gpu: gpuType(m.loan!.gpu),
          region: region(m.loan!.site),
        };
      }),
    [],
  );

  const totalOut = rows.reduce((a, r) => a + r.out, 0);
  const originated = rows.reduce((a, r) => a + r.l.amount, 0);
  const rentIn = rows.reduce((a, r) => a + r.l.got.reduce((x, y) => x + y, 0), 0);
  const wYield = rows.reduce((a, r) => a + r.out * r.m.yld!, 0) / totalOut;
  const wCov = rows.reduce((a, r) => a + r.out * r.cov.at(-1)!, 0) / totalOut;
  const payments = rows.reduce((a, r) => a + r.k, 0);
  const asOf = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });

  // Rent collected vs debt service, by calendar month.
  const months = useMemo(() => {
    const byKey = new Map<string, { got: number; due: number }>();
    for (const r of rows) {
      const p = pmt(r.l);
      r.l.got.forEach((g, i) => {
        const key = mon(r.l.firstPay, i, true).slice(0, 7);
        const v = byKey.get(key) ?? { got: 0, due: 0 };
        v.got += g;
        v.due += p;
        byKey.set(key, v);
      });
    }
    return [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => ({ key, ...v }));
  }, [rows]);

  // Recent rent receipts across the book.
  const feed = useMemo(
    () =>
      rows
        .flatMap((r) =>
          r.l.got.map((g, i) => ({ sym: r.m.sym, date: mon(r.l.firstPay, i, true), amt: g, cov: r.cov[i], i })),
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 7),
    [rows],
  );

  const gpus = ['All', ...[...new Set(rows.map((r) => r.gpu))].sort()];
  const shown = rows
    .filter((r) => gpu === 'All' || r.gpu === gpu)
    .sort((a, b) => {
      const v = (r: Row) =>
        ({ out: r.out, yld: r.m.yld!, left: r.left, cov: r.cov.at(-1)!, ltv: r.ltv })[sort.k];
      return (v(a) - v(b)) * sort.d;
    });
  const sortBy = (k: SortKey) => setSort((s) => ({ k, d: s.k === k ? (-s.d as 1 | -1) : -1 }));
  const th = (k: SortKey, label: string) => (
    <th className="r">
      <button type="button" className={sort.k === k ? 'on' : ''} onClick={() => sortBy(k)}>
        {label}
        <i className={`ph ph-caret-${sort.k === k && sort.d === 1 ? 'up' : 'down'}`}></i>
      </button>
    </th>
  );

  const Locked = ({ w = '00.0%' }: { w?: string }) => (
    <button type="button" className="mk2-locked" onClick={onGate} title="Shown to verified investors">
      <span aria-hidden="true">{w}</span>
      <i className="ph ph-lock-simple"></i>
    </button>
  );

  return (
    <div className="mk2">
      <div className="mk2-crumb">
        <span className="mk2-tag">Preview</span>
        <span>Institutional layout, for review against the current Markets page</span>
        <Link to="/markets">
          Current version <i className="ph ph-arrow-right"></i>
        </Link>
      </div>

      <header className="mk2-head">
        <div>
          <p className="mk2-eye">Markets · Compute credit</p>
          <h1>GPU-secured private credit</h1>
          <p className="mk2-lede">
            Senior secured loans against operating GPU fleets. Rent is routed to an on-chain collection contract and
            settled in AIUSD.
          </p>
        </div>
        <dl className="mk2-asof">
          <div>
            <dt>Data as of</dt>
            <dd>{asOf} UTC</dd>
          </div>
          <div>
            <dt>Settlement</dt>
            <dd>AIUSD · on-chain</dd>
          </div>
          <div>
            <dt>Record</dt>
            <dd>
              <TxLink seed="loka-loan-registry" />
            </dd>
          </div>
        </dl>
      </header>

      <dl className="mk2-stats">
        <div>
          <dt>Principal outstanding</dt>
          <dd className="n">{usd(totalOut)}</dd>
          <small>{rows.length} loans repaying</small>
        </div>
        <div>
          <dt>Originated</dt>
          <dd className="n">{usd(originated)}</dd>
          <small>{usd(originated - totalOut)} principal repaid</small>
        </div>
        <div>
          <dt>Weighted yield</dt>
          <dd className="n">{ok ? pct(wYield, 2) : <Locked w="00.00%" />}</dd>
          <small>By principal outstanding</small>
        </div>
        <div>
          <dt>Coverage, last month</dt>
          <dd className="n">{wCov.toFixed(2)}×</dd>
          <small>Weighted · cure trigger {CURE.toFixed(2)}×</small>
        </div>
        <div>
          <dt>Rent collected</dt>
          <dd className="n">{usd(rentIn)}</dd>
          <small>{payments} monthly receipts</small>
        </div>
        <div>
          <dt>Defaults</dt>
          <dd className="n">0.00%</dd>
          <small>0 of {payments} payments missed</small>
        </div>
      </dl>

      <section className="mk2-grid">
        <div className="mk2-card mk2-chart">
          <div className="mk2-card-h">
            <div>
              <h2>Rent collected vs. debt service</h2>
              <p>Monthly, all repaying loans. Label shows coverage.</p>
            </div>
            <ul className="mk2-legend">
              <li>
                <i className="sw a"></i>Rent collected
              </li>
              <li>
                <i className="sw due"></i>Debt service
              </li>
            </ul>
          </div>
          <Collections months={months} />
        </div>

        <div className="mk2-card">
          <div className="mk2-card-h">
            <div>
              <h2>Collateral mix</h2>
              <p>By principal outstanding</p>
            </div>
          </div>
          <Mix title="GPU" rows={rows} by={(r) => r.gpu} total={totalOut} />
          <Mix title="Region" rows={rows} by={(r) => r.region} total={totalOut} />
          <dl className="mk2-facts">
            <div>
              <dt>Weighted LTV</dt>
              <dd className="n">{pct(rows.reduce((a, r) => a + r.out * r.ltv, 0) / totalOut, 1)}</dd>
            </div>
            <div>
              <dt>Weighted term left</dt>
              <dd className="n">{(rows.reduce((a, r) => a + r.out * r.left, 0) / totalOut).toFixed(1)} months</dd>
            </div>
            <div>
              <dt>Seniority</dt>
              <dd>Senior secured, first lien</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mk2-sec">
        <div className="mk2-sec-h">
          <h2>Primary issuance</h2>
          <span>
            {issues.length} offerings · {usdM(issues.reduce((a, n) => a + n.amt * (1 - n.sub), 0))} left to subscribe
          </span>
        </div>
        <div className="mk2-issues">
          {issues.map((n) => (
            <Issue key={n.sym} n={n} ok={ok} onGate={onGate} Locked={Locked} />
          ))}
        </div>
      </section>

      <section className="mk2-sec">
        <div className="mk2-sec-h">
          <h2>Loan book</h2>
          <div className="mk2-chips" role="group" aria-label="Filter by GPU">
            {gpus.map((g) => (
              <button key={g} type="button" aria-pressed={gpu === g} onClick={() => setGpu(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="mk2-tablewrap">
          <table className="mk2-table">
            <thead>
              <tr>
                <th>Loan</th>
                {th('out', 'Outstanding')}
                {th('yld', 'Yield')}
                {th('left', 'Term left')}
                {th('cov', 'Coverage')}
                <th>Trend</th>
                {th('ltv', 'LTV')}
                <th>Rent receipts</th>
                <th className="r">Next payment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const c = r.cov.at(-1)!;
                return (
                  <tr key={r.m.sym}>
                    <td>
                      <Link className="mk2-asset" to={`/asset/${r.m.sym}`}>
                        <span className="sym">{r.m.sym}</span>
                        <span className="nm">{r.m.name}</span>
                        <span className="sub">
                          {r.m.loan!.gpu} · {r.m.loan!.site}
                        </span>
                      </Link>
                    </td>
                    <td className="r n">
                      {usd(r.out)}
                      <small>of {usd(r.l.amount)}</small>
                    </td>
                    <td className="r n">
                      {ok ? (
                        <>
                          {pct(r.m.yld!, 2)}
                          <small>to maturity</small>
                        </>
                      ) : (
                        <Locked />
                      )}
                    </td>
                    <td className="r n">
                      {r.left} mo
                      <small>of {r.l.term}</small>
                    </td>
                    <td className={`r n ${c < 1.25 ? 'warn' : ''}`}>
                      {c.toFixed(2)}×<small>min {Math.min(...r.cov).toFixed(2)}×</small>
                    </td>
                    <td>
                      <Spark v={r.cov} />
                    </td>
                    <td className="r n">
                      {pct(r.ltv, 0)}
                      <small>orig. {pct(r.l.amount / r.l.appraisal, 0)}</small>
                    </td>
                    <td>
                      <Receipts l={r.l} />
                    </td>
                    <td className="r n">
                      {fmtD(r.next)}
                      <small>{usd(Math.round(pmt(r.l)))}</small>
                    </td>
                    <td className="go">
                      <Link to={`/asset/${r.m.sym}`} aria-label={`${r.m.name} details`}>
                        <i className="ph ph-arrow-right"></i>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mk2-note">
          Coverage = rent collected ÷ scheduled debt service. Below {CURE.toFixed(2)}× for two months triggers the cure
          period. Amber receipts mark months where rent came in under contract (uptime credits).
        </p>
      </section>

      <section className="mk2-grid even">
        <div className="mk2-card">
          <div className="mk2-card-h">
            <div>
              <h2>Recent receipts</h2>
              <p>Rent into collection contracts</p>
            </div>
          </div>
          <table className="mk2-mini">
            <tbody>
              {feed.map((f) => (
                <tr key={f.sym + f.i}>
                  <td className="n dim">{fmtD(f.date)}</td>
                  <td className="sym">{f.sym}</td>
                  <td className="r n">{usd(f.amt)}</td>
                  <td className="r n dim">{f.cov.toFixed(2)}×</td>
                  <td className="r">
                    <TxLink seed={`${f.sym}-pay-${f.i}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mk2-card">
          <div className="mk2-card-h">
            <div>
              <h2>Collateral sites</h2>
              <p>Equipment monitored online, last month</p>
            </div>
          </div>
          <table className="mk2-mini">
            <tbody>
              {rows.map((r) => {
                const up = r.l.up.at(-1)!;
                return (
                  <tr key={r.m.sym}>
                    <td>
                      <i className={`dot ${up < 97 ? 'warn' : ''}`}></i>
                      {r.m.loan!.site}
                    </td>
                    <td className="dim">{r.m.loan!.gpu}</td>
                    <td className="r n">{up.toFixed(1)}% uptime</td>
                    <td className="r dim mono">{r.l.filing}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mk2-disc">
        <h2>Important information</h2>
        <p>
          Design prototype with sample data. Offered to verified institutional investors only. Loans are illiquid and can
          lose value; yields are not guaranteed and market prices can be below par. Coverage and uptime figures are
          reported by monitoring nodes and the collection contract and are not audited.
        </p>
      </section>
    </div>
  );
}

function Issue({
  n,
  ok,
  onGate,
  Locked,
}: {
  n: NewIssue;
  ok: boolean;
  onGate: ReturnType<typeof useGateClick>;
  Locked: ComponentType<{ w?: string }>;
}) {
  const { toast } = useDemo();
  const o = isOpen(n);
  const d = daysTo(o ? n.closes : n.deadline);
  const done = nDone(n);
  return (
    <article className="mk2-issue">
      <div className="mk2-issue-h">
        <span className="sym">{n.sym}</span>
        <span className={`mk2-status ${o ? 'live' : 'wait'}`}>{o ? 'Subscribing' : `Verifying · ${done}/6`}</span>
      </div>
      <h3>
        <Link to={`/asset-v2/${n.sym}`}>{n.name}</Link>
      </h3>
      <p className="sub">
        {n.gpu} · {n.site} · Offtake: {n.buyer}, {n.offtake} months
      </p>

      <div className="mk2-fill">
        <div className="mk2-bar">
          <i style={{ width: `${n.sub * 100}%` }}></i>
        </div>
        <div className="n">
          <b>{usd(n.amt * n.sub)}</b> of {usd(n.amt)} <span className="dim">· {pct(n.sub, 0)}</span>
        </div>
      </div>

      <dl className="mk2-terms">
        <div>
          <dt>Rate</dt>
          <dd className="n">{ok ? `${pct(n.rate, 2)} fixed` : <Locked />}</dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd className="n">{n.term} months</dd>
        </div>
        <div>
          <dt>LTV</dt>
          <dd className="n">{pct(n.amt / n.appraisal, 1)}</dd>
        </div>
        <div>
          <dt>Coverage at close</dt>
          <dd className="n">{(n.rent / mo(n.amt, n.rate, n.term)).toFixed(2)}×</dd>
        </div>
        <div>
          <dt>{o ? 'Closes' : 'Release deadline'}</dt>
          <dd className="n">
            {fmtD(o ? n.closes : n.deadline)}
            {d > 0 ? <span className="dim"> · {d}d</span> : null}
          </dd>
        </div>
        <div>
          <dt>Release conditions</dt>
          <dd>
            <span className="mk2-steps" title={`${done} of 6 signed`}>
              {n.cd.map((c, i) => (
                <i key={i} className={c ? 'on' : ''}></i>
              ))}
            </span>
            <span className="n dim"> {done}/6</span>
          </dd>
        </div>
      </dl>

      {ok && n.mine ? (
        <p className="mk2-mine n">
          Your subscription <b>{usd(n.mine)}</b> · in escrow
        </p>
      ) : null}

      <div className="mk2-act">
        {o ? (
          ok ? (
            <Link className="mk2-btn" to={`/asset/${n.sym}/subscribe`}>
              Subscribe
            </Link>
          ) : (
            <button className="mk2-btn" type="button" onClick={onGate}>
              Subscribe
            </button>
          )
        ) : null}
        <Link className="mk2-btn ghost" to={`/asset-v2/${n.sym}`}>
          Term sheet
        </Link>
        <button type="button" className="mk2-btn ghost" onClick={ok ? () => toast('Data room (demo)') : onGate}>
          <i className={`ph ph-folder-simple${ok ? '' : '-lock'}`}></i>Data room
        </button>
      </div>
    </article>
  );
}

function Collections({ months }: { months: { key: string; got: number; due: number }[] }) {
  const W = 680;
  const H = 240;
  const pl = 56;
  const pr = 8;
  const pt = 24;
  const pb = 28;
  const step = 250000;
  const top = Math.ceil((Math.max(...months.map((m) => Math.max(m.got, m.due))) * 1.1) / step) * step;
  const y = (v: number) => pt + (H - pt - pb) * (1 - v / top);
  const bw = (W - pl - pr) / months.length;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const thisMonth = new Date().toISOString().slice(0, 7);
  return (
    <svg className="mk2-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly rent collected versus debt service">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} className={t ? 'c-grid' : 'c-axis'} />
          <text x={pl - 8} y={y(t) + 4} textAnchor="end" className="c-tick">
            {t ? `$${t / 1e6}M` : '0'}
          </text>
        </g>
      ))}
      {months.map((m, i) => {
        const x = pl + i * bw;
        const mtd = m.key === thisMonth;
        const label = new Date(m.key + '-01T00:00:00').toLocaleDateString('en-US', { month: 'short' });
        return (
          <g key={m.key}>
            <title>
              {`${label}: ${usd(m.got)} collected, ${usd(Math.round(m.due))} due · ${(m.got / m.due).toFixed(2)}×`}
            </title>
            <rect
              x={x + bw * 0.24}
              y={y(m.got)}
              width={bw * 0.52}
              height={y(0) - y(m.got)}
              className={mtd ? 'c-col mtd' : 'c-col'}
            />
            <line x1={x + bw * 0.14} x2={x + bw * 0.86} y1={y(m.due)} y2={y(m.due)} className="c-due" />
            <text x={x + bw / 2} y={y(m.got) - 8} textAnchor="middle" className="c-val">
              {(m.got / m.due).toFixed(2)}×
            </text>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="c-tick">
              {mtd ? `${label} MTD` : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Mix({ title, rows, by, total }: { title: string; rows: Row[]; by: (r: Row) => string; total: number }) {
  const parts = [...rows.reduce((m, r) => m.set(by(r), (m.get(by(r)) ?? 0) + r.out), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]);
  return (
    <div className="mk2-mix">
      <span className="t">{title}</span>
      <div className="mk2-stack">
        {parts.map(([k, v], i) => (
          <i key={k} className={`s${i}`} style={{ width: `${(v / total) * 100}%` }} title={`${k} ${pct(v / total)}`}></i>
        ))}
      </div>
      <ul>
        {parts.map(([k, v], i) => (
          <li key={k}>
            <i className={`sw s${i}`}></i>
            <span>{k}</span>
            <b className="n">{pct(v / total, 0)}</b>
            <span className="n dim">{usdM(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Coverage history with the cure trigger as a dashed line. */
function Spark({ v }: { v: number[] }) {
  const W = 88;
  const H = 28;
  const lo = 1.1;
  const hi = 1.35;
  const y = (c: number) => H - 2 - ((Math.min(Math.max(c, lo), hi) - lo) / (hi - lo)) * (H - 4);
  const x = (i: number) => (v.length === 1 ? W / 2 : 2 + (i * (W - 4)) / (v.length - 1));
  const d = v.map((c, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join('');
  return (
    <svg className="mk2-spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <line x1="0" x2={W} y1={y(CURE)} y2={y(CURE)} className="cure" />
      <path d={d} className="ln" />
      <circle cx={x(v.length - 1)} cy={y(v.at(-1)!)} r="2.2" className="pt" />
    </svg>
  );
}

/** One mark per monthly rent receipt; amber when rent came in under contract. */
function Receipts({ l }: { l: Loan }) {
  return (
    <span className="mk2-receipts">
      {l.got.map((g, i) => (
        <i
          key={i}
          className={g < l.rent ? 'short' : ''}
          title={`${mon(l.firstPay, i)}: ${usd(g)} of ${usd(l.rent)} (${num((g / l.rent) * 100, 1)}%)`}
        ></i>
      ))}
      {Array.from({ length: Math.max(0, 8 - l.got.length) }, (_, i) => (
        <i key={'f' + i} className="todo"></i>
      ))}
    </span>
  );
}
