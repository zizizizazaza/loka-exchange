import { Link } from 'react-router';

import { Server3D } from '../../components/Server3D';
import { useDemo } from '../../demo/state';
import { bal, COND, type Loan, type Market, pmt } from '../../demo/data';
import { DocButtons, GateBox, GateBtn, LockStat, TxLink } from '../../demo/ui';
import { fmtD, mon, pct, usd, withArticle } from '../../lib/format';
import { Tabs } from './Tabs';

const TABS: [string, string, string?][] = [
  ['overview', 'Overview'],
  ['conditions', 'Release conditions', '6/6'],
  ['repayments', 'Repayments'],
  ['onchain', 'On-chain record'],
];

/** A funded loan that is repaying: the prototype's renderAsset() for loans. */
export function LoanDetail({ m, l, tab }: { m: Market; l: Loan; tab: string }) {
  const { ok } = useDemo();
  const sym = m.sym;
  const loan = m.loan!;
  const active = TABS.some((t) => t[0] === tab) ? tab : 'overview';
  const k = l.got.length;
  const p = pmt(l);
  const next = mon(l.firstPay, k, true);
  const mat = mon(l.firstPay, l.term - 1, true);
  const outstanding = bal(l, k);

  return (
    <div className="xwrap ad ad2">
      <div className="crumb">
        <Link to="/markets">Markets</Link>
        <i className="ph-light ph-caret-right"></i>
        <span>{sym}</span>
      </div>
      <section className="ad-band">
        <div className="ab-l">
          <div className="ad-eye">Compute credit · Senior secured loan · {sym}</div>
          <h1>{m.name}</h1>
          <div className="dmeta">
            <span>
              <i className="ph-light ph-cpu"></i>
              {loan.gpu}
            </span>
            <span>
              <i className="ph-light ph-map-pin"></i>
              {loan.site}
            </span>
            <span>
              <i className="ph-light ph-handshake"></i>Offtake: {l.buyer}
            </span>
          </div>
          <div className="ab-st">
            <span className="pill repaying">Repaying</span>
            <small>As of Oct 12, 2026 · sample data</small>
            {ok ? null : (
              <span className="ab-cta">
                <GateBtn />
              </span>
            )}
          </div>
        </div>
        <div className="ab-r">
          <Server3D />
          <small>Illustration · {parseInt(loan.gpu, 10) / 8} servers × 8 GPUs · drag to rotate</small>
        </div>
        <div className="ab-k">
          {ok ? (
            <div className="y">
              <span>Yield to maturity</span>
              <b className="num">{pct(m.yld!, 2)}</b>
              <em>{pct(l.rate)} fixed · monthly</em>
            </div>
          ) : (
            <LockStat title="Yield to maturity" />
          )}
          <div>
            <span>Outstanding</span>
            <b className="num">{usd(Math.round(outstanding))}</b>
            <em>of {usd(l.amount)}</em>
          </div>
          <div>
            <span>Next payment</span>
            <b className="num">{usd(Math.round(p))}</b>
            <em>{fmtD(next)}</em>
          </div>
          <div>
            <span>Coverage</span>
            <b className="num">{(l.got.at(-1)! / p).toFixed(2)}×</b>
            <em>Cure trigger 1.15×</em>
          </div>
          <div>
            <span>Loan to value</span>
            <b className="num">{pct(l.amount / l.appraisal, 1)}</b>
            <em>Limit 80%</em>
          </div>
        </div>
      </section>

      <section className="ad-prog">
        <div className="pg-h">
          <b>
            Repaying · month {k} of {l.term}
          </b>
          <span className="pg-r">
            <b className="num">{usd(Math.round(l.amount - outstanding))}</b> repaid · {pct(1 - outstanding / l.amount, 0)}
          </span>
        </div>
        <div className="pg-t">
          {Array.from({ length: l.term }, (_, i) => {
            const c = i < k ? l.got[i] / p : 0;
            const cls = i < k ? (c < 1.25 ? 'pd lo' : 'pd') : i === k ? 'nx' : '';
            const title = `${mon(l.firstPay, i)} · ${i < k ? `paid · ${c.toFixed(2)}× covered` : i === k ? 'next payment' : 'scheduled'}`;
            return <i key={i} className={cls} title={title}></i>;
          })}
        </div>
        <div className="pg-x">
          <span>Released {fmtD(l.released)}</span>
          <span className="lg">
            <em className="pd"></em>Paid<em className="pd lo"></em>Paid, coverage under 1.25×<em className="nx"></em>Next
            <em></em>Scheduled
          </span>
          <span>Matures {fmtD(mat)}</span>
        </div>
      </section>

      <Tabs base={`/asset/${sym}`} label="Asset sections" tabs={TABS} active={active}>
        {active === 'overview' && <Overview m={m} l={l} ok={ok} />}
        {active === 'conditions' && <Conditions sym={sym} l={l} />}
        {active === 'repayments' && <Repayments sym={sym} l={l} />}
        {active === 'onchain' && <OnChain sym={sym} l={l} />}
      </Tabs>
    </div>
  );
}

function Overview({ m, l, ok }: { m: Market; l: Loan; ok: boolean }) {
  const sym = m.sym;
  const loan = m.loan!;
  const p = pmt(l);
  const fee = Math.round(l.rent * 0.02);
  const op = Math.round(l.rent - p - fee);
  const ltv = l.amount / l.appraisal;
  const day = new Date(l.firstPay + 'T00:00:00').getDate();
  const buyer = l.buyer.startsWith('AI') ? l.buyer : l.buyer[0].toLowerCase() + l.buyer.slice(1);

  return (
    <>
      <section className="block">
        <div className="sec-t">
          <h2>About this loan</h2>
        </div>
        <p className="ad-about">
          {m.name} is a senior secured loan to a single-purpose company (SPV) that owns {loan.gpu} in {loan.site}. The GPUs
          are rented to {withArticle(buyer)} under a {l.offtake}-month offtake contract, and the rent repays holders every
          month through the collection contract. {sym} is a pro-rata claim on those repayments.
        </p>
        {ok ? (
          <div className="ad-tbl kt">
            <h4>Key terms</h4>
            <dl>
              <div>
                <dt>Instrument</dt>
                <dd>Senior secured loan to a bankruptcy-remote SPV</dd>
              </div>
              <div>
                <dt>Eligible investors</dt>
                <dd>Verified professional and institutional investors</dd>
              </div>
              <div>
                <dt>Collateral</dt>
                <dd>{loan.gpu}; SPV equity pledged</dd>
              </div>
              <div>
                <dt>Minimum subscription</dt>
                <dd className="num">$100,000</dd>
              </div>
              <div>
                <dt>Lien</dt>
                <dd>
                  First priority · <span className="mono">{l.filing}</span>
                </dd>
              </div>
              <div>
                <dt>Offtake</dt>
                <dd>{l.offtake} months at signing (minimum 24)</dd>
              </div>
              <div>
                <dt>Principal · rate</dt>
                <dd className="num">
                  {usd(l.amount)} · {pct(l.rate)} fixed
                </dd>
              </div>
              <div>
                <dt>Uptime, last month</dt>
                <dd className="num">{l.up.at(-1)!.toFixed(1)}% · signed by monitoring nodes</dd>
              </div>
              <div>
                <dt>Term</dt>
                <dd>
                  {l.term} months · matures {fmtD(mon(l.firstPay, l.term - 1, true))}
                </dd>
              </div>
              <div>
                <dt>Reserve</dt>
                <dd>3 months · {usd(Math.round(p * 3))}</dd>
              </div>
              <div>
                <dt>Payments</dt>
                <dd>Monthly, level · day {day}</dd>
              </div>
              <div>
                <dt>Cure</dt>
                <dd>Below 1.15× coverage · 30 days</dd>
              </div>
              <div>
                <dt>Settlement</dt>
                <dd>AIUSD; redeemable 1:1 for USDC</dd>
              </div>
            </dl>
          </div>
        ) : (
          <GateBox title="Key terms" items={['Rate and yield', 'Minimum subscription', 'Term and maturity', 'Funding split']} />
        )}
        <div className="ad-tbl kt">
          <h4>
            Service providers <span>Sample · named at listing</span>
          </h4>
          <dl>
            <div>
              <dt>Escrow</dt>
              <dd>
                Escrow contract <TxLink seed={sym + 'esc'} />
              </dd>
            </div>
            <div>
              <dt>Collection</dt>
              <dd>
                Collection contract <TxLink seed={sym + 'col'} />
              </dd>
            </div>
            <div>
              <dt>Equipment monitoring</dt>
              <dd>Independent monitoring nodes</dd>
            </div>
            <div>
              <dt>Appraisal</dt>
              <dd>Independent GPU appraiser</dd>
            </div>
            <div>
              <dt>Legal counsel</dt>
              <dd>Borrower's counsel, lien and SPV</dd>
            </div>
            <div>
              <dt>AIUSD</dt>
              <dd>Minted and redeemed 1:1 against USDC</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="block">
        <div className="ov2">
          <div className="ovc">
            <div className="ovc-h">
              <h3>Collateral</h3>
              <span>Appraisal {usd(l.appraisal)}</span>
            </div>
            <div className="ltv2 sm">
              <i style={{ width: `${ltv * 100}%` }}></i>
              <em></em>
              <u style={{ left: '80%' }}></u>
            </div>
            <dl className="cf2">
              <div>
                <dt>
                  <i className="c1"></i>Loan
                </dt>
                <dd className="num">{usd(l.amount)}</dd>
                <dd className="pc">{pct(ltv, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="eq"></i>Operator equity, first loss
                </dt>
                <dd className="num">{usd(l.appraisal - l.amount)}</dd>
                <dd className="pc">{pct(1 - ltv, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="lim"></i>Maximum loan allowed
                </dt>
                <dd className="num">{usd(l.appraisal * 0.8)}</dd>
                <dd className="pc">80%</dd>
              </div>
            </dl>
            <p className="ovc-n">A fall in value hits the operator's equity before holders.</p>
          </div>
          <div className="ovc">
            <div className="ovc-h">
              <h3>Monthly cash flow</h3>
              <span>Rent {usd(l.rent)}</span>
            </div>
            <div className="cflow">
              <i className="c1" style={{ flex: p }}></i>
              <i className="c2" style={{ flex: fee }}></i>
              <i className="c3" style={{ flex: op }}></i>
            </div>
            <dl className="cf2">
              <div>
                <dt>
                  <i className="c1"></i>1 · {sym} holders
                </dt>
                <dd className="num">{usd(Math.round(p))}</dd>
                <dd className="pc">{pct(p / l.rent, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="c2"></i>2 · Service fee
                </dt>
                <dd className="num">{usd(fee)}</dd>
                <dd className="pc">{pct(fee / l.rent, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="c3"></i>3 · Operator, the rest
                </dt>
                <dd className="num">{usd(op)}</dd>
                <dd className="pc">{pct(op / l.rent, 0)}</dd>
              </div>
            </dl>
            <p className="ovc-n">Holders are paid first. Coverage {(l.rent / p).toFixed(2)}×.</p>
          </div>
        </div>
      </section>
      <section className="block">
        <div className="sec-t">
          <h2>Protections</h2>
        </div>
        <div className="prot2">
          <div>
            <b>Operator takes first loss</b>
            <span>The loan is capped at 80% of appraised value.</span>
          </div>
          <div>
            <b>Three-month reserve</b>
            <span>{usd(Math.round(p * 3))} sits in the collection contract from day one.</span>
          </div>
          <div>
            <b>Coverage checked monthly</b>
            <span>Below 1.15×, a 30-day cure period starts.</span>
          </div>
          <div>
            <b>Enforcement</b>
            <span>If the cure fails, the GPUs are re-rented or sold; proceeds repay holders first.</span>
          </div>
        </div>
      </section>
      <section className="block">
        <div className="sec-t">
          <h2>Documents</h2>
          <p>Originals stay with the signer; the on-chain hash shows they have not been altered</p>
        </div>
        <div className="docs2">
          <DocButtons
            docs={[
              ['Term sheet', 'PDF'],
              ['Appraisal report', 'PDF'],
              ['Offtake agreement, summary', 'PDF'],
              ['Lien filing', 'PDF'],
            ]}
          />
        </div>
      </section>
    </>
  );
}

function Conditions({ sym, l }: { sym: string; l: Loan }) {
  return (
    <section className="block">
      <div className="panel">
        {COND.map(([t, by], i) => (
          <div className="crow" key={t}>
            <span className="cidx ok">
              <i className="ph ph-check"></i>
            </span>
            <span>
              <b>{t}</b>
              <small>
                Signed by {by}
                {i === 2 ? ` · filing ${l.filing}` : ''}
                {i === 5 ? ` · ${usd(l.appraisal)} appraisal` : ''}
              </small>
            </span>
            <span className="r">
              <small>{fmtD(l.cd[i])}</small>
              <TxLink seed={sym + 'c' + i} />
            </span>
          </div>
        ))}
        <p className="note-line" style={{ margin: 0, padding: '14px 24px 18px' }}>
          Each step happened off-chain and was signed by the party shown; only hashes, numbers and signatures are on-chain.
          Original documents stay with the signer and the platform, and the hash shows they have not been altered.
        </p>
      </div>
    </section>
  );
}

function Repayments({ sym, l }: { sym: string; l: Loan }) {
  const p = pmt(l);
  const rows = l.got.map((g, i) => ({ mon: mon(l.firstPay, i), g, u: l.up[i], c: g / p }));
  const mx = 1.6;
  return (
    <>
      <section className="block">
        <div className="sec-t">
          <h2>Coverage by month</h2>
          <p>Rent received ÷ payment due</p>
        </div>
        <div className="panel chart">
          <div className="cov">
            <span className="axis" style={{ bottom: '100%' }}>
              1.6×
            </span>
            <span className="axis" style={{ bottom: `${(1 / mx) * 100}%` }}>
              1.0×
            </span>
            <span className="axis" style={{ bottom: 0 }}>
              0
            </span>
            <div className="thr" style={{ bottom: `${(1.15 / mx) * 100}%` }}>
              <span>1.15× cure trigger</span>
            </div>
            {rows.map((r, i) => (
              <div className="col" key={i}>
                <b>{r.c.toFixed(2)}×</b>
                <i className={r.c < 1.25 ? 'low' : ''} style={{ height: `${(r.c / mx) * 100}%` }}></i>
              </div>
            ))}
          </div>
          <div className="cov-x">
            {rows.map((r, i) => (
              <span key={i}>{r.mon.split(' ')[0]}</span>
            ))}
          </div>
        </div>
      </section>
      <section className="block">
        <div className="sec-t">
          <h2>Monthly disclosure</h2>
        </div>
        <div className="panel tbl-wrap">
          <table className="tbl xt">
            <thead>
              <tr>
                <th>Month</th>
                <th>Rent due</th>
                <th>Received</th>
                <th>Uptime</th>
                <th>To holders</th>
                <th>Coverage</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .reverse()
                .map((r, j) => (
                  <tr key={j}>
                    <td>{r.mon}</td>
                    <td>{usd(l.rent)}</td>
                    <td>{usd(r.g)}</td>
                    <td>{r.u.toFixed(1)}%</td>
                    <td>{usd(Math.round(p))}</td>
                    <td className={r.c < 1.25 ? 'neg' : ''}>{r.c.toFixed(2)}×</td>
                    <td>
                      <TxLink seed={sym + 'p' + j} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

interface Ev {
  d: string;
  ic: string;
  t: string;
  s: string;
  a?: string;
  seed: string;
}

function OnChain({ sym, l }: { sym: string; l: Loan }) {
  const p = pmt(l);
  const rent: Ev[] = l.got
    .map((g, i) => ({
      d: mon(l.firstPay, i, true),
      ic: 'ph-arrow-down-left',
      t: `Rent received · ${mon(l.firstPay, i).split(' ')[0]}`,
      s: `${usd(Math.round(p))} paid to holders first`,
      a: usd(g),
      seed: sym + 'p' + i,
    }))
    .reverse();
  const release: Ev = { d: l.released, ic: 'ph-arrow-square-out', t: 'Released to borrower SPV', s: 'All six conditions met', a: usd(l.amount), seed: sym + 'rel' };
  const conditions: Ev[] = COND.map(([t], i) => ({ d: l.cd[i], ic: 'ph-seal-check', t: `Condition ${i + 1} recorded`, s: t, seed: sym + 'c' + i })).sort(
    (a, b) => b.d.localeCompare(a.d),
  );
  const events = [...rent, release, ...conditions];
  return (
    <>
      <section className="block">
        <div className="sec-t">
          <h2>Contracts</h2>
        </div>
        <div className="panel">
          <dl className="contracts">
            <div>
              <dt>{sym} token</dt>
              <dd>
                <TxLink seed={sym + 'tok'} />
                <small>Transferable; traded as {sym}/AIUSD</small>
              </dd>
            </div>
            <div>
              <dt>Escrow contract</dt>
              <dd>
                <TxLink seed={sym + 'esc'} />
                <small>Released {fmtD(l.released)}</small>
              </dd>
            </div>
            <div>
              <dt>Collection contract</dt>
              <dd>
                <TxLink seed={sym + 'col'} />
                <small>Receives rent; pays in order</small>
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="block">
        <div className="sec-t">
          <h2>Activity</h2>
        </div>
        <div className="panel">
          <ul className="events">
            {events.map((e) => (
              <li key={e.seed}>
                <i className={`ph-light ${e.ic}`}></i>
                <span>
                  <b>{e.t}</b>
                  <small>{e.s}</small>
                </span>
                <span className="r">
                  {e.a ? <em>{e.a}</em> : null}
                  <small>{fmtD(e.d)}</small>
                  <TxLink seed={e.seed} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
