import { Link } from 'react-router';

import { fmtD, pct, usd, usdM } from '../../lib/format';
import { addMonth, balanceAfter, daysTo, type IssuerLoan, iso, LOANS, need, payment, type RepayingLoan } from '../data';
import { Pill } from './parts';

/** "Loans": the prototype's renderLoans(). */
export function Loans() {
  const out = LOANS.reduce((s, l) => (l.status === 'repaying' ? s + balanceAfter(l, l.months.length) : s), 0);
  const esc = LOANS.reduce((s, l) => (l.status === 'verifying' ? s + l.subscribed : s), 0);
  const n = LOANS.reduce((s, l) => s + need(l), 0);
  const repaying = LOANS[1] as RepayingLoan;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Loans</h1>
          <p>
            Financing against GPUs you already rent out. Each loan has its own escrow and collection contract; rent repays
            lenders first and the rest comes to you.
          </p>
        </div>
        <Link className="btn btn-primary btn-sm" to="/apply">
          New application
        </Link>
      </div>
      <div className="dsum" style={{ marginTop: 0 }}>
        <div className="kstats">
          <div>
            <span>Outstanding</span>
            <b className="num">{usdM(out)}</b>
            <em>Across performing loans</em>
          </div>
          <div>
            <span>Waiting in escrow</span>
            <b className="num">{usdM(esc)}</b>
            <em>Drawn when conditions are met</em>
          </div>
          <div>
            <span>Tasks that need you</span>
            <b className={`num ${n ? 'amb' : ''}`}>{n}</b>
            <em>{n ? 'Before drawdown' : 'Nothing pending'}</em>
          </div>
          <div>
            <span>Next payment</span>
            <b className="num">{usd(Math.round(payment(repaying)))}</b>
            <em>{fmtD(iso(addMonth(repaying.firstPay, repaying.months.length)))} · from rent</em>
          </div>
        </div>
      </div>
      <div className="panel plist" style={{ marginTop: 24 }}>
        <div className="phead bl">
          <span className="label">Loan</span>
          <span className="label">Amount</span>
          <span className="label">Next</span>
          <span className="label">Status</span>
          <span></span>
        </div>
        {LOANS.map((l) => (
          <Link className="prow bl" to={`/loan/${l.id}`} key={l.id}>
            <span className="pname">
              <b>{l.name}</b>
              <span>
                {l.qty} × {l.gpu} · {l.site}
              </span>
            </span>
            <span className="pv num">
              {usdM(l.amount)}
              <small>{l.status === 'review' ? 'Requested' : pct(l.rate) + ' · ' + l.term + ' months'}</small>
            </span>
            <span className="nx">
              <NextAction l={l} />
            </span>
            <span>
              <Pill l={l} />
            </span>
            <i className="ph-light ph-caret-right chev"></i>
          </Link>
        ))}
      </div>
    </>
  );
}

function NextAction({ l }: { l: IssuerLoan }) {
  if (l.status === 'verifying') {
    const n = need(l);
    return n ? (
      <>
        <b className="amb">
          {n} task{n > 1 ? 's' : ''} need you
        </b>
        <small>Drawdown when all 6 are recorded · {daysTo(l.refundBy)} days left</small>
      </>
    ) : (
      <b>Waiting on others</b>
    );
  }
  if (l.status === 'repaying') {
    const k = l.months.length;
    return (
      <>
        <b>Next payment {usd(Math.round(payment(l)))}</b>
        <small>{fmtD(iso(addMonth(l.firstPay, k)))} · paid from rent automatically</small>
      </>
    );
  }
  const done = l.review.filter((r) => r.s === 'done').length;
  return (
    <>
      <b>
        Review {done} of {l.review.length}
      </b>
      <small>{l.review.find((r) => r.s !== 'done')!.t}</small>
    </>
  );
}
