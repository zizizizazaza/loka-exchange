import { useState } from 'react';

import { useDemo } from '../demo/state';
import { hx, num, short } from '../lib/format';

// This phase has no bank transfers (decided 2026-10-13): deposit swaps USDC for AIUSD 1:1, withdraw swaps back,
// sent only to a registered address.
const NETS = ['Ethereum', 'Base', 'Arbitrum'];
const WALLET_USDC = 120000;

/** Deposit and withdraw: the prototype's renderDeposit(). */
export function Deposit() {
  const { bal, setBal, toast, depositDir: dir, setDepositDir, depositNet: net, setDepositNet } = useDemo();
  const [amount, setAmount] = useState(0);
  const mint = dir === 'mint';
  // Switching redraws the form in the prototype, which clears the amount.
  const setDir = (d: 'mint' | 'redeem') => {
    setDepositDir(d);
    setAmount(0);
  };
  const setNet = (n: string) => {
    setDepositNet(n);
    setAmount(0);
  };

  const from = mint ? 'USDC' : 'AIUSD';
  const to = mint ? 'AIUSD' : 'USDC';
  const label = mint ? 'Mint AIUSD' : 'Redeem to USDC';
  const cap = mint ? WALLET_USDC : bal;
  const ok = amount > 0 && amount <= cap;
  const text = !amount ? 'Enter an amount' : ok ? label : `Not enough ${from}`;

  const icon = (t: string) => (
    <span className="ic" style={{ background: t === 'USDC' ? '#2775ca' : 'var(--ink)' }}>
      {t === 'USDC' ? '$' : 'A'}
    </span>
  );

  const go = () => {
    setBal((b) => (mint ? b + amount : b - amount));
    toast(mint ? `Minted ${num(amount)} AIUSD from USDC (demo)` : `Redeemed ${num(amount)} AIUSD to USDC (demo)`);
    setAmount(0);
  };

  return (
    <div className="xwrap narrow">
      <div className="page-head">
        <div>
          <h1>{mint ? 'Deposit' : 'Withdraw'}</h1>
          <p>
            {mint
              ? 'Send USDC and receive AIUSD 1:1, the account currency for every market.'
              : 'Redeem AIUSD 1:1 for USDC, sent to a registered address.'}
          </p>
        </div>
      </div>
      <div className="dtop">
        <span className="seg sm" role="group" aria-label="Direction">
          <button type="button" aria-pressed={mint} onClick={() => setDir('mint')}>
            Deposit
          </button>
          <button type="button" aria-pressed={!mint} onClick={() => setDir('redeem')}>
            Withdraw
          </button>
        </span>
        <span className="seg sm" role="group" aria-label="Network">
          {NETS.map((n) => (
            <button key={n} type="button" aria-pressed={n === net} onClick={() => setNet(n)}>
              {n}
            </button>
          ))}
        </span>
      </div>
      <div className="kyb">
        <i className="ph-fill ph-seal-check"></i>
        <span>
          <b>Northwind Capital Ltd</b> · business verified
        </span>
        <span className="muted">Sample account</span>
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
                id="dIn"
                inputMode="numeric"
                placeholder="0"
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
              {mint ? `Balance ${num(bal)} AIUSD` : `To treasury wallet ${short(hx('northwind-treasury'))}`}
            </span>
          </div>
          <div className="emain">
            <div className="tok">
              {icon(to)}
              <b>{to}</b>
            </div>
            <div className="eamt">
              <output id="dOut" className={amount ? '' : 'zero'}>
                {amount ? num(amount) : '0'}
              </output>
            </div>
          </div>
        </div>
        <button className="ego" id="dGo" type="button" disabled={!ok} onClick={go}>
          {text}
        </button>
        <div className="emeta">
          <div>
            <span>Rate</span>
            <b>1 : 1</b>
          </div>
          <div>
            <span>Loka fee</span>
            <b>Free</b>
          </div>
          <div>
            <span>Network</span>
            <b>{net} · a few seconds</b>
          </div>
          {mint ? (
            <div>
              <span>Yield on AIUSD</span>
              <b>None</b>
            </div>
          ) : (
            <div>
              <span>Destination</span>
              <b>Registered addresses only · new ones usable after 24 hours</b>
            </div>
          )}
        </div>
      </div>
      <p className="note-line" style={{ margin: '14px 4px 0' }}>
        Bank transfers are not supported in this phase. Fund with USDC from your own wallet or custodian.
      </p>
    </div>
  );
}
