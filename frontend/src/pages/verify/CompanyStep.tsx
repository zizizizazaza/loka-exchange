import { useEffect, useState } from 'react';

import { useDemo } from '../../demo/state';
import { errorText, useKybActions } from '../../kyb/actions';
import { setKyb, useKyb } from '../../kyb/store';
import { fmtD } from '../../lib/format';
import { Aside } from './Aside';
import { Todo } from './Todo';

const TYPES = ['Private credit fund', 'Bank', 'Asset manager', 'Family office', 'Other'];

/** ID Analyzer KYB warning codes (docs/kyb.md section 3), in words the applicant can act on. */
const WARNINGS: Record<string, string> = {
  UNRECOGNIZED_BUSINESS_DOCUMENT: 'This does not look like a registration certificate.',
  DOCUMENT_LIKELY_INVALID: 'The document could not be confirmed as genuine.',
  BUSINESS_DISSOLVED: 'The registry lists the company as dissolved.',
  ENTITY_SANCTION_MATCH: 'The company matches a sanctions list. Contact us if you think this is wrong.',
  BUSINESS_NAME_MISMATCH: 'The name on the certificate differs from the registry. We check it in review.',
  DOCUMENT_LOW_CONFIDENCE: 'Parts of the document were hard to read. We check it in review.',
  ENTITY_CRIME_MATCH: 'The company name appears on a watch list. We check it in review.',
  ENTITY_PEP_MATCH: 'The company is linked to a politically exposed person. We check it in review.',
};
const SHOWN_WHEN_FOUND = ['BUSINESS_NAME_MISMATCH', 'DOCUMENT_LOW_CONFIDENCE', 'ENTITY_CRIME_MATCH', 'ENTITY_PEP_MATCH'];

/**
 * Step 1: the certificate first. POST /kyb only takes the document; it reads the company details and directors
 * from it and matches them against the registry, so the form below is prefilled for the applicant to confirm.
 */
export function CompanyStep() {
  const kyb = useKyb();
  const { toast } = useDemo();
  const actions = useKybActions();
  const c = kyb.company;
  const check = kyb.check;
  const rejected = check?.decision === 'REJECT';
  // While a certificate is on its way: how much of it has been sent (0 to 1), and when the upload started.
  const [busy, setBusy] = useState<{ sent: number; since: number } | null>(null);
  const reading = busy !== null;
  const set = (k: keyof typeof c) => (e: { target: { value: string } }) =>
    setKyb((s) => ({ ...s, company: { ...s.company, [k]: e.target.value } }));
  const todo = !check
    ? 'upload the registration certificate'
    : rejected
      ? 'upload a certificate that is accepted'
      : !c.legalName.trim()
        ? 'enter the legal name'
        : !c.regNo.trim()
          ? 'enter the registration number'
          : !c.country.trim()
            ? 'enter the country of registration'
            : !c.address.trim()
              ? 'enter the registered address'
              : !c.type
                ? 'choose the institution type'
                : !c.business.trim()
                  ? 'describe what the company does'
                  : null;

  const upload = async (file: File, found = true) => {
    setBusy({ sent: 0, since: Date.now() });
    try {
      await actions.uploadCertificate(file, (sent) => setBusy((b) => b && { ...b, sent }), found);
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(null);
    }
  };
  const notes = (codes: string[]) =>
    (check?.warnings ?? []).filter((w) => codes.includes(w.code)).map((w) => WARNINGS[w.code] ?? w.description ?? w.code);

  return (
    <div className="dbody">
      <div className="panel">
        <form className="apf" noValidate onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Registration certificate</legend>
            <p className="kintro">We read the company details and its directors from it, then check them against the official registry.</p>
            <label className={c.doc ? 'kup has' : 'kup'}>
              <i className={c.doc ? 'ph ph-file-text' : 'ph-light ph-upload-simple'}></i>
              <span>
                <b>{c.doc ?? 'Certificate of incorporation or business registration'}</b>
                <small>
                  {reading ? 'Checking this file…' : c.doc ? 'Click to replace' : 'PDF or image, up to 10 MB'}
                </small>
              </span>
              <input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                disabled={reading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  if (f.size > 10 * 1024 * 1024) return toast('The file is larger than 10 MB');
                  void upload(f);
                }}
              />
            </label>

            {busy ? (
              <Busy sent={busy.sent} since={busy.since} />
            ) : rejected ? (
              <div className="kres bad">
                <div className="kh">
                  <i className="ph-fill ph-x-circle"></i>Not accepted
                </div>
                <ul>
                  {(notes(Object.keys(WARNINGS)).length ? notes(Object.keys(WARNINGS)) : ['The document could not be verified.']).map(
                    (n) => (
                      <li key={n}>{n}</li>
                    ),
                  )}
                </ul>
                <p>Upload the official certificate of incorporation or business registration.</p>
              </div>
            ) : check?.found ? (
              <div className="kres">
                <div className="kh">
                  <i className="ph-fill ph-seal-check"></i>Found in the registry
                </div>
                <dl className="kv">
                  <div>
                    <dt>Registration</dt>
                    <dd>
                      {c.country} · {c.regNo}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {check.status || 'Not stated'}
                      {check.incorporated ? ` · incorporated ${fmtD(check.incorporated)}` : ''}
                    </dd>
                  </div>
                  {check.officers.length ? (
                    <div>
                      <dt>Directors</dt>
                      <dd>{check.officers.join(', ')}</dd>
                    </div>
                  ) : null}
                </dl>
                {notes(SHOWN_WHEN_FOUND).map((n) => (
                  <p key={n} className="knote">
                    {n}
                  </p>
                ))}
              </div>
            ) : check ? (
              <div className="kres miss">
                <div className="kh">
                  <i className="ph-fill ph-warning-circle"></i>No online registry result
                </div>
                <p>
                  The certificate was read, but the company could not be confirmed in an online registry. We check it by hand
                  during review; you can continue.
                </p>
                {check.officers.length ? (
                  <dl className="kv">
                    <div>
                      <dt>Directors on the certificate</dt>
                      <dd>{check.officers.join(', ')}</dd>
                    </div>
                  </dl>
                ) : null}
              </div>
            ) : null}
          </fieldset>

          {check && !rejected ? (
            <>
              <fieldset>
                <legend>Company</legend>
                <p className="kintro">Read from the certificate. Correct anything that is wrong.</p>
                <div className="field">
                  <label htmlFor="k-name">Legal name</label>
                  <input id="k-name" value={c.legalName} onChange={set('legalName')} />
                </div>
                <div className="row2">
                  <div className="field">
                    <label htmlFor="k-reg">Registration number</label>
                    <input id="k-reg" value={c.regNo} onChange={set('regNo')} />
                  </div>
                  <div className="field">
                    <label htmlFor="k-country">Country of registration</label>
                    <input id="k-country" value={c.country} onChange={set('country')} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="k-addr">Registered address</label>
                  <input id="k-addr" placeholder="Street, city, postal code" value={c.address} onChange={set('address')} />
                </div>
              </fieldset>
              <fieldset>
                <legend>Business</legend>
                <div className="field">
                  <label htmlFor="k-type">Institution type</label>
                  <select id="k-type" value={c.type} onChange={set('type')}>
                    <option value="">Select</option>
                    {TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="k-biz">
                    What the company does <em>and where its funds come from</em>
                  </label>
                  <input
                    id="k-biz"
                    placeholder="e.g. Credit fund investing client capital in secured loans"
                    value={c.business}
                    onChange={set('business')}
                  />
                </div>
                <div className="field">
                  <label htmlFor="k-web">
                    Website <em>optional</em>
                  </label>
                  <input id="k-web" placeholder="https://" value={c.website} onChange={set('website')} />
                </div>
              </fieldset>
            </>
          ) : null}

          <div className="kacts">
            <span className="muted" style={{ fontSize: 12.5 }}>
              {actions.live ? (
                'Checked by our licensed verification provider.'
              ) : (
                <>
                  Sample check: any file works.{' '}
                  {c.doc && !reading ? (
                    <button className="klink" type="button" onClick={() => void upload(new File([], c.doc!), !check?.found)}>
                      {check?.found ? 'Show the not-in-registry case' : 'Show the found case'}
                    </button>
                  ) : null}
                </>
              )}
            </span>
            {reading ? null : <Todo text={todo} />}
            <div className="r">
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={!!todo || reading}
                onClick={() => actions.go('you').catch((e) => toast(errorText(e)))}
              >
                Continue
              </button>
            </div>
          </div>
        </form>
      </div>
      <Aside />
    </div>
  );
}

/** The upload, then the provider's check: a bar while the file is sent, then a spinner with the time taken so far. */
function Busy({ sent, since }: { sent: number; since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.round((now - since) / 1000));
  const uploading = sent < 1;
  return (
    <div className="kbusy" role="status" aria-live="polite">
      <div className="kh">
        <span className="kspin" aria-hidden="true"></span>
        {uploading ? `Uploading ${Math.round(sent * 100)}%` : 'Reading the certificate and checking the registry'}
      </div>
      <div className="kbar">
        <i style={{ width: `${uploading ? Math.max(4, sent * 50) : 50 + Math.min(45, seconds * 1.5)}%` }}></i>
      </div>
      <p>
        {uploading
          ? 'Sending the file securely to our verification provider.'
          : `Usually 10 to 30 seconds. Keep this page open. ${seconds}s`}
      </p>
    </div>
  );
}
