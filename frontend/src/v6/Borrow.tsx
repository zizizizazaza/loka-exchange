import { useDemo } from '../demo/state';
import { PageHead } from './Shell';

// Borrower overview per PRD v0.3 4.2 and 4.5: the two facility types, the process and what to prepare.
// Applying still goes to the existing borrower console (app/issuer).

const TYPES: { name: string; lead: string; rows: [string, string][] }[] = [
  {
    name: 'Operating facility',
    lead: 'For compute centers with GPUs installed and rented out.',
    rows: [
      ['Advance', 'Up to 80% of independent appraisal'],
      ['Security', 'First lien on GPUs, lease receivables, SPV equity, 3-month reserve'],
      ['Drawdown', 'In one draw, after six conditions are signed'],
      ['Repayment', 'Monthly from rent, up to 36 months'],
      ['Requirement', 'Lease with at least 24 months remaining'],
    ],
  },
  {
    name: 'Construction facility',
    lead: 'For compute centers being built: fit-out, equipment purchase, racking and power.',
    rows: [
      ['Advance', 'Up to 60% of total project cost'],
      ['Security', 'Equipment contracts (lien on delivery), compute contracts, SPV equity, sponsor guarantee'],
      ['Drawdown', 'Four milestones, each signed by an independent engineer'],
      ['Repayment', 'Interest-only during build, then monthly from rent'],
      ['Requirement', 'Sponsor equity of at least 40%, funded first; pre-signed compute contract'],
    ],
  },
];

const STEPS: [string, string, string][] = [
  ['Apply', 'Send the project details, contracts and financials.', 'A few days'],
  ['Review and appraisal', 'We review the borrower and the offtaker; an independent appraiser or engineer reports.', '2–3 weeks'],
  ['Open for commitments', 'Verified lenders commit. Funds wait in the facility escrow.', 'Up to 30 days'],
  ['Conditions signed', 'SPV, liens, rent routing, monitoring and appraisal, each signed on-chain.', 'In parallel'],
  ['Drawdown', 'Funds are paid to the SPV in one draw, or by milestone for construction.', 'Same day'],
  ['Monthly repayment', 'Rent goes to the collection contract: lenders first, then the service fee, then you.', 'Monthly'],
];

const PREP: [string, string[]][] = [
  [
    'Operating',
    [
      'Lease or compute contract, 24+ months remaining',
      'Equipment list with serial numbers and invoices',
      'Data center or colocation agreement',
      'Financial statements, last two years',
      "Offtaker's consent to pay into a controlled account",
    ],
  ],
  [
    'Construction',
    [
      'Site or land rights and power interconnection agreement',
      'Equipment purchase and construction contracts',
      'Pre-signed lease or compute contract',
      'Budget and schedule, reviewed by an independent engineer',
      'Evidence of sponsor equity',
    ],
  ],
];

export function V6Borrow() {
  const { access, signIn } = useDemo();
  const signed = access !== 'public';
  const apply = signed ? (
    <a className="mk6-btn" href="issuer/index.html#/apply">
      Start an application
    </a>
  ) : (
    <button className="mk6-btn" type="button" onClick={signIn}>
      Sign in to apply
    </button>
  );

  return (
    <main className="mk6-w mk6-main tight">
      <PageHead
        title="Borrow"
        sub="Secured, non-dilutive financing for compute centers, operating or under construction, against GPUs and contracted rent."
      >
        {signed ? (
          <a className="mk6-btn ghost" href="issuer/index.html#/loans">
            Borrower console
          </a>
        ) : null}
        {apply}
      </PageHead>

      <div className="mk6-types">
        {TYPES.map((t) => (
          <article key={t.name} className="mk6-box big">
            <h2>{t.name}</h2>
            <p className="mk6-lead">{t.lead}</p>
            <dl className="mk6-kv">
              {t.rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      <section className="mk6-sec">
        <header>
          <h2>How it works</h2>
          <p>Timings are samples. Each facility's legal documents set the final terms.</p>
        </header>
        <ol className="mk6-process">
          {STEPS.map(([t, d, w], i) => (
            <li key={t}>
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <b>{t}</b>
              <p>{d}</p>
              <small>{w}</small>
            </li>
          ))}
        </ol>
      </section>

      <section className="mk6-sec">
        <header>
          <h2>What to prepare</h2>
        </header>
        <div className="mk6-types">
          {PREP.map(([k, items]) => (
            <div key={k} className="mk6-box">
              <h3>{k} facility</h3>
              <ul className="mk6-checks">
                {items.map((x) => (
                  <li key={x}>
                    <i className="ph ph-check"></i>
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mk6-cta">
        <div>
          <h2>Talk to our origination team</h2>
          <p>Share the project in confidence. We reply within two business days.</p>
        </div>
        {apply}
      </section>
    </main>
  );
}
