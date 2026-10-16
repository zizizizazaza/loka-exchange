import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';

import { CO } from './data';
import { ToastCtx } from './toast';

/** Page frame of the issuer console: sidebar, mobile bar, main, footer and toast, as in the prototype's body. */
export function Layout() {
  const { pathname } = useLocation();
  const page = pathname.split('/')[1] || 'loans';
  const nav = page === 'loan' ? 'loans' : page;
  const [toastText, setToastText] = useState('');
  const [toastShown, setToastShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((t: string) => {
    setToastText(t);
    setToastShown(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToastShown(false), 2600);
  }, []);

  // Every route change scrolls to the top and closes the mobile menu, as in the prototype.
  useEffect(() => {
    scrollTo({ top: 0 });
    document.body.classList.remove('side-open');
  }, [pathname]);

  const item = (key: string, href: string, icon: string, label: string) => (
    <li>
      <Link className="item" to={href} aria-current={nav === key ? 'page' : undefined}>
        <i className={`ph-light ${icon}`}></i>
        {label}
      </Link>
    </li>
  );

  return (
    <ToastCtx.Provider value={toast}>
      <aside className="side" id="side" aria-label="App navigation">
        <a className="brand" href="../../index.html" title="Back to site">
          <span className="brand-mark" aria-hidden="true"></span>Loka Capital
        </a>
        <nav aria-label="Main">
          <h2 className="nav-h">Borrow</h2>
          <ul className="nav">
            {item('loans', '/loans', 'ph-stack', 'Loans')}
            {item('apply', '/apply', 'ph-plus-circle', 'New application')}
          </ul>
          <h2 className="nav-h">Account</h2>
          <ul className="nav">{item('company', '/company', 'ph-buildings', 'Company')}</ul>
        </nav>
        <div className="acct">
          <div className="acct-card">
            <div className="addr">
              <i className="ph-light ph-buildings"></i>
              <span id="coName">{CO.short}</span>
            </div>
            <span className="ver">Verified borrower</span>
          </div>
          <div className="acct-links">
            <a href="#" onClick={(e) => e.preventDefault()}>
              Docs
            </a>
            <a href="../../index.html">Site</a>
            <a href="#" onClick={(e) => e.preventDefault()}>
              Support
            </a>
          </div>
        </div>
      </aside>
      <div className="side-scrim" id="sideScrim" onClick={() => document.body.classList.remove('side-open')}></div>

      <div className="shell">
        <div className="mbar">
          <button
            type="button"
            id="sideToggle"
            aria-label="Open navigation"
            aria-controls="side"
            onClick={() => document.body.classList.add('side-open')}
          >
            <i className="ph-light ph-list"></i>
          </button>
          <Link className="brand" to="/loans">
            <span className="brand-mark" aria-hidden="true"></span>Loka Capital
          </Link>
        </div>
        <main id="app" className="wrap fade" tabIndex={-1} key={pathname}>
          <Outlet />
        </main>
        <footer className="foot">
          <p>Design prototype with sample data. Lending terms are set per loan and recorded in its contracts.</p>
        </footer>
      </div>
      <div className={toastShown ? 'toast show' : 'toast'} role="status">
        {toastText}
      </div>
    </ToastCtx.Provider>
  );
}
