import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';

import { useDemo } from '../../demo/state';
import { errorText, useKybActions } from '../../kyb/actions';
import { type KybStep, setKybMode, useKyb } from '../../kyb/store';
import { CompanyStep } from './CompanyStep';
import { OwnersStep } from './OwnersStep';
import { ReviewStep } from './ReviewStep';
import { Status } from './Status';
import { WalletsStep } from './WalletsStep';
import { YouStep } from './YouStep';

const STEPS: [KybStep, string, string][] = [
  ['company', 'Company', 'Details and registration'],
  ['you', 'You', 'Your details and ID'],
  ['owners', 'Owners', 'Directors and owners'],
  ['wallets', 'Addresses', 'Lending and withdrawal'],
  ['review', 'Review', 'Confirm and submit'],
  ['submitted', 'In review', '2 to 5 business days (sample)'],
];

/**
 * #/verify: business verification (KYB). Not in the prototype; built in its style.
 * Entry points: "Start verification" in the access dialog, and "View status" once submitted.
 * Signed in for real, every step is saved to the backend and the checks are real (backend/docs/kyb.md);
 * in the development preview they are simulated (src/kyb/store.ts).
 * `base` is the route prefix of the app it is shown in ('' for the current app, '/v7' for the v7 pages).
 */
export function Verify({ base = '' }: { base?: string }) {
  const { access, toast } = useDemo();
  const kyb = useKyb();
  const actions = useKybActions();
  const { live } = actions;
  // Load once per source (backend or demo), not on every new actions object.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  const [loaded, setLoaded] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    setKybMode(live ? 'live' : 'demo');
    latest.current
      .load()
      .catch((e) => toast(errorText(e)))
      .finally(() => !cancelled && setLoaded(live));
    return () => {
      cancelled = true;
    };
  }, [live, toast]);

  if (access === 'public') return <Navigate to={`${base}/portfolio`} replace />;

  const at = STEPS.findIndex((s) => s[0] === kyb.step);
  return (
    <div className="xwrap kybf">
      <div className="crumb">
        <Link to={`${base}/portfolio`}>Portfolio</Link>
        <i className="ph-light ph-caret-right"></i>
        <span>Verify your business</span>
      </div>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Verify your business</h1>
          <p>
            We check the business, its owners and who can sign for it, through a licensed verification provider. One person,
            about 15 minutes.
          </p>
        </div>
      </div>
      <section className="ad-prog">
        <ol className="ip-steps">
          {STEPS.map(([k, t, d], i) => (
            <li key={k} className={i < at || (kyb.step === 'submitted' && i < STEPS.length - 1) ? 'done' : i === at ? 'now' : 'todo'}>
              <i></i>
              <b>{t}</b>
              <small>{d}</small>
            </li>
          ))}
        </ol>
      </section>
      {loaded !== live ? (
        <p className="muted" style={{ marginTop: 28, fontSize: 13.5 }}>
          Loading your application…
        </p>
      ) : (
        <>
          {kyb.step === 'company' && <CompanyStep />}
          {kyb.step === 'you' && <YouStep />}
          {kyb.step === 'owners' && <OwnersStep />}
          {kyb.step === 'wallets' && <WalletsStep />}
          {kyb.step === 'review' && <ReviewStep />}
          {kyb.step === 'submitted' && <Status />}
        </>
      )}
    </div>
  );
}
