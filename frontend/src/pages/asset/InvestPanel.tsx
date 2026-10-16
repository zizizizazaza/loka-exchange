import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { useDemo } from '../../demo/state';
import { GateBtn } from '../../demo/ui';
import { num, usd, usdK } from '../../lib/format';

export interface InvestOptions {
  title: string;
  min: number;
  max: number;
  quick: (number | 'max')[];
  mine: number;
  rows: [string, ReactNode][];
  calcLabel: string;
  calc: (n: number) => string;
  ack: string;
  cta: string;
  note: string;
  withdraw?: () => void;
  done: (n: number) => void;
  toast: (n: number) => string;
}

/** Subscribe box: the prototype's invPanel() and bindInv(). Wallet confirmation is simulated, as in the prototype. */
export function InvestPanel({ o, focus }: { o: InvestOptions; focus?: boolean }) {
  const { ok, access, bal, toast } = useDemo();
  const navigate = useNavigate();
  const [amount, setAmount] = useState(0);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // The page drops "/subscribe" from the URL right away, so only the value at first render counts.
  const focusOnMount = useRef(focus);

  useEffect(() => {
    if (!focusOnMount.current) return;
    const t = setTimeout(() => {
      input.current?.focus({ preventScroll: true });
      document.querySelector('.ip')?.scrollIntoView({ block: 'center' });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  if (!ok) {
    return (
      <div className="inv inv-lock">
        <div className="inv-h">
          <b>{o.title}</b>
        </div>
        <p className="inv-p">
          {access === 'pending'
            ? 'Your business verification is in review. You can subscribe as soon as it is approved.'
            : 'Open to verified institutional investors. Rate, terms and documents appear after verification.'}
        </p>
        {access === 'pending' ? <span className="xpend">Verification in review</span> : <GateBtn />}
      </div>
    );
  }

  let label: string;
  let ready = false;
  let deposit = false;
  if (busy) label = 'Confirm in your wallet…';
  else if (!amount) label = 'Enter an amount';
  else if (amount < o.min) label = `Minimum ${num(o.min)} AIUSD`;
  else if (amount > o.max) label = `Only ${num(o.max)} AIUSD left`;
  else if (amount > bal) {
    label = 'Deposit AIUSD first';
    deposit = true;
  } else if (!ack) label = 'Confirm you have read the documents';
  else {
    label = `${o.cta} ${num(amount)} AIUSD`;
    ready = true;
  }

  const go = () => {
    if (deposit) {
      navigate('/deposit');
      return;
    }
    const n = amount;
    setBusy(true);
    setTimeout(() => {
      o.done(n);
      toast(o.toast(n));
      // The prototype redraws the page after a subscription, which clears the form.
      setBusy(false);
      setAmount(0);
      setAck(false);
    }, 900);
  };

  return (
    <div className="inv">
      <div className="inv-h">
        <b id="invT">{o.title}</b>
        <span>
          Balance <b className="num">{num(bal)}</b> AIUSD
        </span>
      </div>
      {o.mine ? (
        <div className="inv-mine">
          <span>Your subscription</span>
          <b className="num">{usd(o.mine)}</b>
          {o.withdraw ? (
            <button type="button" onClick={o.withdraw}>
              Withdraw
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="inv-in">
        <input
          id="invAmt"
          ref={input}
          inputMode="numeric"
          autoComplete="off"
          placeholder={`${num(o.min)} minimum`}
          aria-label="Amount in AIUSD"
          disabled={busy}
          value={amount ? num(amount) : ''}
          onChange={(e) => setAmount(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
        />
        <span>AIUSD</span>
      </div>
      <div className="inv-q">
        {o.quick.map((q) => (
          <button
            key={String(q)}
            type="button"
            onClick={() => setAmount(q === 'max' ? Math.max(0, Math.min(o.max, Math.floor(bal))) : q)}
          >
            {q === 'max' ? 'Max' : usdK(q)}
          </button>
        ))}
      </div>
      <dl className="inv-dl">
        {o.rows.map(([a, b]) => (
          <div key={a}>
            <dt>{a}</dt>
            <dd>{b}</dd>
          </div>
        ))}
        <div>
          <dt>{o.calcLabel}</dt>
          <dd className="num" id="invCalc">
            {amount ? o.calc(amount) : '—'}
          </dd>
        </div>
      </dl>
      <label className="inv-ck">
        <input type="checkbox" id="invAck" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>{o.ack}</span>
      </label>
      <button className="btn btn-primary inv-go" id="invGo" type="button" disabled={busy || !(ready || deposit)} onClick={go}>
        {label}
      </button>
      <p className="inv-n">{o.note}</p>
    </div>
  );
}
