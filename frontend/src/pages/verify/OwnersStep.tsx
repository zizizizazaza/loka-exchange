import { useState } from 'react';

import { useDemo } from '../../demo/state';
import { errorText, useKybActions } from '../../kyb/actions';
import { isApplicant, type KybPerson, needsListing, OWNER_THRESHOLD, pctOf, setKyb, useKyb } from '../../kyb/store';
import { Aside } from './Aside';
import { Todo } from './Todo';

/**
 * Step 3: directors and owners of 25% or more, entered by the applicant. Their names are screened after submission
 * (backend/src/kyb/kyb.service.ts), so nothing here waits on it. They do nothing themselves; the platform asks one of
 * them for an ID check only if screening or review calls for it.
 * Registry directors are prefilled; the applicant, already verified, is shown but not asked for again.
 */
export function OwnersStep() {
  const kyb = useKyb();
  const { toast } = useDemo();
  const actions = useKybActions();
  const a = kyb.applicant;
  const [saving, setSaving] = useState(false);
  const others = kyb.people.filter((p) => !isApplicant(p, a));
  const meInRegistry = kyb.people.some((p) => isApplicant(p, a));
  const meDirector = a.director || meInRegistry;
  const meListed = needsListing(meDirector, a.ownership);

  const edit = (key: string, patch: Partial<KybPerson>) =>
    setKyb((s) => ({
      ...s,
      people: s.people.map((p) => (p.key === key ? { ...p, ...patch } : p)),
      ownersComplete: false,
    }));
  const add = () =>
    setKyb((s) => ({
      ...s,
      people: [
        ...s.people,
        { key: 'a' + Date.now(), name: '', director: false, ownership: '', dob: '', nationality: '', fromRegistry: false },
      ],
      ownersComplete: false,
    }));
  const remove = (key: string) => setKyb((s) => ({ ...s, people: s.people.filter((p) => p.key !== key) }));

  const total = others.reduce((n, p) => n + pctOf(p.ownership), pctOf(a.ownership));
  const rowError = (p: KybPerson) =>
    !p.fromRegistry && p.name.trim() && !needsListing(p.director, p.ownership)
      ? `Only directors and owners of ${OWNER_THRESHOLD}% or more need to be listed.`
      : null;
  const complete = others.every((p) => p.name.trim() && p.dob && p.nationality.trim() && !rowError(p));
  const ok = complete && total <= 100 && kyb.ownersComplete;
  const unfinished = others.find((p) => !p.name.trim() || !p.dob || !p.nationality.trim());
  const todo = unfinished
    ? unfinished.name.trim()
      ? `add ${unfinished.name.trim()}'s date of birth and nationality`
      : 'enter the name of the person you added'
    : others.some(rowError)
      ? `remove anyone who is not a director and owns less than ${OWNER_THRESHOLD}%`
      : total > 100
        ? 'correct the ownership shares'
        : !kyb.ownersComplete
          ? 'confirm the list with the checkbox above'
          : null;

  const next = async () => {
    setSaving(true);
    try {
      await actions.go('wallets');
    } catch (e) {
      toast(errorText(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dbody">
      <div className="panel kstep">
        <h2>Directors and owners</h2>
        <p>
          List the directors and anyone who owns {OWNER_THRESHOLD}% or more, directly or through other companies. After you
          submit, we check the names against sanctions and politically exposed persons lists; they do not need to do
          anything. If a check needs more, we ask that person to verify their ID and tell you first.
        </p>

        <div className="kown">
          {meListed ? (
            <div className="kper me">
              <div className="kph">
                <b>{a.name}</b>
                <span className="sig">You</span>
                {meDirector ? <span className="sig">Director</span> : null}
                {pctOf(a.ownership) ? <span className="sig">{pctOf(a.ownership)}%</span> : null}
                <span className="r">
                  <span className="sig ok">
                    <i className="ph ph-check"></i>ID verified
                  </span>
                </span>
              </div>
            </div>
          ) : null}

          {others.map((p) => {
            const err = rowError(p);
            return (
              <div className="kper" key={p.key}>
                <div className="kph">
                  {p.fromRegistry ? (
                    <>
                      <b>{p.name}</b>
                      <span className="sig">Director · from the registry</span>
                    </>
                  ) : (
                    <input
                      className="kname"
                      placeholder="Full legal name"
                      aria-label="Full legal name"
                      value={p.name}
                      onChange={(e) => edit(p.key, { name: e.target.value })}
                    />
                  )}
                  <span className="r">
                    {p.fromRegistry ? null : (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => remove(p.key)}>
                        Remove
                      </button>
                    )}
                  </span>
                </div>
                <div className="row4">
                  <div className="field">
                    <label htmlFor={`k-own-${p.key}`}>Ownership %</label>
                    <input
                      id={`k-own-${p.key}`}
                      inputMode="decimal"
                      placeholder="0"
                      value={p.ownership}
                      onChange={(e) => edit(p.key, { ownership: e.target.value.replace(/[^\d.]/g, '') })}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`k-dob-${p.key}`}>Date of birth</label>
                    <input id={`k-dob-${p.key}`} type="date" value={p.dob} onChange={(e) => edit(p.key, { dob: e.target.value })} />
                  </div>
                  <div className="field">
                    <label htmlFor={`k-nat-${p.key}`}>Nationality</label>
                    <input
                      id={`k-nat-${p.key}`}
                      placeholder="e.g. British"
                      value={p.nationality}
                      onChange={(e) => edit(p.key, { nationality: e.target.value })}
                    />
                  </div>
                  {p.fromRegistry ? null : (
                    <div className="field">
                      <label>Director</label>
                      <label className="inv-ck kck">
                        <input type="checkbox" checked={p.director} onChange={(e) => edit(p.key, { director: e.target.checked })} />
                        <span>Yes</span>
                      </label>
                    </div>
                  )}
                </div>
                {err ? <p className="kerr">{err}</p> : null}
              </div>
            );
          })}
        </div>
        <div className="tacts">
          <button className="btn btn-ghost btn-sm" type="button" onClick={add}>
            <i className="ph ph-plus"></i> Add a person
          </button>
        </div>
        {total > 100 ? <p className="kerr" style={{ marginTop: 12 }}>Ownership adds up to {total}%, more than 100%.</p> : null}

        <label className="inv-ck" style={{ marginTop: 20 }}>
          <input
            type="checkbox"
            checked={kyb.ownersComplete}
            onChange={(e) => setKyb((s) => ({ ...s, ownersComplete: e.target.checked }))}
          />
          <span>
            These are all the company's directors, and no one else owns {OWNER_THRESHOLD}% or more, directly or indirectly.
          </span>
        </label>

        <div className="kacts">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => actions.go('you').catch((e) => toast(errorText(e)))}>
            Back
          </button>
          <Todo text={todo} />
          <div className="r">
            <button className="btn btn-primary btn-sm" type="button" disabled={!ok || saving} onClick={next}>
              Continue
            </button>
          </div>
        </div>
      </div>
      <Aside />
    </div>
  );
}
