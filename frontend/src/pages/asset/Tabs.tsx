import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

/**
 * Detail page tabs. Like the prototype, switching tabs replaces the URL without scrolling,
 * and the new tab body fades in; the first one shown does not.
 */
export function Tabs({
  base,
  label,
  tabs,
  active,
  children,
}: {
  base: string;
  label: string;
  tabs: [string, string, string?][];
  active: string;
  children: ReactNode;
}) {
  const [first] = useState(active);
  return (
    <div className="ad-body">
      <div className="ad-main">
        <nav className="tabs" aria-label={label}>
          {tabs.map(([t, n, c]) => (
            <Link
              key={t}
              to={`${base}/${t}`}
              replace
              preventScrollReset
              aria-current={t === active ? 'page' : undefined}
            >
              {n}
              {c ? <span className="count">{c}</span> : null}
            </Link>
          ))}
        </nav>
        <div className={active === first ? 'ad-tabbody' : 'ad-tabbody tfade'} key={active}>
          {children}
        </div>
      </div>
    </div>
  );
}
