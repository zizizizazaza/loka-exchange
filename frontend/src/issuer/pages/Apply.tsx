import { useState, type FormEvent } from 'react';

import { pct } from '../../lib/format';
import { useToast } from '../toast';

type Field = 'qty' | 'site' | 'left' | 'rent' | 'amt' | 'val';

/** Numbers are shown with thousands separators as you type, as in the prototype. */
const asNumber = (s: string) => Number((s || '').replace(/[^0-9.]/g, '')) || 0;
const grouped = (s: string) => {
  const n = s.replace(/[^0-9]/g, '');
  return n ? Number(n).toLocaleString('en-US') : s;
};

/** Monthly payment at 11% over max(left, 24) months, as in the prototype's eligibility check. */
const monthly = (amt: number, left: number) => (amt * (0.11 / 12)) / (1 - Math.pow(1 + 0.11 / 12, -Math.max(left, 24)));

/** "New application": the prototype's renderApply(). */
export function Apply() {
  const toast = useToast();
  const [v, setV] = useState<Record<Field, string>>({ qty: '', site: '', left: '', rent: '', amt: '', val: '' });
  const set = (k: Field, numeric: boolean) => (e: { target: { value: string } }) =>
    setV((old) => ({ ...old, [k]: numeric ? grouped(e.target.value) : e.target.value }));

  const amt = asNumber(v.amt);
  const val = asNumber(v.val);
  const left = asNumber(v.left);
  const rent = asNumber(v.rent);
  const items: [string, string, boolean | null][] = [
    ['Equipment installed and rented out', 'Confirmed by the offtake contract', null],
    ['Offtake at least 24 months', left ? `${left} months` : 'Enter months remaining', left ? left >= 24 : null],
    ['Loan at most 80% of value', amt && val ? `${pct(amt / val, 0)} of your estimate` : 'Enter amount and value', amt && val ? amt / val <= 0.8 : null],
    [
      'Rent covers payments',
      amt && rent ? `About ${(rent / monthly(amt, left)).toFixed(2)}× at 11%` : 'Enter rent and amount',
      amt && rent ? rent / monthly(amt, left) >= 1.15 : null,
    ],
    ['Buyer will sign a three-party agreement', 'Needed before drawdown', null],
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    toast('Application submitted. We reply within 3 business days (demo).');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New application</h1>
          <p>For GPUs that are already installed and rented out under a signed offtake contract.</p>
        </div>
      </div>
      <div className="dbody" style={{ marginTop: 0 }}>
        <form className="panel apf" id="apf" noValidate onSubmit={submit}>
          <fieldset>
            <legend>Equipment</legend>
            <div className="row2">
              <div className="field">
                <label htmlFor="f-gpu">GPU model</label>
                <select id="f-gpu">
                  <option>NVIDIA B300</option>
                  <option>NVIDIA B200</option>
                  <option>NVIDIA H200 SXM</option>
                  <option>NVIDIA H100 SXM</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-qty">Quantity</label>
                <input id="f-qty" inputMode="numeric" placeholder="e.g. 128" value={v.qty} onChange={set('qty', true)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-site">Data center</label>
              <input id="f-site" placeholder="City, country" value={v.site} onChange={set('site', false)} />
            </div>
          </fieldset>
          <fieldset>
            <legend>Offtake contract</legend>
            <div className="row2">
              <div className="field">
                <label htmlFor="f-buyer">Buyer type</label>
                <select id="f-buyer">
                  <option>Inference platform</option>
                  <option>Model training lab</option>
                  <option>Cloud GPU reseller</option>
                  <option>Enterprise</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-left">Months remaining</label>
                <input id="f-left" inputMode="numeric" placeholder="e.g. 30" value={v.left} onChange={set('left', true)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-rent">
                Monthly rent <em>USD</em>
              </label>
              <input id="f-rent" inputMode="numeric" placeholder="e.g. 250,000" value={v.rent} onChange={set('rent', true)} />
            </div>
          </fieldset>
          <fieldset>
            <legend>Financing</legend>
            <div className="row2">
              <div className="field">
                <label htmlFor="f-amt">
                  Amount requested <em>USD</em>
                </label>
                <input id="f-amt" inputMode="numeric" placeholder="e.g. 4,000,000" value={v.amt} onChange={set('amt', true)} />
              </div>
              <div className="field">
                <label htmlFor="f-val">
                  Equipment value <em>your estimate</em>
                </label>
                <input id="f-val" inputMode="numeric" placeholder="e.g. 5,200,000" value={v.val} onChange={set('val', true)} />
              </div>
            </div>
          </fieldset>
          <button className="btn btn-primary btn-block" type="submit" id="f-go">
            Submit application
            <span className="go">
              <i className="ph ph-arrow-right"></i>
            </span>
          </button>
        </form>
        <div className="aside">
          <div className="panel card">
            <h3>Eligibility</h3>
            <ul className="elig" id="elig">
              {items.map(([t, s, ok]) => (
                <li key={t} className={ok === true ? 'ok' : ok === false ? 'no' : ''}>
                  <i className={`ph ${ok === true ? 'ph-check-circle' : ok === false ? 'ph-x-circle' : 'ph-circle'}`}></i>
                  <span>
                    <b>{t}</b>
                    <small>{s}</small>
                  </span>
                </li>
              ))}
            </ul>
            <p className="small">An appraiser sets the final value. The loan can be at most 80% of it.</p>
          </div>
          <div className="panel card">
            <h3>What happens next</h3>
            <ol className="nextsteps">
              <li>We verify the company and the offtake contract</li>
              <li>An appraiser values the equipment</li>
              <li>You get a term sheet: amount, rate, term</li>
              <li>The facility opens; lenders fill the escrow</li>
              <li>You complete six drawdown tasks, then funds arrive</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
