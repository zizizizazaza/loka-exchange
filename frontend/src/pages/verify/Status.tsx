import { useDemo } from '../../demo/state';
import { errorText, useKybActions } from '../../kyb/actions';
import { isApplicant, useKyb } from '../../kyb/store';
import { fmtD, short } from '../../lib/format';

/** After submitting: where the application is, in the onboarding page's step style. */
export function Status() {
  const kyb = useKyb();
  const { toast } = useDemo();
  const actions = useKybActions();
  const others = kyb.people.filter((p) => !isApplicant(p, kyb.applicant));
  const listed = others.length;

  const steps: [string, string, 'done' | 'now' | 'todo'][] = [
    ['Company checked', kyb.check?.found ? `Found in the registry · ${kyb.check.status}` : 'No online registry result · checked by hand in review', 'done'],
    ['Your ID verified', `${kyb.applicant.name}, ${kyb.applicant.title}`, 'done'],
    [
      'Directors and owners listed',
      !listed ? 'Only you are listed' : `${listed} ${listed === 1 ? 'name' : 'names'} · checked against sanctions lists in review`,
      'done',
    ],
    ['Platform review', 'Usually 2 to 5 business days (sample). If we need ID from someone else, we email you first.', 'now'],
    ['Lending address whitelisted', 'Recorded on-chain when you are approved', 'todo'],
    ['Fund your account', 'Wire USD or send USDC; credited as AIUSD 1:1', 'todo'],
  ];

  return (
    <div className="onb" style={{ marginTop: 28 }}>
      <div className="panel onb-steps">
        <ol>
          {steps.map(([t, s, c], i) => (
            <li className={c} key={t}>
              <span className="onb-i">{c === 'done' ? <i className="ph ph-check"></i> : i + 1}</span>
              <span>
                <b>{t}</b>
                <small>{s}</small>
              </span>
              <span className="r">{c === 'now' ? <span className="xpend">In review</span> : null}</span>
            </li>
          ))}
        </ol>
      </div>
      <aside className="panel onb-side">
        <h3>Submitted {kyb.submittedAt ? fmtD(kyb.submittedAt) : ''}</h3>
        <dl className="kv" style={{ marginTop: 0 }}>
          <div>
            <dt>Company</dt>
            <dd>{kyb.company.legalName}</dd>
          </div>
          <div>
            <dt>Lending address</dt>
            <dd className="mono">{kyb.wallets.map(short).join(', ')}</dd>
          </div>
          <div>
            <dt>Withdrawal address</dt>
            <dd className="mono">{short(kyb.treasury)}</dd>
          </div>
        </dl>
        <hr />
        {!actions.live ? (
          <p>
            This is a sample flow; nothing was sent.{' '}
            <button type="button" onClick={() => void actions.reset()}>
              Start over (demo)
            </button>
          </p>
        ) : import.meta.env.DEV ? (
          <p>
            Development build.{' '}
            <button type="button" onClick={() => actions.reset().catch((e) => toast(errorText(e)))}>
              Start over
            </button>{' '}
            deletes this application; checks run again cost provider credits.
          </p>
        ) : (
          <p>We will email you when it is approved, or if we need anything else.</p>
        )}
      </aside>
    </div>
  );
}
