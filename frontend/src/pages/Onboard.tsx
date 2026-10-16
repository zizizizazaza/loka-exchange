import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';

/** What Portfolio and Deposit show before verification: the prototype's renderOnboard(). */
export function Onboard({ page }: { page: 'portfolio' | 'deposit' }) {
  const { access, signIn } = useDemo();
  const onGate = useGateClick();
  const st = access;
  const steps: [string, string, string][] = [
    ['Sign in', 'Email or wallet', st === 'public' ? 'now' : 'done'],
    ['Verify your business', 'Company, owners, authorized signers, withdrawal address', st === 'public' ? 'todo' : st === 'unverified' ? 'now' : 'done'],
    ['Review', 'By the platform and a licensed KYB provider · usually 2 to 5 business days (sample)', st === 'pending' ? 'now' : 'todo'],
    ['Fund your account', 'Deposit USDC and receive AIUSD 1:1', 'todo'],
    ['Subscribe', 'New issues, from $100,000 per subscription (sample)', 'todo'],
  ];
  const act =
    st === 'public' ? (
      <button className="btn btn-primary btn-sm" type="button" onClick={signIn}>
        Sign in
      </button>
    ) : st === 'unverified' ? (
      <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
        Start
      </button>
    ) : (
      <span className="xpend">In review</span>
    );

  return (
    <div className="xwrap">
      <div className="page-head">
        <div>
          <h1>{page === 'deposit' ? 'Deposit' : 'Portfolio'}</h1>
          <p>
            {st === 'pending'
              ? 'Your verification is in review. Funding and subscriptions open once it is approved.'
              : 'Investing on Loka is open to verified institutions in this phase.'}
          </p>
        </div>
      </div>
      <div className="onb">
        <div className="panel onb-steps">
          <ol>
            {steps.map(([t, s, c], i) => (
              <li className={c} key={t}>
                <span className="onb-i">{c === 'done' ? <i className="ph ph-check"></i> : i + 1}</span>
                <span>
                  <b>{t}</b>
                  <small>{s}</small>
                </span>
                <span className="r">{c === 'now' ? act : null}</span>
              </li>
            ))}
          </ol>
        </div>
        <aside className="panel onb-side">
          <h3>Open to everyone</h3>
          <ul>
            <li>
              <i className="ph ph-check"></i>Loan size, coverage and loan-to-value
            </li>
            <li>
              <i className="ph ph-check"></i>Monthly repayments and uptime
            </li>
            <li>
              <i className="ph ph-check"></i>Release conditions and the on-chain record
            </li>
          </ul>
          <hr />
          <h3>After verification</h3>
          <ul>
            <li className="no">
              <i className="ph ph-lock-simple"></i>Yields and full terms
            </li>
            <li className="no">
              <i className="ph ph-lock-simple"></i>Term sheets, appraisals, offtake summaries
            </li>
            <li className="no">
              <i className="ph ph-lock-simple"></i>Deposits, subscriptions and withdrawals
            </li>
          </ul>
          <hr />
          <p>
            Investing as an individual? Not open in this phase.{' '}
            <button type="button" onClick={onGate}>
              Get notified
            </button>
          </p>
        </aside>
      </div>
    </div>
  );
}
