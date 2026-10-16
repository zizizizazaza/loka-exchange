import { useDemo } from '../demo/state';

const PREP = [
  'Offtake contract with at least 24 months remaining',
  'Equipment list with serial numbers and invoices',
  'Data center or colocation agreement',
  'Company financial statements, last two years',
  'Read-only access for monitoring nodes',
  "Buyer's consent to pay rent into a controlled account",
];

/**
 * "List your GPUs" for compute operators: the prototype's renderIssue().
 * Applying needs a sign-in (contracts and financials are uploaded, progress is tracked in the issuer console).
 */
export function Issue() {
  const { access, signIn } = useDemo();
  const signed = access !== 'public';
  const steps: [string, string, string][] = [
    ['Apply', `${access === 'public' ? 'Sign in, then send' : 'Send'} the asset details and the offtake contract.`, 'A few days'],
    ['Review and appraisal', 'We review the operator and the buyer; an independent appraiser values the GPUs.', '2 to 3 weeks'],
    ['Listed for subscription', 'Investors subscribe. Their money waits in an escrow contract.', 'Up to 30 days'],
    ['Six conditions signed', 'SPV and pledge, lien, rent routing, monitoring, appraisal, full subscription. Each is signed and recorded on-chain.', 'In parallel'],
    ['Funds released', 'The loan is paid to the SPV for the equipment. A three-month reserve is set aside.', 'Same day'],
    ['Repaid from rent', 'Each month the buyer pays rent into a controlled account. Holders are paid first, then the service fee; the rest is yours.', 'Monthly'],
  ];
  const apply = signed ? (
    <a className="btn btn-primary btn-sm" href="issuer/index.html#/apply">
      Apply to list
    </a>
  ) : (
    <button className="btn btn-primary btn-sm" type="button" onClick={signIn}>
      Sign in to apply
    </button>
  );

  return (
    <div className="xwrap">
      <div className="page-head">
        <div>
          <h1>List your GPUs</h1>
          <p>For compute operators with GPUs already installed and rented out. Raise against the rent and keep your equity.</p>
        </div>
        <div className="vact">
          {signed ? (
            <a className="btn btn-ghost btn-sm" href="issuer/index.html#/loans">
              Issuer console
            </a>
          ) : null}
          {apply}
        </div>
      </div>
      <div className="dsum" style={{ marginTop: 0 }}>
        <div className="kstats">
          <div>
            <span>Offtake remaining</span>
            <b className="num">24 mo+</b>
            <em>Signed with a creditworthy buyer</em>
          </div>
          <div>
            <span>Loan to value</span>
            <b className="num">Up to 80%</b>
            <em>Of independent appraisal; you keep 20%+</em>
          </div>
          <div>
            <span>Reserve</span>
            <b className="num">3 months</b>
            <em>Of payments, set aside at release</em>
          </div>
          <div>
            <span>Coverage floor</span>
            <b className="num">1.15×</b>
            <em>Rent ÷ payment; below it, 30 days to cure</em>
          </div>
        </div>
      </div>
      <div className="is-grid">
        <section>
          <div className="sec-t">
            <h2>How it works</h2>
          </div>
          <ol className="is-steps">
            {steps.map(([t, d, w], i) => (
              <li key={t}>
                <span className="is-n">{i + 1}</span>
                <div>
                  <b>{t}</b>
                  <p>{d}</p>
                </div>
                <small>{w}</small>
              </li>
            ))}
          </ol>
        </section>
        <aside className="panel is-prep">
          <h3>What to prepare</h3>
          <ul>
            {PREP.map((x) => (
              <li key={x}>
                <i className="ph ph-check"></i>
                {x}
              </li>
            ))}
          </ul>
          <p>Timings are samples. Each listing's legal documents set the final terms.</p>
          {apply}
        </aside>
      </div>
    </div>
  );
}
