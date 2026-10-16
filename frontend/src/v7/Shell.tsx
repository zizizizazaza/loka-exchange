import { useEffect, type ReactNode } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

import '../styles/v7.css';

import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';

// Frame for the v7 pages (#/v7/...): the Markets v7 look applied to the whole lender app, PRD v0.3 wording.
// Rendered inside the shared Layout (so the access dialog, toast and "view as" switcher keep working); hides the shared
// header and footer while open (body.mk7-page) and draws its own with the shared header's layout.
// Styles scoped under .mk7 (src/styles/v7.css).

/** Sample lender shown in the header; a live session would show the verified company's legal name. */
export const ORG = 'Northwind Capital Ltd';
export const AS_OF = '2026-10-16';

const NAV: [string, string][] = [
  ['/v7/facilities', 'Loans'],
  ['/v7/portfolio', 'Portfolio'],
  ['/v7/fund-account', 'Fund account'],
  ['/v7/borrow', 'Borrow'],
];

export function V7Shell() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.body.classList.add('mk7-page');
    return () => document.body.classList.remove('mk7-page');
  }, []);
  useReveal(pathname);

  return (
    <div className="mk7">
      <header className="xtop mk7-top">
        <a className="brand" href="../index.html" title="Back to site">
          <span className="brand-mark" aria-hidden="true"></span>Loka Capital
        </a>
        <nav className="xnav" aria-label="Main">
          {NAV.map(([to, label]) => (
            // A facility page keeps Facilities marked as the current section.
            <Link
              key={to}
              to={to}
              aria-current={
                pathname.startsWith(to) || (to === '/v7/facilities' && pathname.startsWith('/v7/facility/'))
                  ? 'page'
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="xright">
          <Account />
        </div>
      </header>

      <Outlet />

      <footer className="mk7-foot">
        <div className="mk7-w">
          <div className="mk7-foot-top">
            <a className="brand" href="../index.html" title="Back to site">
              <span className="brand-mark" aria-hidden="true"></span>Loka Capital
            </a>
            <nav aria-label="Footer">
              {NAV.map(([to, label]) => (
                <Link key={to} to={to}>
                  {label}
                </Link>
              ))}
              <a href="../index.html">Main site</a>
            </nav>
          </div>
          <p className="mk7-foot-legal">
            Offered to verified institutional lenders only. Loans are illiquid, held to maturity and can lose
            value; interest is not guaranteed. Loka Capital does not lend, pool or hold lender funds.
          </p>
          <p className="mk7-foot-note">Design prototype · sample data</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Sections below the fold fade up once as they scroll into view (styles: .mk7-rv in v7.css). Only sections that start
 * off-screen are hidden, so nothing visible on load flickers, and nothing is hidden without JavaScript.
 */
function useReveal(pathname: string) {
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const els = [...document.querySelectorAll<HTMLElement>('.mk7 .mk7-blk, .mk7 .mk7-sec, .mk7 .mk7-foot')].filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight,
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const el of els) {
      el.classList.add('mk7-rv');
      io.observe(el);
    }
    return () => {
      io.disconnect();
      for (const el of els) el.classList.remove('mk7-rv', 'in');
    };
  }, [pathname]);
}

/** Right side of the header: the institution instead of a wallet and balance. */
function Account() {
  const { access, loading, signedIn, signIn, signOut, sessionError } = useDemo();
  const onGate = useGateClick();
  if (loading) return null;

  const out = signedIn ? (
    <button className="mk7-hlink" type="button" onClick={signOut}>
      Sign out
    </button>
  ) : null;

  if (sessionError) return out;
  switch (access) {
    case 'public':
      return (
        <>
          <button className="mk7-hlink" type="button" onClick={signIn}>
            Sign in
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
            Request access
          </button>
        </>
      );
    case 'unverified':
      return (
        <>
          <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
            Verify your business
          </button>
          {out}
        </>
      );
    case 'pending':
      return (
        <>
          <span className="mk7-pend">Verification in review</span>
          {out}
        </>
      );
    case 'verified':
      return (
        <>
          <span className="mk7-org">
            <i className="ph-fill ph-seal-check" aria-hidden="true"></i>
            {ORG}
          </span>
          {out}
        </>
      );
  }
}

export type Tone = 'open' | 'wait' | 'ok' | 'build';

/** Status: a dot and a word; colour only here. */
export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`mk7-st ${tone}`}>{children}</span>;
}

/** A figure hidden until verified; opens the access dialog. `compact` shows the lock alone, for narrow cells. */
export function Locked({ compact = false }: { compact?: boolean }) {
  const onGate = useGateClick();
  return (
    <button
      type="button"
      className="mk7-lock"
      title="Shown to verified lenders"
      aria-label={compact ? 'Shown to verified lenders' : undefined}
      onClick={onGate}
    >
      <i className="ph ph-lock-simple" aria-hidden="true"></i>
      {compact ? null : 'Verified lenders'}
    </button>
  );
}

/** An ⓘ with a short explanation, shown on hover or keyboard focus; the text is also the button's accessible name. */
export function Info({ children }: { children: string }) {
  return (
    <span className="mk7-info">
      <button type="button" aria-label={children}>
        <i className="ph ph-info" aria-hidden="true"></i>
      </button>
      <span className="mk7-info-tip" role="tooltip">
        {children}
      </span>
    </span>
  );
}

/** Interest rate, or a lock until verified. */
export function Rate({ r, d = 2, suffix = '', compact = false }: { r: number; d?: number; suffix?: string; compact?: boolean }) {
  const { ok } = useDemo();
  return ok ? <>{(r * 100).toFixed(d) + '%' + suffix}</> : <Locked compact={compact} />;
}

/**
 * Hero band for the inner pages: the Facilities hero without the 3D board. Title, actions, and the page's key figures
 * (`children`, as <div><dt/><dd/><small/></div> items) in a row of `cols` columns. `compact` is the shorter version
 * for working pages (Portfolio, Fund account), so their tables and forms start higher.
 */
export function PageHero({
  eyebrow,
  title,
  sub,
  actions,
  cols = 4,
  compact = false,
  big = false,
  children,
}: {
  eyebrow?: string;
  title: string;
  sub?: ReactNode;
  actions?: ReactNode;
  cols?: 3 | 4 | 5;
  compact?: boolean;
  /** Larger title, and the key figures on a gradient strip: the Loans page. */
  big?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className={`mk7-hero mk7-phero${compact ? ' compact' : ''}${big ? ' big' : ''}`}>
      <div className="mk7-w">
        <div className="mk7-phero-top">
          <div>
            {eyebrow ? <p className="mk7-eye">{eyebrow}</p> : null}
            <h1>{title}</h1>
            {sub ? <p className="mk7-lead">{sub}</p> : null}
          </div>
          {actions ? <div className="mk7-ph-act">{actions}</div> : null}
        </div>
        {children ? (
          big ? (
            <div className="mk7-banner">
              <dl className={`mk7-stats c${cols}`}>{children}</dl>
            </div>
          ) : (
            <dl className={`mk7-stats c${cols}`}>{children}</dl>
          )
        ) : (
          <div className="mk7-phero-end"></div>
        )}
      </div>
    </section>
  );
}

/** Section with a serif title and an optional note or figure on the right. */
export function Section({
  id,
  split = false,
  title,
  meta,
  note,
  children,
}: {
  id?: string;
  /** Title and note in a left column, content on the right: for reference sections read after the terms. */
  split?: boolean;
  title: string;
  meta?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`mk7-blk${split ? ' split' : ''}`} id={id}>
      <div className="mk7-blk-l">
        <header className="mk7-sh">
          <h2>{title}</h2>
          {meta ? <p className="mk7-eye">{meta}</p> : null}
        </header>
        {note ? <p className="mk7-note">{note}</p> : null}
      </div>
      <div className="mk7-blk-r">{children}</div>
    </section>
  );
}

export function KV({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

/** Shown on lender-only pages until the account is verified. */
export function LenderGate({ what }: { what: string }) {
  const { access } = useDemo();
  const onGate = useGateClick();
  return (
    <div className="mk7-gate">
      <i className="ph-light ph-lock-simple" aria-hidden="true"></i>
      <h2>{what} is available to verified lenders</h2>
      <p>
        {access === 'pending'
          ? 'Your business verification is in review. This page opens as soon as it is approved.'
          : 'Loka Capital is open to institutions that pass business verification (KYB). It usually takes two to five business days.'}
      </p>
      {access === 'pending' ? null : (
        <button type="button" className="btn btn-primary btn-sm" onClick={onGate}>
          {access === 'public' ? 'Request access' : 'Verify your business'}
        </button>
      )}
    </div>
  );
}
