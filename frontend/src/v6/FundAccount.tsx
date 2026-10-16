import { useState } from 'react';

import { useDemo } from '../demo/state';
import { TxLink } from '../demo/ui';
import { fmtD, num } from '../lib/format';
import { LenderGate, PageHead } from './Shell';

// Funding per PRD v0.3 4.3: wire USD with a reference code → converted to USDC → AIUSD minted 1:1; or USDC directly.
// Every deposit is one reconciliation record. Bank details and the funding partner are placeholders.

const REF = 'LK-NWC-7Q4D2';
const NETS = ['Ethereum', 'Base', 'Arbitrum'];
const WALLET_USDC = 120000;

type Tab = 'wire' | 'usdc' | 'withdraw';

export function V6FundAccount() {
  const { ok, bal, setBal, issues, toast, depositNet: net, setDepositNet } = useDemo();
  const [tab, setTab] = useState<Tab>('wire');
  const [amount, setAmount] = useState(0);
  if (!ok) {
    return (
      <main className="mk6-w mk6-main">
        <LenderGate what="Funding" />
      </main>
    );
  }

  const escrow = issues.reduce((a, n) => a + n.mine, 0);
  const pick = (t: Tab) => {
    setTab(t);
    setAmount(0);
  };
  const cap = tab === 'usdc' ? WALLET_USDC : bal;
  const valid = amount > 0 && amount <= cap;
  const submit = () => {
    setBal((b) => (tab === 'usdc' ? b + amount : b - amount));
    toast(
      tab === 'usdc'
        ? `Converted ${num(amount)} USDC to AIUSD (demo)`
        : `Withdrawal of ${num(amount)} AIUSD requested to your registered account (demo)`,
    );
    setAmount(0);
  };
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    toast(`Copied ${v}`);
  };

  return (
    <main className="mk6-w mk6-main tight">
      <PageHead
        title="Fund account"
        sub="Fund in US dollars by wire, or in USDC. Your balance is held as AIUSD, redeemable 1:1 for USD."
      />

      <dl className="mk6-figs three">
        <div>
          <dt>Available (AIUSD)</dt>
          <dd>{num(bal)}</dd>
          <small>Ready to commit</small>
        </div>
        <div>
          <dt>In escrow</dt>
          <dd>{num(escrow)}</dd>
          <small>Committed, waiting for drawdown</small>
        </div>
        <div>
          <dt>Verified entity</dt>
          <dd className="sm">Northwind Capital Ltd</dd>
          <small>Wires accepted only from accounts in this name</small>
        </div>
      </dl>

      <div className="mk6-fund">
        <section className="mk6-box big">
          <div className="mk6-seg" role="tablist">
            {(
              [
                ['wire', 'Wire USD'],
                ['usdc', 'Deposit USDC'],
                ['withdraw', 'Withdraw'],
              ] as [Tab, string][]
            ).map(([t, l]) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => pick(t)}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'wire' ? (
            <>
              <p className="mk6-lead">
                Send a USD wire from your company's bank account. Include the reference code so we can match it.
              </p>
              <dl className="mk6-kv">
                <div>
                  <dt>Reference code</dt>
                  <dd className="mk6-copy">
                    <b>{REF}</b>
                    <button type="button" onClick={() => copy(REF)}>
                      <i className="ph ph-copy"></i>Copy
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>Beneficiary</dt>
                  <dd>Licensed funding partner · named at onboarding</dd>
                </div>
                <div>
                  <dt>Account number</dt>
                  <dd>Dedicated account issued to Northwind Capital Ltd</dd>
                </div>
                <div>
                  <dt>Routing / SWIFT</dt>
                  <dd>Shown after onboarding</dd>
                </div>
                <div>
                  <dt>Credited as</dt>
                  <dd>AIUSD, 1:1 after conversion to USDC, less bank fees</dd>
                </div>
                <div>
                  <dt>Timing</dt>
                  <dd>Same business day for wires received before 2:00 pm ET (sample)</dd>
                </div>
              </dl>
              <p className="mk6-fine">Sample instructions. Wires from accounts in another name are returned.</p>
            </>
          ) : (
            <>
              <p className="mk6-lead">
                {tab === 'usdc'
                  ? 'Send USDC from your wallet or custodian. AIUSD is minted 1:1, with no fee.'
                  : 'Redeem AIUSD 1:1. Paid as USD to your registered bank account, or as USDC to a registered address.'}
              </p>
              {tab === 'usdc' ? (
                <div className="mk6-seg sm" role="group" aria-label="Network">
                  {NETS.map((n) => (
                    <button key={n} type="button" aria-pressed={n === net} onClick={() => setDepositNet(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              ) : null}
              <label className="mk6-input">
                <input
                  inputMode="numeric"
                  placeholder="0"
                  aria-label="Amount"
                  value={amount ? num(amount) : ''}
                  onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                />
                <span>{tab === 'usdc' ? 'USDC' : 'AIUSD'}</span>
              </label>
              <dl className="mk6-kv tight">
                <div>
                  <dt>{tab === 'usdc' ? 'Wallet balance' : 'Available'}</dt>
                  <dd>
                    {num(cap)} {tab === 'usdc' ? 'USDC' : 'AIUSD'}
                  </dd>
                </div>
                <div>
                  <dt>You receive</dt>
                  <dd>
                    {amount ? num(amount) : '—'} {tab === 'usdc' ? 'AIUSD' : 'USD'}
                  </dd>
                </div>
                <div>
                  <dt>{tab === 'usdc' ? 'Network' : 'Destination'}</dt>
                  <dd>{tab === 'usdc' ? net : 'Northwind Capital Ltd · account ending 4821'}</dd>
                </div>
              </dl>
              <button type="button" className="mk6-btn wide" disabled={!valid} onClick={submit}>
                {!amount ? 'Enter an amount' : !valid ? 'Amount exceeds balance' : tab === 'usdc' ? 'Convert to AIUSD' : 'Request withdrawal'}
              </button>
            </>
          )}
        </section>

        <aside className="mk6-box">
          <h3>How funding works</h3>
          <ol className="mk6-flow">
            <li>
              <b>Wire USD</b>
              <span>From your company's bank account, with the reference code</span>
            </li>
            <li>
              <b>Converted to USDC</b>
              <span>By the licensed funding partner</span>
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

      <section className="mk6-sec">
        <header>
          <h2>Funding activity</h2>
          <p>Each deposit is one record: bank receipt, fees, USDC conversion and AIUSD minted.</p>
        </header>
        <table className="mk6-table boxed">
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
            {(
              [
                ['LK-NWC-5M8K1', '2026-09-18', 250000, 35, 'done'],
                ['LK-NWC-3H2P9', '2026-08-04', 500000, 35, 'done'],
                ['LK-NWC-7Q4D2', null, 300000, 0, 'wait'],
              ] as [string, string | null, number, number, 'done' | 'wait'][]
            ).map(([ref, d, amt, fee, st]) => (
              <tr key={ref}>
                <td className="mono">{ref}</td>
                <td>{d ? fmtD(d) : '—'}</td>
                <td className="r">{num(amt)}</td>
                <td className="r">{fee ? num(fee) : '—'}</td>
                <td className="r">{st === 'done' ? <TxLink seed={`${ref}-usdc`} /> : '—'}</td>
                <td className="r">{st === 'done' ? num(amt - fee) : '—'}</td>
                <td>
                  <span className={`mk6-tag ${st === 'done' ? 'ok' : 'wait'}`}>
                    {st === 'done' ? 'Minted' : 'Awaiting wire'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
