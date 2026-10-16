import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';

import '../styles/markets-v4.css';

import { bal, isOpen, LOANS, M, mo, nDone, pmt, type NewIssue } from '../demo/data';
import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { useGateClick } from '../demo/useGateClick';
import { BUILD_ACTIVE, BUILD_OPEN, drawnShare, MILESTONES } from './facilitySamples';
import { fmtD, num, pct, short, usd, usdM } from '../lib/format';

// Fourth take on Markets (#/markets-v4): PRD v0.3 wording (Loka Capital, Facilities, lenders, drawdowns) and a
// Galaxy-like frame (black hero, bold sans, rounded headline figures). The page draws its own header with the new
// names and hides the shared one while open, so no other page changes. Styles scoped under .mk4.

const DAY = 86400000;
const daysTo = (d: string) => Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / DAY);
const bigM = (n: number) => `$${Math.floor(n / 1e6)}M`;

type Kind = 'All' | 'Operating' | 'Construction';

export function MarketsV4() {
  const { ok, issues, toast } = useDemo();
  const onGate = useGateClick();
  const [kind, setKind] = useState<Kind>('All');

  useEffect(() => {
    document.body.classList.add('mk4-page');
    return () => document.body.classList.remove('mk4-page');
  }, []);

  const ops = M.filter((m) => m.cat === 'credit' && LOANS[m.sym]).map((m) => {
    const l = LOANS[m.sym];
    const k = l.got.length;
    const p = pmt(l);
    const out = bal(l, k);
    const reserve = 3 * p;
    return { m, l, k, p, out, reserve, left: l.term - k, cov: l.got.at(-1)! / p, oc: (l.appraisal + reserve) / out };
  });
  const opsOut = ops.reduce((a, r) => a + r.out, 0);
  const wOc = ops.reduce((a, r) => a + r.out * r.oc, 0) / opsOut;
  const payments = ops.reduce((a, r) => a + r.k, 0);
  const paidToLenders = ops.reduce((a, r) => a + r.k * r.p, 0);
  const reserves = ops.reduce((a, r) => a + r.reserve, 0);
  const phxBal = BUILD_ACTIVE.amt * drawnShare(BUILD_ACTIVE.drawn);

  const committed =
    ops.reduce((a, r) => a + r.l.amount, 0) +
    BUILD_ACTIVE.amt +
    issues.reduce((a, n) => a + n.amt * n.sub, 0) +
    BUILD_OPEN.amt * BUILD_OPEN.sub;
  const facilities = ops.length + 1 + issues.length + 1;
  const remaining = issues.reduce((a, n) => a + n.amt * (1 - n.sub), 0) + BUILD_OPEN.amt * (1 - BUILD_OPEN.sub);
  const asOf = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="mk4">
      <section className="mk4-hero">
        <div className="mk4-in">
          <div className="mk4-preview">
            <span>Preview · v4</span>
            <Link to="/markets">Current</Link>
            <Link to="/markets-v3">v3</Link>
          </div>
          <header className="mk4-top">
            <a className="mk4-brand" href="../index.html" title="Back to site">
              <span className="brand-mark" aria-hidden="true"></span>Loka Capital
            </a>
            <nav aria-label="Main">
              <NavLink to="/markets-v4">Facilities</NavLink>
              <NavLink to="/portfolio">Portfolio</NavLink>
              <NavLink to="/issue">Borrow</NavLink>
            </nav>
            <div className="mk4-right">
              <V4HeaderRight />
            </div>
          </header>

          <p className="mk4-eye">Private credit for AI infrastructure</p>
          <h1>Secured lending to the compute that powers AI.</h1>
          <p className="mk4-lede">
            Loans to operating and under-construction compute centers, secured by GPUs and contracted rent. Each facility
            has its own escrow; funds draw only after named parties sign every condition on-chain.
          </p>

          <dl className="mk4-stats">
            <div>
              <dd>{bigM(committed)}+</dd>
              <dt>Capital committed by lenders</dt>
            </div>
            <div>
              <dd>{facilities}</dd>
              <dt>Facilities, operating and under construction</dt>
            </div>
            <div>
              <dd>{pct(wOc, 0)}</dd>
              <dt>Weighted over-collateralization, operating facilities</dt>
            </div>
            <div>
              <dd>0</dd>
              <dt>Missed payments, of {payments} since inception</dt>
            </div>
          </dl>
          <p className="mk4-asof">As of {asOf}. Sample data.</p>
        </div>
      </section>

      <section className="mk4-rules">
        <p className="mk4-eye dark">How every facility is structured</p>
        <h2>Three rules the platform cannot override.</h2>
        <ol>
          <li>
            <span>01</span>
            <h3>Ring-fenced escrow</h3>
            <p>Each facility has its own escrow contract. No pooled funds; Loka Capital never holds lender capital.</p>
          </li>
          <li>
            <span>02</span>
            <h3>Verify, then draw</h3>
            <p>
              Funds move only after named parties sign each condition on-chain. Construction facilities draw in four
              milestones, each signed by an independent engineer.
            </p>
          </li>
          <li>
            <span>03</span>
            <h3>Lenders paid first</h3>
            <p>
              Rent goes straight to a collection contract and pays lenders before fees or the borrower. Losses hit the
              reserve and borrower equity first.
            </p>
          </li>
        </ol>
      </section>

      <section className="mk4-sec">
        <header className="mk4-sec-h">
          <div>
            <p className="mk4-eye dark">Open for commitments</p>
            <h2>Facilities raising now</h2>
          </div>
          <span>{usdM(remaining)} remaining capacity · Minimum commitment 100,000 AIUSD</span>
        </header>
        <div className="mk4-cards">
          {issues.map((n) => (
            <OperatingCard key={n.sym} n={n} ok={ok} onGate={onGate} />
          ))}
          <article className="mk4-card">
            <div className="mk4-card-top">
              <span className="mk4-type build">Construction</span>
              <span className="mk4-state live">Open for commitments</span>
            </div>
            <h3>{BUILD_OPEN.name}</h3>
            <p className="mk4-sub">
              {BUILD_OPEN.gpu} · {BUILD_OPEN.site}
            </p>
            <dl className="mk4-terms">
              <div>
                <dt>Facility size</dt>
                <dd>{usdM(BUILD_OPEN.amt)}</dd>
              </div>
              <div>
                <dt>Interest rate</dt>
                <dd>
                  <Rate r={BUILD_OPEN.rate} />
                </dd>
              </div>
              <div>
                <dt>Term</dt>
                <dd>{BUILD_OPEN.term} mo</dd>
              </div>
              <div>
                <dt>Loan to cost</dt>
                <dd>{pct(BUILD_OPEN.amt / BUILD_OPEN.cost, 0)}</dd>
              </div>
            </dl>
            <div className="mk4-ms" aria-label="Drawdown schedule">
              {MILESTONES.map(([t, s]) => (
                <div key={t} style={{ flexGrow: s }}>
                  <i></i>
                  <span>{pct(s, 0)}</span>
                  <small>{t}</small>
                </div>
              ))}
            </div>
            <Commit sub={BUILD_OPEN.sub} label="Closes" date={BUILD_OPEN.closes} />
            <div className="mk4-act">
              {/* No detail page for the sample construction facility yet. */}
              <button className="mk4-btn" type="button" onClick={ok ? () => toast('Lending flow (demo)') : onGate}>
                Lend
              </button>
              <button className="mk4-more" type="button" onClick={ok ? () => toast('Term sheet (demo)') : onGate}>
                Term sheet <i className="ph ph-arrow-right"></i>
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="mk4-sec">
        <header className="mk4-sec-h">
          <div>
            <p className="mk4-eye dark">Active facilities</p>
            <h2>Performance</h2>
          </div>
          <span>
            Data as of {asOf} · <TxLink seed="loka-loan-registry" />
          </span>
        </header>

        <dl className="mk4-record">
          <div>
            <dd>{payments}</dd>
            <dt>Monthly payments received</dt>
          </div>
          <div>
            <dd>0</dd>
            <dt>Missed</dt>
          </div>
          <div>
            <dd>{usd(Math.round(paidToLenders))}</dd>
            <dt>Paid to lenders</dt>
          </div>
          <div>
            <dd>{usd(Math.round(reserves))}</dd>
            <dt>Cash reserves held</dt>
          </div>
        </dl>

        <div className="mk4-tabs" role="tablist" aria-label="Facility type">
          {(['All', 'Operating', 'Construction'] as Kind[]).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
              {k}
            </button>
          ))}
        </div>

        <div className="mk4-table-wrap">
          <table className="mk4-table">
            <thead>
              <tr>
                <th>Facility</th>
                <th className="r">Balance</th>
                {ok ? <th className="r">Interest rate</th> : null}
                <th className="r">Remaining</th>
                <th className="r">Coverage</th>
                <th className="r">Collateral</th>
                <th>Status</th>
                <th aria-label="Open"></th>
              </tr>
            </thead>
            <tbody>
              {kind !== 'Construction'
                ? ops.map((r) => (
                    <tr key={r.m.sym}>
                      <td>
                        <Link className="mk4-fac" to={`/asset/${r.m.sym}`}>
                          <b>{r.m.name}</b>
                          <span>
                            {r.m.sym} · Operating · {r.m.loan!.site}
                          </span>
                        </Link>
                      </td>
                      <td className="r">{usd(Math.round(r.out))}</td>
                      {ok ? <td className="r">{pct(r.l.rate, 2)}</td> : null}
                      <td className="r">
                        {r.left} mo<small>of {r.l.term}</small>
                      </td>
                      <td className={`r ${r.cov < 1.25 ? 'warn' : ''}`}>
                        {r.cov.toFixed(2)}×<small>min 1.15×</small>
                      </td>
                      <td className="r">
                        {pct(r.oc, 0)}
                        <small>Over-collateralized</small>
                      </td>
                      <td>
                        <span className="mk4-state live">Performing</span>
                      </td>
                      <td className="go">
                        <Link to={`/asset/${r.m.sym}`} aria-label={`${r.m.name} details`}>
                          <i className="ph ph-arrow-right"></i>
                        </Link>
                      </td>
                    </tr>
                  ))
                : null}
              {kind !== 'Operating' ? (
                <tr>
                  <td>
                    <span className="mk4-fac">
                      <b>{BUILD_ACTIVE.name}</b>
                      <span>
                        {BUILD_ACTIVE.sym} · Construction · {BUILD_ACTIVE.site}
                      </span>
                    </span>
                  </td>
                  <td className="r">
                    {usd(phxBal)}
                    <small>drawn of {usdM(BUILD_ACTIVE.amt)}</small>
                  </td>
                  {ok ? <td className="r">{pct(BUILD_ACTIVE.rate, 2)}</td> : null}
                  <td className="r">
                    Build<small>{BUILD_ACTIVE.buildLeft} mo to rent start</small>
                  </td>
                  <td className="r dim">
                    Interest-only<small>paid from reserve</small>
                  </td>
                  <td className="r">
                    {pct(BUILD_ACTIVE.amt / BUILD_ACTIVE.cost, 0)}
                    <small>Loan to cost</small>
                  </td>
                  <td>
                    <span className="mk4-state build">
                      Drawdown {BUILD_ACTIVE.drawn} of {MILESTONES.length}
                    </span>
                  </td>
                  <td className="go"></td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mk4-note">
          Coverage is rent collected divided by scheduled debt service; below 1.15× starts a 30-day cure period.
          Over-collateralization is equipment appraisal plus cash reserve, divided by the balance.
          {ok ? null : (
            <>
              {' '}Interest rates, full terms and documents are shown to verified lenders.{' '}
              <button type="button" onClick={onGate}>
                Request access
              </button>
            </>
          )}
        </p>
      </section>

      <footer className="mk4-foot">
        <p className="mk4-eye dark">Important information</p>
        <p>
          Offered to verified institutional lenders only. Loans are illiquid, held to maturity, and can lose value;
          interest is not guaranteed. Loka Capital does not lend, pool or hold lender funds. Design prototype with sample
          data.
        </p>
      </footer>
    </div>
  );
}

function OperatingCard({
  n,
  ok,
  onGate,
}: {
  n: NewIssue;
  ok: boolean;
  onGate: ReturnType<typeof useGateClick>;
}) {
  const o = isOpen(n);
  const oc = (n.appraisal + 3 * mo(n.amt, n.rate, n.term)) / n.amt;
  const done = nDone(n);
  return (
    <article className="mk4-card">
      <div className="mk4-card-top">
        <span className="mk4-type">Operating</span>
        <span className={`mk4-state ${o ? 'live' : 'wait'}`}>{o ? 'Open for commitments' : `Conditions ${done}/6`}</span>
      </div>
      <h3>
        <Link to={`/asset-v2/${n.sym}`}>{n.name}</Link>
      </h3>
      <p className="mk4-sub">
        {n.gpu} · {n.site}
      </p>
      <dl className="mk4-terms">
        <div>
          <dt>Facility size</dt>
          <dd>{usdM(n.amt)}</dd>
        </div>
        <div>
          <dt>Interest rate</dt>
          <dd>
            <Rate r={n.rate} />
          </dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{n.term} mo</dd>
        </div>
        <div>
          <dt>Over-collateralization</dt>
          <dd>{pct(oc, 0)}</dd>
        </div>
      </dl>
      <div className="mk4-conds" aria-label={`${done} of 6 drawdown conditions signed`}>
        <span>Drawdown conditions</span>
        <span className="mk4-pips">
          {n.cd.map((c, i) => (
            <i key={i} className={c ? 'on' : ''}></i>
          ))}
        </span>
        <b>{done}/6 signed</b>
      </div>
      <Commit sub={n.sub} label={o ? 'Closes' : 'Drawdown deadline'} date={o ? n.closes : n.deadline} />
      {ok && n.mine ? <p className="mk4-mine">Your commitment {usd(n.mine)} · in escrow</p> : null}
      <div className="mk4-act">
        {o ? (
          ok ? (
            <Link className="mk4-btn" to={`/asset/${n.sym}/subscribe`}>
              Lend
            </Link>
          ) : (
            <button className="mk4-btn" type="button" onClick={onGate}>
              Lend
            </button>
          )
        ) : (
          <Link className="mk4-btn ghost" to={`/asset-v2/${n.sym}`}>
            View progress
          </Link>
        )}
        <Link className="mk4-more" to={`/asset-v2/${n.sym}`}>
          Term sheet <i className="ph ph-arrow-right"></i>
        </Link>
      </div>
    </article>
  );
}

/** Interest rate, or a lock for viewers who are not verified lenders. */
function Rate({ r }: { r: number }) {
  const { ok } = useDemo();
  const onGate = useGateClick();
  return ok ? (
    <>{pct(r, 2)}</>
  ) : (
    <button type="button" className="mk4-lock" onClick={onGate}>
      <i className="ph ph-lock-simple"></i>Verified lenders
    </button>
  );
}

function Commit({ sub, label, date }: { sub: number; label: string; date: string }) {
  const d = daysTo(date);
  return (
    <div className="mk4-commit">
      <div className="mk4-bar">
        <i style={{ width: `${sub * 100}%` }}></i>
      </div>
      <span>
        <b>{pct(sub, 0)} committed</b>
        <em>
          {label} {fmtD(date)}
          {d > 0 ? ` · ${d} days` : ''}
        </em>
      </span>
    </div>
  );
}

/** Header actions with PRD v0.3 wording; same states as the shared HeaderRight. */
function V4HeaderRight() {
  const { access, bal: aiusd, loading, signedIn, wallet, signIn, signOut, sessionError } = useDemo();
  const onGate = useGateClick();
  if (loading) return null;
  if (sessionError)
    return (
      <button className="mk4-hbtn" type="button" onClick={signOut}>
        Sign out
      </button>
    );
  const chip = wallet ? (
    <button className="mk4-wal" type="button" title={signedIn ? 'Sign out' : undefined} onClick={signedIn ? signOut : undefined}>
      <i></i>
      {short(wallet)}
    </button>
  ) : null;
  switch (access) {
    case 'public':
      return (
        <>
          <button className="mk4-hlink" type="button" onClick={signIn}>
            Sign in
          </button>
          <button className="mk4-hbtn" type="button" onClick={onGate}>
            Request access
          </button>
        </>
      );
    case 'unverified':
      return (
        <>
          <button className="mk4-hbtn" type="button" onClick={onGate}>
            Verify your business
          </button>
          {chip}
        </>
      );
    case 'pending':
      return (
        <>
          <span className="mk4-pend">Verification in review</span>
          {chip}
        </>
      );
    case 'verified':
      return (
        <>
          <span className="mk4-bal">
            {num(aiusd)} <small>AIUSD</small>
          </span>
          <Link className="mk4-hbtn" to="/deposit">
            Fund account
          </Link>
          {chip}
        </>
      );
  }
}
