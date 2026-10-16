import { Link } from 'react-router';

import { fmtD, short } from '../../lib/format';
import { CO, LOANS } from '../data';

/** "Company": the prototype's renderCompany(). */
export function Company() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Company</h1>
          <p>{CO.name}</p>
        </div>
      </div>
      <div className="vgrid" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
        <div className="panel card">
          <h3>
            Entity <span className="pill repaying">Verified</span>
          </h3>
          <dl className="kv" style={{ marginTop: 0 }}>
            <div>
              <dt>Legal name</dt>
              <dd>{CO.name}</dd>
            </div>
            <div>
              <dt>Registered</dt>
              <dd>{CO.reg}</dd>
            </div>
            <div>
              <dt>Verified on</dt>
              <dd>{fmtD(CO.since)}</dd>
            </div>
            <div>
              <dt>Signing wallet</dt>
              <dd className="mono">{short(CO.wallet)}</dd>
            </div>
          </dl>
        </div>
        <div className="panel card">
          <h3>Project SPVs</h3>
          <dl className="kv" style={{ marginTop: 0 }}>
            {LOANS.map((l) =>
              'spv' in l ? (
                <div key={l.id}>
                  <dt>{l.spv}</dt>
                  <dd>
                    <Link className="txlink" to={`/loan/${l.id}`}>
                      {l.name}
                    </Link>
                  </dd>
                </div>
              ) : null,
            )}
          </dl>
          <p className="small">Each loan pays out to its own SPV account. The account is fixed when the loan is listed.</p>
        </div>
      </div>
    </>
  );
}
