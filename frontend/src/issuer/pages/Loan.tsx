import { useState } from 'react';
import { useParams } from 'react-router';

import { fmtD, hx, pct, short, usd, usdM } from '../../lib/format';
import {
  addMonth,
  balanceAfter,
  byId,
  daysTo,
  iso,
  need,
  payment,
  type RepayingLoan,
  type ReviewLoan,
  type Task,
  type VerifyingLoan,
} from '../data';
import { useToast } from '../toast';
import { Loans } from './Loans';
import { LoanHead, Tx } from './parts';

/** #/loan/<id>[/<tab>]: the prototype's renderLoan(). Unknown ids show the loans list, as in the prototype. */
export function Loan() {
  const { id = '', tab = '' } = useParams();
  const l = byId(id);
  if (!l) return <Loans />;
  if (l.status === 'review') return <Review l={l} />;

  if (l.status === 'verifying') {
    const t = ['tasks', 'terms'].includes(tab) ? tab : 'tasks';
    const done = l.tasks.filter((x) => x.s === 'done').length;
    return (
      <>
        <LoanHead
          l={l}
          tabs={[
            ['tasks', 'Drawdown tasks', `${done}/6`],
            ['terms', 'Terms'],
          ]}
          tab={t}
        />
        {t === 'tasks' ? <Tasks l={l} /> : <Terms l={l} />}
      </>
    );
  }

  const t = ['repayments', 'terms'].includes(tab) ? tab : 'repayments';
  return (
    <>
      <LoanHead
        l={l}
        tabs={[
          ['repayments', 'Repayments'],
          ['terms', 'Terms'],
        ]}
        tab={t}
      />
      {t === 'repayments' ? <Repayments l={l} /> : <Terms l={l} />}
    </>
  );
}

/* Before release: the six conditions as six task cards. */

function Tasks({ l }: { l: VerifyingLoan }) {
  const done = l.tasks.filter((t) => t.s === 'done').length;
  const n = need(l);
  const days = daysTo(l.refundBy);
  return (
    <div className="dbody">
      <div>
        <div className="panel">
          <div className="cond-sum">
            <b className="num">
              {done}
              <small>of 6 recorded</small>
            </b>
            <div className="segs6">
              {l.tasks.map((t, i) => (
                <i key={i} className={t.s === 'done' ? 'met' : 'pending'}></i>
              ))}
            </div>
            <p>
              {n ? <strong className="amb">{n} need you.</strong> : null}
              {n ? ' ' : ''}When all six are recorded on-chain, the escrow pays {usdM(l.subscribed)} to your SPV account.
            </p>
          </div>
          {l.tasks.map((t, i) => (
            <div className={`task ${t.s}`} key={t.t}>
              <span className="cidx">{t.s === 'done' ? <i className="ph ph-check"></i> : i + 1}</span>
              <div className="tmain">
                <div className="ttop">
                  <b>{t.t}</b>
                  {t.s === 'action' ? (
                    <span className="pill verifying">Needs you</span>
                  ) : t.s === 'done' ? (
                    <span className="pill repaying">Recorded</span>
                  ) : null}
                </div>
                <p className="td">{t.d}</p>
                <dl className="tkv">
                  <div>
                    <dt>Your part</dt>
                    <dd>{t.yours}</dd>
                  </div>
                  <div>
                    <dt>Signed by</dt>
                    <dd>{t.who}</dd>
                  </div>
                </dl>
                <TaskBody l={l} t={t} i={i} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="aside">
        <div className="panel card dark">
          <h3>
            Escrow <span className="pill plain locked">Locked</span>
          </h3>
          <div className="bigv num">
            {l.subscribed.toLocaleString('en-US')}
            <small>AIUSD</small>
          </div>
          <dl className="kv">
            <div>
              <dt>Drawn to</dt>
              <dd>{l.spv}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd className="mono">{short(hx(l.id + 'spv').slice(0, 42))}</dd>
            </div>
            <div>
              <dt>Paid out as</dt>
              <dd>USDC, 1:1</dd>
            </div>
            <div>
              <dt>Deadline</dt>
              <dd>
                {fmtD(l.refundBy)} · {days} days
              </dd>
            </div>
          </dl>
          <p className="small">
            If the six conditions are not recorded by the deadline, the money goes back to lenders. The account was fixed
            when the facility opened for commitments and cannot be changed.
          </p>
        </div>
        <div className="panel card">
          <h3>After drawdown</h3>
          <dl className="kv" style={{ marginTop: 0 }}>
            <div>
              <dt>First payment</dt>
              <dd>The month after drawdown</dd>
            </div>
            <div>
              <dt>Paid to lenders</dt>
              <dd className="num">{usd(Math.round(payment(l)))} / month</dd>
            </div>
            <div>
              <dt>Rent under offtake</dt>
              <dd className="num">{usd(l.rent)} / month</dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd className="num">{(l.rent / payment(l)).toFixed(2)}× (trigger 1.15×)</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

/** Extra detail and actions under a task: the prototype's taskBody() and bindTasks(). */
function TaskBody({ l, t, i }: { l: VerifyingLoan; t: Task; i: number }) {
  const toast = useToast();
  const [reminded, setReminded] = useState(false);
  const [checking, setChecking] = useState(false);
  const seed = l.id + 't' + i;

  let extra = null;
  if (t.files)
    extra = (
      <ul className="files">
        {t.files.map((f) => (
          <li key={f}>
            <i className="ph-light ph-file-text"></i>
            {f}
            <span className="mono muted">{short(hx(seed + f))}</span>
          </li>
        ))}
      </ul>
    );
  if (i === 0)
    extra = (
      <>
        <div className="meter">
          <span className="num">
            {usd(l.subscribed)} of {usd(l.amount)}
          </span>
          <div className="bar">
            <i style={{ width: '100%', background: 'var(--accent)' }}></i>
          </div>
        </div>
        <p className="tnote">
          {l.investors} lenders, through the escrow contract.
        </p>
      </>
    );
  if (t.filing)
    extra = (
      <p className="tnote">
        Filing number <span className="mono">{t.filing}</span>
      </p>
    );
  if (i === 5)
    extra = (
      <p className="tnote">
        Appraised at {usd(l.appraisal)}. Loan {usd(l.amount)} = {pct(l.amount / l.appraisal)} of value (limit 80%).
      </p>
    );
  if (t.sigs) {
    const names = ['Buyer', 'You', 'Platform'];
    extra = (
      <div className="sigs">
        {t.sigs.map((s, k) => (
          <span key={k} className={`sig ${s ? 'ok' : 'wait'}`}>
            <i className={`ph ${s ? 'ph-check' : 'ph-clock'}`}></i>
            {names[k]}
            {s ? ' · signed' : ' · not yet'}
          </span>
        ))}
      </div>
    );
  }
  if (t.racks) {
    const on = t.racks.reduce((s, r) => s + r[2], 0);
    extra = (
      <>
        <div className="racks">
          {t.racks.map(([r, n, o]) => (
            <div className={`rk ${o < n ? 'off' : ''}`} key={r}>
              <span>{r}</span>
              <div className="bar">
                <i style={{ width: `${(o / n) * 100}%` }}></i>
              </div>
              <b className="num">
                {o} / {n}
              </b>
            </div>
          ))}
        </div>
        <p className="tnote">
          {on} of {l.qty} GPUs verified · model {l.gpu} matches.
        </p>
      </>
    );
  }

  const acts =
    i === 3 ? (
      <>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={reminded}
          onClick={() => {
            setReminded(true);
            toast('Reminder sent to your buyer’s signer');
          }}
        >
          {reminded ? 'Reminder sent' : 'Send reminder to buyer'}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={() => toast('Signing link copied')}>
          Copy signing link
        </button>
      </>
    ) : i === 4 ? (
      <>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => toast('Setup guide opened in a new tab (demo)')}>
          Setup guide
        </button>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            setChecking(true);
            setTimeout(() => {
              setChecking(false);
              toast('Still 32 GPUs not reporting on Rack B3–B4');
            }, 900);
          }}
        >
          {checking ? 'Checking…' : 'Check again'}
        </button>
      </>
    ) : null;

  return (
    <>
      {extra}
      {acts ? <div className="tacts">{acts}</div> : null}
      {t.s === 'done' ? (
        <div className="tproof">
          <span className="label">On-chain proof</span>
          <Tx seed={seed + 'p'} />
          <span className="muted">{fmtD(t.date!)}</span>
        </div>
      ) : null}
    </>
  );
}

/* Repaying */

function Repayments({ l }: { l: RepayingLoan }) {
  const toast = useToast();
  const pay = payment(l);
  const k = l.months.length;
  const last = l.months.at(-1)!;
  const cov = last[0] / pay;
  const fee = l.rent * l.feeRate;
  const res = pay * 3;
  const rows = l.months
    .map((m, i) => {
      const f = m[0] * l.feeRate;
      return {
        mon: addMonth(l.firstPay, i).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        got: m[0],
        up: m[1],
        inv: pay,
        fee: f,
        you: m[0] - pay - f,
        c: m[0] / pay,
      };
    })
    .reverse();
  const yours = rows.reduce((s, r) => s + r.you, 0);

  return (
    <>
      <div className="dsum" style={{ marginTop: 32 }}>
        <div className="kstats">
          <div>
            <span>Next payment</span>
            <b className="num">{usd(Math.round(pay))}</b>
            <em>
              {fmtD(iso(addMonth(l.firstPay, k)))} · payment {k + 1} of {l.term}
            </em>
          </div>
          <div>
            <span>Coverage last month</span>
            <b className="num">{cov.toFixed(2)}×</b>
            <em>Cure period starts below 1.15×</em>
          </div>
          <div>
            <span>Reserve</span>
            <b className="num">{usdM(res)}</b>
            <em>3 months of payments</em>
          </div>
          <div>
            <span>Outstanding</span>
            <b className="num">{usdM(balanceAfter(l, k))}</b>
            <em>Ends {fmtD(iso(addMonth(l.firstPay, l.term - 1)))}</em>
          </div>
        </div>
      </div>
      <div className="dbody">
        <div>
          <section className="block">
            <div className="sec-t">
              <h2>Where this month’s rent goes</h2>
              <p>Paid by your buyer into the collection contract</p>
            </div>
            <div className="panel">
              <div className="wf">
                <div className="wf-row">
                  <span className="n">
                    <i className="ph ph-arrow-down"></i>
                  </span>
                  <span>Rent from buyer</span>
                  <em>{usd(l.rent)}</em>
                </div>
                <div className="wf-row first">
                  <span className="n">1</span>
                  <span>Lenders: principal and interest</span>
                  <em>−{usd(Math.round(pay))}</em>
                </div>
                <div className="wf-row">
                  <span className="n">2</span>
                  <span>Service fee</span>
                  <em>−{usd(Math.round(fee))}</em>
                </div>
                <div className="wf-row you">
                  <span className="n">3</span>
                  <span>To your account</span>
                  <em>{usd(Math.round(l.rent - pay - fee))}</em>
                </div>
              </div>
            </div>
          </section>
          <section className="block">
            <div className="sec-t">
              <h2>Monthly statement</h2>
              <p>{usd(Math.round(yours))} paid to you so far</p>
            </div>
            <div className="panel tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Rent received</th>
                    <th>Uptime</th>
                    <th>To lenders</th>
                    <th>Fee</th>
                    <th>To you</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.mon}>
                      <td>{r.mon}</td>
                      <td>{usd(r.got)}</td>
                      <td>{r.up.toFixed(1)}%</td>
                      <td>{usd(Math.round(r.inv))}</td>
                      <td>{usd(Math.round(r.fee))}</td>
                      <td>{usd(Math.round(r.you))}</td>
                      <td className={r.c < 1.25 ? 'neg' : ''}>{r.c.toFixed(2)}×</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <div className="aside">
          <div className="panel card">
            <h3>
              Covenant <span className="pill repaying">In compliance</span>
            </h3>
            <dl className="kv" style={{ marginTop: 0 }}>
              <div>
                <dt>Rule</dt>
                <dd>Rent ÷ payment ≥ 1.15×</dd>
              </div>
              <div>
                <dt>Lowest month</dt>
                <dd className="num">{Math.min(...rows.map((r) => r.c)).toFixed(2)}×</dd>
              </div>
              <div>
                <dt>Months in compliance</dt>
                <dd className="num">
                  {k} of {k}
                </dd>
              </div>
            </dl>
            <p className="small">
              If coverage falls below 1.15×, a 30-day cure period starts: top up the reserve or prepay part of the loan. If
              the cure fails, the lien is enforced.
            </p>
          </div>
          <div className="panel card">
            <h3>Options</h3>
            <div className="tacts" style={{ marginTop: 0 }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => toast('Prepayment quote requested (demo)')}>
                Request prepayment quote
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => toast('Statement downloaded (demo)')}>
                Download statement
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* Terms */

function Terms({ l }: { l: VerifyingLoan | RepayingLoan }) {
  const pay = payment(l);
  return (
    <section className="block" style={{ marginTop: 36 }}>
      <div className="panel">
        <dl className="facts">
          <div>
            <dt>Loan amount</dt>
            <dd className="num">{usd(l.amount)}</dd>
          </div>
          <div>
            <dt>Appraised value</dt>
            <dd className="num">
              {usd(l.appraisal)} · {pct(l.amount / l.appraisal)} (limit 80%)
            </dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd className="num">{pct(l.rate)} fixed</dd>
          </div>
          <div>
            <dt>Term</dt>
            <dd>
              {l.term} monthly payments of {usd(Math.round(pay))}
            </dd>
          </div>
          <div>
            <dt>Reserve</dt>
            <dd className="num">{usd(Math.round(pay * 3))} (3 months), held in the collection contract</dd>
          </div>
          <div>
            <dt>Payment order</dt>
            <dd>Lenders → service fee → you</dd>
          </div>
          <div>
            <dt>Covenant</dt>
            <dd>Coverage ≥ 1.15×; 30-day cure period</dd>
          </div>
          <div>
            <dt>Security</dt>
            <dd>Equipment pledged to {l.spv}; lien filed</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

/* Application in review */

function Review({ l }: { l: ReviewLoan }) {
  const done = l.review.filter((r) => r.s === 'done').length;
  return (
    <>
      <LoanHead l={l} />
      <div className="dbody" style={{ marginTop: 32 }}>
        <div className="panel">
          <div className="cond-sum">
            <b className="num">
              {done}
              <small>of {l.review.length} done</small>
            </b>
            <div className="segs6" style={{ gridTemplateColumns: `repeat(${l.review.length},1fr)` }}>
              {l.review.map((r, i) => (
                <i key={i} className={r.s === 'done' ? 'met' : r.s === 'progress' ? 'pending' : ''}></i>
              ))}
            </div>
            <p>Submitted {fmtD(l.submitted)}. We send a term sheet after the appraisal.</p>
          </div>
          {l.review.map((r, i) => (
            <div className={`task ${r.s === 'done' ? 'done' : r.s === 'progress' ? 'action' : 'todo'}`} key={r.t}>
              <span className="cidx">{r.s === 'done' ? <i className="ph ph-check"></i> : i + 1}</span>
              <div className="tmain">
                <div className="ttop">
                  <b>{r.t}</b>
                  {r.s === 'progress' ? (
                    <span className="pill verifying">In progress</span>
                  ) : r.s === 'done' ? (
                    <span className="muted" style={{ fontSize: '12.5px' }}>
                      {fmtD(r.date!)}
                    </span>
                  ) : null}
                </div>
                {r.note ? <p className="td">{r.note}</p> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="aside">
          <div className="panel card">
            <h3>Request</h3>
            <dl className="kv" style={{ marginTop: 0 }}>
              <div>
                <dt>Amount</dt>
                <dd className="num">{usd(l.amount)}</dd>
              </div>
              <div>
                <dt>Offtake</dt>
                <dd>
                  {l.offtake} months · {usd(l.rent)} / month
                </dd>
              </div>
              <div>
                <dt>Appraisal</dt>
                <dd>Pending</dd>
              </div>
            </dl>
            <p className="small">The loan can be at most 80% of the appraised value, so the final amount may change.</p>
          </div>
        </div>
      </div>
    </>
  );
}
