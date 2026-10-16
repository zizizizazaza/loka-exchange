import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';

import { Server3D } from '../../components/Server3D';
import { useDemo } from '../../demo/state';
import { COND, isOpen, MIN_SUB, mo, nDone, type NewIssue, nState } from '../../demo/data';
import { DocButtons, GateBox, LockStat, TxLink } from '../../demo/ui';
import { fmtD, num, pct, usd, usdK, usdM, withArticle } from '../../lib/format';
import { InvestPanel, type InvestOptions } from './InvestPanel';
import { Tabs } from './Tabs';

const TODAY = new Date('2026-10-12T00:00:00');

/** A new issue still raising or waiting for its release conditions: the prototype's renderNewIssue(). */
export function NewIssueDetail({ n, tab }: { n: NewIssue; tab: string }) {
  const { ok, subscribe, withdraw } = useDemo();
  const navigate = useNavigate();
  const o = isOpen(n);
  const raised = n.amt * n.sub;
  const left = Math.max(0, Math.round(n.amt - raised));
  const done = nDone(n);
  const tabs: [string, string, string?][] = [
    ['overview', 'Overview'],
    ['conditions', 'Release conditions', `${done}/6`],
    ['onchain', 'On-chain record'],
  ];
  const focus = tab === 'subscribe';
  const active = tabs.some((t) => t[0] === tab) ? tab : 'overview';
  const ltv = n.amt / n.appraisal;
  const days = Math.max(0, Math.round((new Date(n.closes + 'T00:00:00').getTime() - TODAY.getTime()) / 864e5));
  const noYear = (s: string) => s.replace(/, \d{4}$/, '');

  // #/asset/<sym>/subscribe focuses the amount field, then the URL drops the /subscribe, as in the prototype.
  useEffect(() => {
    if (focus) navigate(`/asset/${n.sym}`, { replace: true, preventScrollReset: true });
  }, [focus, n.sym, navigate]);

  const steps: [string, string, string][] = [
    ['Subscriptions open', fmtD(n.opened), 'done'],
    ['Fully subscribed', o ? `By ${fmtD(n.closes)}` : fmtD(n.full!), o ? 'now' : 'done'],
    ['Six conditions signed', `${done} of 6`, o ? 'todo' : 'now'],
    ['Funds released', `By ${fmtD(n.deadline)}`, 'todo'],
    ['First payment', 'A month after release', 'todo'],
  ];

  const io: InvestOptions = {
    title: 'Subscribe',
    min: Math.min(MIN_SUB, left),
    max: left,
    quick: [100000, 250000, 500000, 'max'],
    mine: n.mine,
    rows: [
      ['Rate', `${pct(n.rate)} fixed · ${n.term} months`],
      [
        'Funds go to',
        <>
          Escrow contract <TxLink seed={n.sym + 'esc'} />
        </>,
      ],
    ],
    calcLabel: 'Expected monthly payment',
    calc: (a) => usd(Math.round(mo(a, n.rate, n.term))),
    ack: 'I have read the term sheet and the risk disclosure',
    cta: 'Subscribe',
    note: 'Signed with your wallet. AIUSD moves from your account to the escrow contract.',
    withdraw: () => withdraw(n.sym),
    done: (a) => subscribe(n.sym, a),
    toast: (a) => `Subscribed ${num(a)} AIUSD to ${n.sym}. Held in escrow until release (demo)`,
  };

  return (
    <div className="xwrap ad ad2">
      <div className="crumb">
        <Link to="/markets">Markets</Link>
        <i className="ph-light ph-caret-right"></i>
        <span>{n.sym}</span>
        {/* Review only: switch to the institutional take (#/asset-v2). Remove once a direction is chosen. */}
        <Link to={`/asset-v2/${n.sym}`} style={{ marginLeft: 'auto', color: 'var(--ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
          View the new layout
        </Link>
      </div>
      <section className="ad-band">
        <div className="ab-l">
          <div className="ad-eye">Compute credit · New issue · {n.sym}</div>
          <h1>{n.name}</h1>
          <div className="dmeta">
            <span>
              <i className="ph-light ph-cpu"></i>
              {n.gpu}
            </span>
            <span>
              <i className="ph-light ph-map-pin"></i>
              {n.site}
            </span>
            <span>
              <i className="ph-light ph-handshake"></i>Offtake: {n.buyer}
            </span>
          </div>
          <div className="ab-st">
            <span className={`pill ${o ? 'raising' : 'verifying'}`}>{nState(n)}</span>
            <small>As of Oct 12, 2026 · sample data</small>
          </div>
        </div>
        <div className="ab-r">
          <Server3D />
          <small>Illustration · {parseInt(n.gpu, 10) / 8} servers × 8 GPUs · drag to rotate</small>
        </div>
        <div className="ab-k">
          {ok ? (
            <div className="y">
              <span>Fixed rate</span>
              <b className="num">{pct(n.rate, 2)}</b>
              <em>Paid monthly · {n.term} months</em>
            </div>
          ) : (
            <LockStat title="Fixed rate" />
          )}
          <div>
            <span>Raising</span>
            <b className="num">{usd(n.amt)}</b>
            <em>{pct(n.sub, 0)} subscribed</em>
          </div>
          <div>
            <span>{o ? 'Closes' : 'Release deadline'}</span>
            <b className="num">{noYear(fmtD(o ? n.closes : n.deadline))}</b>
            <em>{o ? `${days} days left` : `${done} of 6 conditions met`}</em>
          </div>
          <div>
            <span>Minimum</span>
            <b className="num">{usdK(MIN_SUB)}</b>
            <em>Per subscription</em>
          </div>
          <div>
            <span>Loan to value</span>
            <b className="num">{pct(ltv, 1)}</b>
            <em>Limit 80%</em>
          </div>
        </div>
      </section>

      <section className="ad-prog ip">
        <div className="ip-l">
          <div className="pg-h">
            <b>{o ? 'Raised so far' : 'Fully subscribed'}</b>
            <span className="pg-r">
              <b className="num">{usd(Math.round(raised))}</b> of {usd(n.amt)} · {pct(n.sub, 0)}
            </span>
          </div>
          <div className="ip-bar">
            <i className="v" style={{ width: '0%' }}></i>
            <i className="d" style={{ width: `${(raised / n.amt) * 100}%` }}></i>
          </div>
          <div className="ip-leg">
            <span>
              <em className="d"></em>Subscribed <b className="num">{usdM(raised)}</b>
            </span>
            {o ? (
              <span>
                <em></em>Remaining <b className="num">{usdM(left)}</b>
              </span>
            ) : null}
          </div>
          <ol className="ip-steps">
            {steps.map(([t, d, c]) => (
              <li className={c} key={t}>
                <i></i>
                <b>{t}</b>
                <small>{d}</small>
              </li>
            ))}
          </ol>
          <ul className="ip-facts">
            <li>
              <i className="ph-light ph-vault"></i>
              <span>
                <b>Held in escrow, not by Loka</b>The escrow contract releases funds only when all six conditions are
                recorded.
              </span>
            </li>
            <li>
              <i className="ph-light ph-arrow-counter-clockwise"></i>
              <span>
                <b>{o ? `Withdraw until ${noYear(fmtD(n.closes))}` : 'Locked until release'}</b>
                {o
                  ? 'Any time before the issue is fully subscribed or the window closes.'
                  : 'The issue is fully subscribed, so subscriptions can no longer be withdrawn.'}
              </span>
            </li>
            <li>
              <i className="ph-light ph-shield-check"></i>
              <span>
                <b>Refund if not released</b>Every subscription comes back in full if the conditions are not met by{' '}
                {fmtD(n.deadline)}.
              </span>
            </li>
          </ul>
        </div>
        <div className="ip-r">
          {o ? (
            <InvestPanel o={io} focus={focus} />
          ) : (
            <div className="inv">
              <div className="inv-h">
                <b>Subscription closed</b>
              </div>
              <p className="inv-p">
                Fully subscribed on {fmtD(n.full!)}. Waiting for {6 - done} of 6 release conditions.
              </p>
              {ok && n.mine ? (
                <div className="inv-mine">
                  <span>Your subscription</span>
                  <b className="num">{usd(n.mine)}</b>
                  <small>Locked until release</small>
                </div>
              ) : null}
              <dl className="inv-dl">
                <div>
                  <dt>Release deadline</dt>
                  <dd>{fmtD(n.deadline)}</dd>
                </div>
                <div>
                  <dt>If not met</dt>
                  <dd>Full refund to every subscriber</dd>
                </div>
                <div>
                  <dt>Held in</dt>
                  <dd>
                    Escrow contract <TxLink seed={n.sym + 'esc'} />
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </section>

      <Tabs base={`/asset/${n.sym}`} label="Issue sections" tabs={tabs} active={active}>
        {active === 'overview' && <Overview n={n} ok={ok} />}
        {active === 'conditions' && <Conditions n={n} />}
        {active === 'onchain' && <OnChain n={n} raised={raised} />}
      </Tabs>
    </div>
  );
}

function Overview({ n, ok }: { n: NewIssue; ok: boolean }) {
  const p = mo(n.amt, n.rate, n.term);
  const fee = Math.round(n.rent * 0.02);
  const op = Math.round(n.rent - p - fee);
  const ltv = n.amt / n.appraisal;
  const art = withArticle(n.buyer[0].toLowerCase() + n.buyer.slice(1));
  return (
    <>
      <section className="block">
        <div className="sec-t">
          <h2>About this loan</h2>
        </div>
        <p className="ad-about">
          {n.name} is a new senior secured loan to a single-purpose company (SPV) that owns {n.gpu} in {n.site}. The GPUs are
          already installed and rented to {art} under a {n.offtake}-month offtake contract. Subscriptions wait in an escrow
          contract and are released only after all six conditions are signed and recorded on-chain. If they are not met by{' '}
          {fmtD(n.deadline)}, every subscriber is refunded in full.
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
                <dd>Verified institutional investors</dd>
              </div>
              <div>
                <dt>Principal · rate</dt>
                <dd className="num">
                  {usd(n.amt)} · {pct(n.rate)} fixed
                </dd>
              </div>
              <div>
                <dt>Minimum subscription</dt>
                <dd className="num">{usd(MIN_SUB)}</dd>
              </div>
              <div>
                <dt>Term</dt>
                <dd>{n.term} months, level monthly payments</dd>
              </div>
              <div>
                <dt>Subscription window</dt>
                <dd>
                  {fmtD(n.opened)} to {fmtD(n.closes)}
                </dd>
              </div>
              <div>
                <dt>Collateral</dt>
                <dd>{n.gpu}; SPV equity pledged</dd>
              </div>
              <div>
                <dt>Release deadline</dt>
                <dd>{fmtD(n.deadline)} · full refund if not met</dd>
              </div>
              <div>
                <dt>Offtake</dt>
                <dd>{n.offtake} months remaining (minimum 24)</dd>
              </div>
              <div>
                <dt>Allocation</dt>
                <dd>First come, first served</dd>
              </div>
              <div>
                <dt>Reserve</dt>
                <dd>3 months · {usd(Math.round(p * 3))}, funded at release</dd>
              </div>
              <div>
                <dt>Withdrawals</dt>
                <dd>Until fully subscribed or the window closes</dd>
              </div>
            </dl>
          </div>
        ) : (
          <GateBox title="Key terms" items={['Rate', 'Minimum subscription', 'Allocation and withdrawal rules', 'Release deadline']} />
        )}
      </section>
      <section className="block">
        <div className="ov2">
          <div className="ovc">
            <div className="ovc-h">
              <h3>Collateral</h3>
              <span>Appraisal {usd(n.appraisal)}</span>
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
                <dd className="num">{usd(n.amt)}</dd>
                <dd className="pc">{pct(ltv, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="eq"></i>Operator equity, first loss
                </dt>
                <dd className="num">{usd(n.appraisal - n.amt)}</dd>
                <dd className="pc">{pct(1 - ltv, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="lim"></i>Maximum loan allowed
                </dt>
                <dd className="num">{usd(n.appraisal * 0.8)}</dd>
                <dd className="pc">80%</dd>
              </div>
            </dl>
            <p className="ovc-n">A fall in value hits the operator's equity before holders.</p>
          </div>
          <div className="ovc">
            <div className="ovc-h">
              <h3>Expected monthly cash flow</h3>
              <span>Rent {usd(n.rent)}</span>
            </div>
            <div className="cflow">
              <i className="c1" style={{ flex: p }}></i>
              <i className="c2" style={{ flex: fee }}></i>
              <i className="c3" style={{ flex: op }}></i>
            </div>
            <dl className="cf2">
              <div>
                <dt>
                  <i className="c1"></i>1 · {n.sym} holders
                </dt>
                <dd className="num">{usd(Math.round(p))}</dd>
                <dd className="pc">{pct(p / n.rent, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="c2"></i>2 · Service fee
                </dt>
                <dd className="num">{usd(fee)}</dd>
                <dd className="pc">{pct(fee / n.rent, 0)}</dd>
              </div>
              <div>
                <dt>
                  <i className="c3"></i>3 · Operator, the rest
                </dt>
                <dd className="num">{usd(op)}</dd>
                <dd className="pc">{pct(op / n.rent, 0)}</dd>
              </div>
            </dl>
            <p className="ovc-n">Starts the month after release. Coverage {(n.rent / p).toFixed(2)}×.</p>
          </div>
        </div>
      </section>
      <section className="block">
        <div className="sec-t">
          <h2>Protections</h2>
        </div>
        <div className="prot2">
          <div>
            <b>Refund if not released</b>
            <span>Escrow returns every subscription in full if the six conditions are not met by {fmtD(n.deadline)}.</span>
          </div>
          <div>
            <b>Operator takes first loss</b>
            <span>The loan is capped at 80% of appraised value.</span>
          </div>
          <div>
            <b>Three-month reserve</b>
            <span>Set aside in the collection contract on release day.</span>
          </div>
          <div>
            <b>Rent paid to holders first</b>
            <span>The buyer pays into a controlled account; holders are paid before the operator.</span>
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
              ['Risk disclosure', 'PDF'],
            ]}
          />
        </div>
      </section>
    </>
  );
}

function Conditions({ n }: { n: NewIssue }) {
  return (
    <section className="block">
      <div className="panel">
        {COND.map(([t, by], i) =>
          n.cd[i] ? (
            <div className="crow" key={t}>
              <span className="cidx ok">
                <i className="ph ph-check"></i>
              </span>
              <span>
                <b>{t}</b>
                <small>Signed by {by}</small>
              </span>
              <span className="r">
                <small>{fmtD(n.cd[i]!)}</small>
                <TxLink seed={n.sym + 'c' + i} />
              </span>
            </div>
          ) : (
            <div className="crow" key={t}>
              <span className="cidx">{i + 1}</span>
              <span>
                <b>{t}</b>
                <small>{i === 0 ? `${pct(n.sub, 0)} subscribed · checked by the escrow contract` : `To be signed by ${by}`}</small>
              </span>
              <span className="r">
                <small className="muted">Waiting</small>
              </span>
            </div>
          ),
        )}
        <p className="note-line" style={{ margin: 0, padding: '14px 24px 18px' }}>
          Conditions can be signed in any order while the issue is open. Funds move only when all six are recorded;
          otherwise every subscriber is refunded on {fmtD(n.deadline)}.
        </p>
      </div>
    </section>
  );
}

function OnChain({ n, raised }: { n: NewIssue; raised: number }) {
  const events = COND.map(([t], i) =>
    n.cd[i] ? { d: n.cd[i]!, ic: 'ph-seal-check', t: `Condition ${i + 1} recorded`, s: t, seed: n.sym + 'c' + i } : null,
  )
    .filter((e) => e !== null)
    .concat([{ d: n.opened, ic: 'ph-arrow-down-left', t: 'Subscriptions opened', s: 'Escrow contract accepting AIUSD', seed: n.sym + 'open' }])
    .sort((a, b) => b.d.localeCompare(a.d));
  return (
    <>
      <section className="block">
        <div className="sec-t">
          <h2>Contracts</h2>
        </div>
        <div className="panel">
          <dl className="contracts">
            <div>
              <dt>Escrow contract</dt>
              <dd>
                <TxLink seed={n.sym + 'esc'} />
                <small>Holds {usd(Math.round(raised))} in subscriptions</small>
              </dd>
            </div>
            <div>
              <dt>Collection contract</dt>
              <dd>
                <TxLink seed={n.sym + 'col'} />
                <small>Deployed; receives rent after release</small>
              </dd>
            </div>
            <div>
              <dt>{n.sym} token</dt>
              <dd>
                <TxLink seed={n.sym + 'tok'} />
                <small>Issued to subscribers at release</small>
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
