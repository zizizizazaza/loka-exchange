import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { type Access, useDemo } from '../demo/state';
import { GateDialog } from './GateDialog';
import { HeaderRight } from './HeaderRight';

const VIEWS: [Access, string][] = [
  ['public', 'Public'],
  ['unverified', 'Signed in'],
  ['pending', 'In review'],
  ['verified', 'Verified'],
];

/** Page frame, same as the prototype's body: header, main, footer, toast, dialogs and the "view as" switcher. */
export function Layout() {
  const { access, preview, setPreview, showSwitcher, toastText, toastShown, sessionError } = useDemo();
  const { pathname } = useLocation();
  // Page and item, without the detail tab: switching tabs keeps the scroll position, as in the prototype.
  const pageKey = pathname.split('/').slice(1, 3).join('/');

  useEffect(() => {
    scrollTo({ top: 0 });
  }, [pageKey]);

  return (
    <>
      <header className="xtop">
        <a className="brand" href="../index.html" title="Back to site">
          <span className="brand-mark" aria-hidden="true"></span>Loka
        </a>
        {/* Trade, Earn and Transparency are hidden in this phase, as in the prototype. */}
        <nav className="xnav" aria-label="Main">
          <NavLink to="/markets">Markets</NavLink>
          <NavLink to="/portfolio">Portfolio</NavLink>
          <NavLink to="/issue">Issue</NavLink>
        </nav>
        <div className="xright">
          <HeaderRight />
        </div>
      </header>

      <main id="app" tabIndex={-1} className="fade" key={pageKey + access}>
        <Outlet />
      </main>
      <footer className="foot xfoot">
        <p>
          Design prototype with sample data. Listed assets can lose value; market prices can be below NAV or par. Open
          to verified investors only.
        </p>
      </footer>
      {/* A refused session (e.g. the email belongs to another account) stays on screen until the user signs out. */}
      <div className={toastShown || sessionError ? 'toast show' : 'toast'} role="status">
        {sessionError ?? toastText}
      </div>
      <GateDialog />
      {/* Development only: preview other access tiers. "Live" follows the real Privy session. */}
      {showSwitcher ? (
        <div className="demo-sw" role="group" aria-label="Prototype: view as">
          <span>Prototype · view as</span>
          <button type="button" aria-pressed={preview === null} onClick={() => setPreview(null)}>
            Live
          </button>
          {VIEWS.map(([a, label]) => (
            <button key={a} type="button" aria-pressed={preview === a} onClick={() => setPreview(a)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
