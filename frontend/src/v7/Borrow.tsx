import { useDemo } from '../demo/state';
import { PageHero, Section } from './Shell';

// Borrow (#/v7/borrow), PRD v0.3 3.4 with 4.2 and 4.5: the two facility types, the process and what to prepare.
// Applying goes to the borrower console (app/issuer). Content follows src/v6/Borrow.tsx.

const TYPES: { name: string; lead: string; rows: [string, string][] }[] = [
  {
    name: 'Operating loan',
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
    name: 'Construction loan',
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

// Rules v0.2, section 1: the application is an expression of interest; review, appraisal and signing happen offline
// with our team; the signed terms are then entered, recorded on-chain and listed.
const STEPS: [string, string, string][] = [
  ['Submit interest', 'Company, site, equipment, offtaker, amount and term. Our team follows up directly.', 'A few minutes'],
  ['Review and signing', 'Diligence, appraisal and terms are agreed with our team and signed offline.', 'Agreed with you'],
  ['Listing', 'The signed terms are entered, documents recorded on-chain and the escrow deployed.', '3–5 business days'],
  ['Open for commitments', 'Verified lenders commit. Funds wait in the loan’s escrow.', '30 days, up to 45'],
  [
    'Conditions and drawdown',
    'SPV, liens, rent routing, monitoring and appraisal are signed on-chain; funds then go to the SPV, in one draw or by milestone.',
    'Within 6 weeks',
  ],
  ['Monthly repayment', 'Rent goes to the collection contract: lenders first, then the reserve, the service fee, then you.', '15th of each month'],
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

export function V7Borrow() {
  const { access, signIn } = useDemo();
  const signed = access !== 'public';
  const apply = (cls: string) =>
    signed ? (
      <a className={cls} href="issuer/index.html#/apply">
        Submit interest
      </a>
    ) : (
      <button className={cls} type="button" onClick={signIn}>
        Sign in to submit interest
      </button>
    );

  return (
    <>
      <PageHero
        eyebrow="For compute centers"
        title="Borrow"
        sub="Secured, non-dilutive financing for compute centers, operating or under construction, against GPUs and contracted rent."
        actions={
          <>
            {signed ? (
              <a className="btn btn-ghost btn-sm" href="issuer/index.html#/loans">
                Borrower console
              </a>
            ) : null}
            {apply('btn btn-primary btn-sm')}
          </>
        }
      >
        <div>
          <dt>Operating loan</dt>
          <dd className="brand">Up to 80%</dd>
          <small>Of independent equipment appraisal</small>
        </div>
        <div>
          <dt>Construction loan</dt>
          <dd>Up to 60%</dd>
          <small>Of total project cost</small>
        </div>
        <div>
          <dt>Maximum term</dt>
          <dd>36 months</dd>
          <small>Repaid monthly from rent</small>
        </div>
        <div>
          <dt>Listing after signing</dt>
          <dd>3–5 days</dd>
          <small>Business days, sample timing</small>
        </div>
      </PageHero>

      <main className="mk7-w mk7-after">

        <div className="mk7-types">
          {TYPES.map((t) => (
            <article key={t.name} className="mk7-box">
              <h2>{t.name}</h2>
              <p className="mk7-note">{t.lead}</p>
              <dl className="mk7-tkv">
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

        <Section title="How it works" meta="Sample timings">
          <ol className="mk7-process">
            {STEPS.map(([t, d, w], i) => (
              <li key={t}>
                <span className="mk7-eye">{String(i + 1).padStart(2, '0')}</span>
                <b>{t}</b>
                <p>{d}</p>
                <small>{w}</small>
              </li>
            ))}
          </ol>
          <p className="mk7-fine">Each loan's legal documents set the final terms.</p>
        </Section>

        <Section title="What to prepare">
          <div className="mk7-types">
            {PREP.map(([k, items]) => (
              <div key={k} className="mk7-box">
                <h3>{k} loan</h3>
                <ul className="mk7-checks">
                  {items.map((x) => (
                    <li key={x}>
                      <i className="ph ph-check" aria-hidden="true"></i>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <section className="mk7-cta">
          <div>
            <h2>Talk to our origination team</h2>
            <p>Share the project in confidence. We reply within two business days.</p>
          </div>
          {apply('btn mk7-btn-light btn-sm')}
        </section>
      </main>
    </>
  );
}
