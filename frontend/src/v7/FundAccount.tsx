import { useState } from 'react';

import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { fmtD, hx, num, short } from '../lib/format';
import { KV, LenderGate, ORG, PageHero, Section, Status } from './Shell';

// Fund account (#/v7/fund-account), PRD v0.3 4.3: wire USD with a reference code → converted to USDC → AIUSD minted
// 1:1; or USDC directly; withdrawals the reverse, as USDC or as USD to the company's bank account. Every deposit is one
// reconciliation record. Bank details and the funding partner are placeholders: the channel is still open (PRD 3.6 #1).
// The USDC deposit and the withdrawal use the original Deposit page's swap card (src/pages/Deposit.tsx, prototype.css).

const REF = 'LK-NWC-7Q4D2';
const NETS = ['Ethereum', 'Base', 'Arbitrum'];
const WALLET_USDC = 120000;

type Tab = 'wire' | 'usdc' | 'withdraw';

const RECORDS: [string, string | null, number, number, 'done' | 'wait'][] = [
  ['LK-NWC-5M8K1', '2026-09-18', 250000, 35, 'done'],
  ['LK-NWC-3H2P9', '2026-08-04', 500000, 35, 'done'],
  ['LK-NWC-7Q4D2', null, 300000, 0, 'wait'],
];

export function V7FundAccount() {
  const { ok, bal, issues, toast } = useDemo();
  const [tab, setTab] = useState<Tab>('wire');
  if (!ok) {
    return (
      <>
        <PageHero eyebrow="Lender account" title="Fund account" compact />
        <main className="mk7-w mk7-after">
          <LenderGate what="Funding" />
        </main>
      </>
    );
  }

  const escrow = issues.reduce((a, n) => a + n.mine, 0);
  const waiting = RECORDS.filter((r) => r[4] === 'wait');
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    toast(`Copied ${v}`);
  };

  return (
    <>
      <PageHero eyebrow={`${ORG} · AIUSD, redeemable 1:1 for USD`} title="Fund account" compact>
        <div>
          <dt>Available (AIUSD)</dt>
          <dd className="brand">{num(bal)}</dd>
          <small>Ready to lend</small>
        </div>
        <div>
          <dt>In escrow</dt>
          <dd>{num(escrow)}</dd>
          <small>Committed, waiting for drawdown</small>
        </div>
        <div>
          <dt>Awaiting wire (USD)</dt>
          <dd>{num(waiting.reduce((a, r) => a + r[2], 0))}</dd>
          <small>{waiting.length ? `Reference ${waiting.map((r) => r[0]).join(', ')}` : 'Nothing pending'}</small>
        </div>
        <div>
          <dt>Verified entity</dt>
          <dd className="sm">{ORG}</dd>
          <small>Wires accepted only from accounts in this name</small>
        </div>
      </PageHero>

      <main className="mk7-w mk7-after">

        <div className="mk7-fund">
          <section>
            <div className="mk7-tabs" role="tablist">
              {(
                [
                  ['wire', 'Wire USD'],
                  ['usdc', 'Deposit USDC'],
                  ['withdraw', 'Withdraw'],
                ] as [Tab, string][]
              ).map(([t, l]) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                  {l}
                </button>
              ))}
            </div>

            {tab === 'wire' ? (
              <div className="mk7-box">
                <p className="mk7-note">
                  Send a USD wire from your company's bank account. Include the reference code so we can match it.
                </p>
                <dl className="mk7-tkv">
                  <KV
                    k="Reference code"
                    v={
                      <span className="mk7-copy">
                        <b>{REF}</b>
                        <button type="button" onClick={() => copy(REF)}>
                          <i className="ph ph-copy" aria-hidden="true"></i>Copy
                        </button>
                      </span>
                    }
                  />
                  <KV k="Beneficiary" v="Licensed funding partner · named at onboarding" />
                  <KV k="Account number" v={`Dedicated account issued to ${ORG}`} />
                  <KV k="Routing / SWIFT" v="Shown after onboarding" />
                  <KV k="Credited as" v="AIUSD, 1:1 after conversion to USDC, less bank fees" />
                  <KV k="Timing" v="Same business day for wires received before 14:00 ET (sample)" />
                </dl>
                <p className="mk7-fine">Sample instructions. Wires from accounts in another name are returned.</p>
              </div>
            ) : (
              // Keyed by tab, so switching clears the amount, as the original page does.
              <Swap key={tab} mint={tab === 'usdc'} />
            )}
          </section>

          <aside className="mk7-box soft">
            <h3>How funding works</h3>
            <ol className="mk7-flow">
              <li>
                <b>Wire USD</b>
                <span>From your company's bank account, with the reference code</span>
              </li>
              <li>
                <b>Converted to USDC</b>
                <span>By the licensed funding partner; skip this if you already hold USDC</span>
              </li>
              <li>
                <b>AIUSD minted 1:1</b>
                <span>Credited to your account, recorded on-chain</span>
              </li>
              <li>
                <b>Reconciled daily</b>
                <span>Bank, USDC, AIUSD and balances checked every day; monthly statements</span>
              </li>
            </ol>
          </aside>
        </div>

        <Section
          title="Funding activity"
          note="Each deposit is one record: bank receipt, fees, USDC conversion and AIUSD minted."
        >
          <div className="mk7-tscroll">
            <table className="mk7-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Received</th>
                  <th className="r">Amount (USD)</th>
                  <th className="r">Fees</th>
                  <th className="r">USDC</th>
                  <th className="r">AIUSD minted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {RECORDS.map(([ref, d, amt, fee, st]) => (
                  <tr key={ref}>
                    <td className="mono">{ref}</td>
                    <td>{d ? fmtD(d) : '—'}</td>
                    <td className="r">{num(amt)}</td>
                    <td className="r">{fee ? num(fee) : '—'}</td>
                    <td className="r">{st === 'done' ? <TxLink seed={`${ref}-usdc`} /> : '—'}</td>
                    <td className="r">{st === 'done' ? num(amt - fee) : '—'}</td>
                    <td>
                      <Status tone={st === 'done' ? 'ok' : 'wait'}>{st === 'done' ? 'Minted' : 'Awaiting wire'}</Status>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </main>
    </>
  );
}

/** The original Deposit page's swap card: USDC → AIUSD, or AIUSD → USDC or USD (by wire). */
function Swap({ mint }: { mint: boolean }) {
  const { bal, setBal, toast, depositNet: net, setDepositNet } = useDemo();
  const [amount, setAmount] = useState(0);
  const [payout, setPayout] = useState<'USDC' | 'USD'>('USDC');

  const from = mint ? 'USDC' : 'AIUSD';
  const to = mint ? 'AIUSD' : payout;
  const onchain = mint || payout === 'USDC';
  const cap = mint ? WALLET_USDC : bal;
  const valid = amount > 0 && amount <= cap;
  const label = mint ? 'Mint AIUSD' : `Redeem to ${payout}`;
  const text = !amount ? 'Enter an amount' : valid ? label : `Not enough ${from}`;

  const icon = (t: string) => (
    <span className="ic" style={{ background: t === 'USDC' ? '#2775ca' : t === 'USD' ? 'var(--accent)' : 'var(--ink)' }}>
      {t === 'AIUSD' ? 'A' : '$'}
    </span>
  );

  const go = () => {
    setBal((b) => (mint ? b + amount : b - amount));
    toast(
      mint
        ? `Minted ${num(amount)} AIUSD from USDC (demo)`
        : payout === 'USD'
          ? `Redeemed ${num(amount)} AIUSD; USD wire to your registered account requested (demo)`
          : `Redeemed ${num(amount)} AIUSD to USDC (demo)`,
    );
    setAmount(0);
  };

  return (
    <div className="mk7-swap">
      <div className="dtop">
        {mint ? (
          <p className="mk7-note">Send USDC from your wallet or custodian. AIUSD is minted 1:1.</p>
        ) : (
          <span className="seg sm" role="group" aria-label="Receive as">
            {(['USDC', 'USD'] as const).map((p) => (
              <button key={p} type="button" aria-pressed={payout === p} onClick={() => setPayout(p)}>
                {p === 'USD' ? 'USD by wire' : 'USDC'}
              </button>
            ))}
          </span>
        )}
        {onchain ? (
          <span className="seg sm" role="group" aria-label="Network">
            {NETS.map((n) => (
              <button key={n} type="button" aria-pressed={n === net} onClick={() => setDepositNet(n)}>
                {n}
              </button>
            ))}
          </span>
        ) : null}
      </div>
      <div className="panel eform">
        <div className="eleg">
          <div className="erow">
            <span className="lab">You send</span>
            <span className="bal">{mint ? `Wallet ${num(WALLET_USDC)} USDC` : `Balance ${num(bal)} AIUSD`}</span>
          </div>
          <div className="emain">
            <div className="tok">
              {icon(from)}
              <b>{from}</b>
            </div>
            <div className="eamt">
              <input
                inputMode="numeric"
                placeholder="0"
                aria-label={`Amount in ${from}`}
                value={amount ? num(amount) : ''}
                onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              />
            </div>
          </div>
        </div>
        <div className="flipw">
          <span className="flip" aria-hidden="true">
            <i className="ph ph-arrow-down"></i>
          </span>
        </div>
        <div className="eleg">
          <div className="erow">
            <span className="lab">You receive</span>
            <span className="bal">
              {mint
                ? `Balance ${num(bal)} AIUSD`
                : payout === 'USD'
                  ? 'To account ending 4821'
                  : `To treasury wallet ${short(hx('northwind-treasury'))}`}
            </span>
          </div>
          <div className="emain">
            <div className="tok">
              {icon(to)}
              <b>{to}</b>
            </div>
            <div className="eamt">
              <output className={amount ? '' : 'zero'}>{amount ? num(amount) : '0'}</output>
            </div>
          </div>
        </div>
        <button className="ego" type="button" disabled={!valid} onClick={go}>
          {text}
        </button>
        <div className="emeta">
          <div>
            <span>Rate</span>
            <b>1 : 1</b>
          </div>
          <div>
            <span>Fee</span>
            <b>{onchain ? 'None' : 'None from Loka Capital · bank fees may apply'}</b>
          </div>
          <div>
            <span>{onchain ? 'Network' : 'Timing'}</span>
            <b>{onchain ? `${net} · a few seconds` : 'Same or next business day (sample)'}</b>
          </div>
          {mint ? (
            <div>
              <span>Interest on AIUSD</span>
              <b>None · interest comes from lending</b>
            </div>
          ) : (
            <div>
              <span>Destination</span>
              <b>
                {payout === 'USD'
                  ? `${ORG} · bank account in the company's name only`
                  : 'Registered addresses only · new ones usable after 24 hours'}
              </b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
