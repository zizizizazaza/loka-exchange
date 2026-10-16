import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import '../styles/v6.css';

import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';
import { num } from '../lib/format';

// Frame for the v6 preview pages (#/v6/...): Loka Capital header with the PRD v0.3 navigation, page body, footer.
// Rendered inside the shared Layout (so the access dialog, toast and "view as" switcher keep working) and hides the
// shared header and footer while open. Styles scoped under .mk6 (src/styles/v6.css).

const V6_NAV: [string, string][] = [
  ['/v6/facilities', 'Facilities'],
  ['/v6/portfolio', 'Portfolio'],
  ['/v6/fund-account', 'Fund account'],
  ['/v6/borrow', 'Borrow'],
];

export function V6Shell() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.classList.add('mk6-page');
    return () => document.body.classList.remove('mk6-page');
  }, []);

  return (
    <div className="mk6">
      <div className="mk6-preview">
        <div className="mk6-w">
          <span>Preview · v6 · institutional style</span>
          <Link to="/markets">Current app</Link>
        </div>
      </div>

      <header className="mk6-top">
        <div className="mk6-w">
          <a className="mk6-brand" href="../index.html" title="Back to site">
            <span className="brand-mark" aria-hidden="true"></span>Loka Capital
          </a>
          <nav aria-label="Main">
            {V6_NAV.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  isActive || (to === '/v6/facilities' && pathname.startsWith('/v6/facility/')) ? 'active' : ''
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mk6-right">
            <Account />
          </div>
        </div>
      </header>

      <Outlet />

      <footer className="mk6-foot">
        <div className="mk6-w">
          <p>
            Offered to verified institutional lenders only. Facilities are illiquid, held to maturity, and can lose value;
            interest is not guaranteed. Loka Capital does not lend, pool or hold lender funds. Design prototype with
            sample data and placeholder counterparties.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Account() {
  const { access, loading, signIn, signOut, sessionError, bal } = useDemo();
  const onGate = useGateClick();
  if (loading) return null;
  if (access === 'public' && !sessionError)
    return (
      <>
        <button className="mk6-hlink" type="button" onClick={signIn}>
          Sign in
        </button>
        <button className="mk6-btn" type="button" onClick={onGate}>
          Request access
        </button>
      </>
    );
  return (
    <>
      {access === 'verified' ? (
        <>
          <span className="mk6-bal">
            {num(bal)} <small>AIUSD</small>
          </span>
          <Link className="mk6-btn" to="/v6/fund-account">
            Fund account
          </Link>
        </>
      ) : null}
      {access === 'unverified' ? (
        <button className="mk6-btn" type="button" onClick={onGate}>
          Verify your business
        </button>
      ) : null}
      {access === 'pending' ? <span className="mk6-pend">Verification in review</span> : null}
      <button className="mk6-hlink" type="button" onClick={signOut}>
        Sign out
      </button>
    </>
  );
}

/** GPU model tile, used as the facility's mark. */
export function Chip({ model, size = 'md' }: { model: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`mk6-chip ${model[0] === 'B' ? 'b' : ''} ${size}`} aria-hidden="true">
      {model}
    </span>
  );
}

/** Interest rate, or a "Verified lenders" pill that opens the access dialog. */
export function Rate({ r, d = 2, suffix = '' }: { r: number; d?: number; suffix?: string }) {
  const { ok } = useDemo();
  const onGate = useGateClick();
  if (ok) return <>{(r * 100).toFixed(d) + '%' + suffix}</>;
  return (
    <button
      type="button"
      className="mk6-pill"
      onClick={(e) => {
        e.stopPropagation();
        onGate(e);
      }}
    >
      <i className="ph ph-lock-simple"></i>Verified lenders
    </button>
  );
}

/** Page title block used by every v6 page. */
export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mk6-ph">
      <div>
        <h1>{title}</h1>
        {sub ? <p>{sub}</p> : null}
      </div>
      {children ? <div className="mk6-ph-act">{children}</div> : null}
    </div>
  );
}

/** Shown on lender-only pages until the account is verified. */
export function LenderGate({ what }: { what: string }) {
  const { access } = useDemo();
  const onGate = useGateClick();
  return (
    <div className="mk6-gate">
      <i className="ph ph-lock-simple"></i>
      <h2>{what} is available to verified lenders</h2>
      <p>
        {access === 'pending'
          ? 'Your business verification is in review. This page opens as soon as it is approved.'
          : 'Loka Capital is open to institutions that pass business verification (KYB). It usually takes two to three business days.'}
      </p>
      {access === 'pending' ? null : (
        <button type="button" className="mk6-btn" onClick={onGate}>
          {access === 'public' ? 'Request access' : 'Verify your business'}
        </button>
      )}
    </div>
  );
}
