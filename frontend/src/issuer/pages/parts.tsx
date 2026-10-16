import { Link } from 'react-router';

import { hx, short } from '../../lib/format';
import { type IssuerLoan, STATUS } from '../data';

// Pieces shared by the issuer pages, one per prototype helper (pill, tx, head).

export function Pill({ l }: { l: IssuerLoan }) {
  const [label, cls] = STATUS[l.status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

/** Sample transaction link. */
export function Tx({ seed }: { seed: string }) {
  const h = hx(seed);
  return (
    <a className="txlink" href="#" onClick={(e) => e.preventDefault()} title={h}>
      {short(h)}
      <i className="ph-light ph-arrow-up-right"></i>
    </a>
  );
}

/** Breadcrumb, title, facts and tabs at the top of a loan: the prototype's head(). */
export function LoanHead({ l, tabs, tab }: { l: IssuerLoan; tabs?: [string, string, string?][]; tab?: string }) {
  return (
    <>
      <div className="crumb">
        <Link to="/loans">Loans</Link>
        <i className="ph-light ph-caret-right"></i>
        <span>{l.name}</span>
      </div>
      <div className="dhead">
        <div>
          <div className="dtitle">
            <h1>{l.name}</h1>
            <Pill l={l} />
          </div>
          <div className="dmeta">
            <span>
              <i className="ph-light ph-cpu"></i>
              {l.qty} × {l.gpu}
            </span>
            <span>
              <i className="ph-light ph-map-pin"></i>
              {l.site}
            </span>
            <span>
              <i className="ph-light ph-handshake"></i>Offtake: {l.buyer}
            </span>
            {'spv' in l ? (
              <span>
                <i className="ph-light ph-buildings"></i>
                {l.spv}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {tabs ? (
        <nav className="tabs" aria-label="Loan sections">
          {tabs.map(([k, t, c]) => (
            <Link key={k} to={`/loan/${l.id}/${k}`} aria-current={k === tab ? 'page' : undefined}>
              {t}
              {c ? <span className="count">{c}</span> : null}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}
