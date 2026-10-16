import { useState } from 'react';

import { useDemo } from '../../demo/state';
import { errorText, useKybActions } from '../../kyb/actions';
import { isApplicant, pctOf, setKyb, useKyb } from '../../kyb/store';
import { short } from '../../lib/format';
import { Aside } from './Aside';
import { Todo } from './Todo';

/** Step 4: everything on one page, two declarations, submit. */
export function ReviewStep() {
  const kyb = useKyb();
  const { toast, email } = useDemo();
  const actions = useKybActions();
  const [sending, setSending] = useState(false);
  const { accurate, controls } = kyb.declarations;
  const declare = (k: 'accurate' | 'controls') => (e: { target: { checked: boolean } }) =>
    setKyb((s) => ({ ...s, declarations: { ...s.declarations, [k]: e.target.checked } }));
  const c = kyb.company;
  const a = kyb.applicant;
  const others = kyb.people.filter((p) => !isApplicant(p, a));
  const listed = others.map((p) => [p.name, p.director ? 'director' : '', pctOf(p.ownership) ? `${pctOf(p.ownership)}%` : ''].filter(Boolean).join(', '));

  const submit = async () => {
    setSending(true);
    try {
      await actions.submit();
      toast(actions.live ? 'Submitted. We will email you when it is approved' : 'Submitted (demo). We will email you when it is approved');
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="dbody">
      <div className="panel kstep">
        <h2>Review and submit</h2>
        <p>Check the details below. After you submit, the platform reviews the application with the verification provider.</p>

        <div className="panel card" style={{ padding: '4px 20px 6px' }}>
          <dl className="kv" style={{ marginTop: 0 }}>
            <div style={{ borderTop: 0 }}>
              <dt>Company</dt>
              <dd>{c.legalName}</dd>
            </div>
            <div>
              <dt>Type · country</dt>
              <dd>
                {c.type} · {c.country}
              </dd>
            </div>
            <div>
              <dt>Registration</dt>
              <dd>
                {c.regNo} · {kyb.check?.found ? 'found in the registry' : 'no online registry result, checked by hand'}
              </dd>
            </div>
            <div>
              <dt>Certificate</dt>
              <dd>{c.doc}</dd>
            </div>
            <div>
              <dt>Registered address</dt>
              <dd>{c.address}</dd>
            </div>
            <div>
              <dt>Business</dt>
              <dd>{c.business}</dd>
            </div>
            {c.website ? (
              <div>
                <dt>Website</dt>
                <dd>{c.website}</dd>
              </div>
            ) : null}
            <div>
              <dt>Applicant</dt>
              <dd>
                {a.name}, {a.title} · {a.id === 'review' ? 'ID checked, a reviewer looks at it' : 'ID verified'}
              </dd>
            </div>
            <div>
              <dt>Directors and owners</dt>
              <dd>
                {listed.length ? listed.join('; ') : 'Only you'}
              </dd>
            </div>
            <div>
              <dt>Lending address</dt>
              <dd className="mono">{kyb.wallets.map(short).join(', ')}</dd>
            </div>
            <div>
              <dt>Withdrawal address</dt>
              <dd className="mono">{short(kyb.treasury)}</dd>
            </div>
            {email ? (
              <div>
                <dt>Updates sent to</dt>
                <dd>{email}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div style={{ marginTop: 20 }}>
          <label className="inv-ck">
            <input type="checkbox" checked={accurate} onChange={declare('accurate')} />
            <span>The information is accurate and I am authorized to act for the company.</span>
          </label>
          <label className="inv-ck">
            <input type="checkbox" checked={controls} onChange={declare('controls')} />
            <span>The company controls the withdrawal address.</span>
          </label>
        </div>

        <div className="kacts">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => actions.go('wallets').catch((e) => toast(errorText(e)))}>
            Back
          </button>
          {sending ? null : <Todo text={!accurate || !controls ? 'tick both declarations' : null} />}
          <div className="r">
            <button className="btn btn-primary btn-sm" type="button" disabled={!accurate || !controls || sending} onClick={submit}>
              {sending ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        </div>
      </div>
      <Aside />
    </div>
  );
}
