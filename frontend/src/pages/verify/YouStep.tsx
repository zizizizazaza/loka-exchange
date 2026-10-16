import { useCallback, useState } from 'react';

import { useDemo } from '../../demo/state';
import { errorText, useKybActions } from '../../kyb/actions';
import { type Applicant, setKyb, useKyb } from '../../kyb/store';
import { fmtD } from '../../lib/format';
import { Aside } from './Aside';
import { IdCheckDialog } from './IdCheckDialog';
import { Todo } from './Todo';

const ID_TEXT: Record<Applicant['id'], [string, string]> = {
  none: ['Passport or ID card, then a selfie', 'About 3 minutes. The selfie is taken on a phone: on a computer you scan a code.'],
  checking: ['ID check started', 'Finish it in the verification window. You can reopen it here.'],
  verified: ['ID verified', 'Document, selfie and liveness matched'],
  review: ['ID check done', 'Some details need a closer look. A reviewer checks them after you submit; you can continue.'],
  failed: ['ID check not passed', 'Use a valid passport or ID card in good light, with the whole document in the frame.'],
};

/**
 * Step 2: the person applying, who acts and signs for the company. Their ID comes first: the provider reads the
 * name, birth date and nationality from it, so they are not typed (and cannot be changed afterwards). The only
 * ID-and-selfie check in the flow, done in the page (an embedded DocuPass session).
 */
export function YouStep() {
  const kyb = useKyb();
  const { toast, email } = useDemo();
  const a = kyb.applicant;
  const fromId = kyb.fromId;
  const actions = useKybActions();
  const [session, setSession] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const set = (k: keyof Applicant) => (e: { target: { value: string } }) =>
    setKyb((s) => ({ ...s, applicant: { ...s.applicant, [k]: e.target.value } }));
  const passed = a.id === 'verified' || a.id === 'review';
  const todo =
    a.id === 'checking'
      ? 'finish the ID check'
      : a.id === 'failed'
        ? 'try the ID check again'
        : !passed
          ? 'verify your ID'
          : !a.name.trim()
            ? 'enter your full legal name'
            : !a.dob
              ? 'enter your date of birth'
              : !a.nationality.trim()
                ? 'enter your nationality'
                : !a.title.trim()
                  ? 'enter your job title'
                  : null;

  const verify = async () => {
    setStarting(true);
    try {
      const url = await actions.startIdCheck();
      if (url) setSession(url);
      else toast('ID verified (demo)');
    } catch (e) {
      toast(errorText(e));
    } finally {
      setStarting(false);
    }
  };
  const closeSession = useCallback(() => setSession(null), []);

  return (
    <div className="dbody">
      <div className="panel">
        <form className="apf" noValidate onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Your ID</legend>
            <p className="kintro">
              You apply and sign for the company. Start with your passport or ID card: we read your name, date of birth and
              nationality from it.
            </p>
            <div className={a.id === 'verified' ? 'kid ok' : a.id === 'failed' ? 'kid bad' : 'kid'}>
              <i className={passed ? 'ph-fill ph-seal-check' : 'ph-light ph-identification-card'}></i>
              <span>
                <b>{ID_TEXT[a.id][0]}</b>
                <small>{starting && !actions.live ? 'Waiting for the verification provider…' : ID_TEXT[a.id][1]}</small>
              </span>
              {passed ? null : (
                <button className="btn btn-ghost btn-sm" type="button" disabled={starting} onClick={verify}>
                  {starting ? 'Opening…' : a.id === 'checking' ? 'Continue verification' : a.id === 'failed' ? 'Try again' : 'Verify my ID'}
                </button>
              )}
            </div>
          </fieldset>

          {passed ? (
            <fieldset>
              <legend>About you</legend>
              <p className="kintro">
                Name, date of birth and nationality come from your ID. Contact us if anything is wrong.
                {email ? ` Updates go to ${email}.` : ''}
              </p>
              <div className="row2">
                <IdField id="k-you" label="Full legal name" value={a.name} locked={!!fromId?.name} onChange={set('name')} />
                <IdField
                  id="k-dob"
                  label="Date of birth"
                  type="date"
                  value={a.dob}
                  shown={a.dob ? fmtD(a.dob) : ''}
                  locked={!!fromId?.dob}
                  onChange={set('dob')}
                />
              </div>
              <div className="row2">
                <IdField
                  id="k-nat"
                  label="Nationality"
                  value={a.nationality}
                  locked={!!fromId?.nationality}
                  onChange={set('nationality')}
                />
                <div className="field">
                  <label htmlFor="k-title">Job title</label>
                  <input id="k-title" placeholder="e.g. Chief Financial Officer" value={a.title} onChange={set('title')} />
                </div>
              </div>
              <div className="row2">
                <div className="field">
                  <label htmlFor="k-own">
                    Your share of the company <em>if any</em>
                  </label>
                  <input
                    id="k-own"
                    inputMode="decimal"
                    placeholder="0"
                    value={a.ownership}
                    onChange={(e) =>
                      setKyb((s) => ({ ...s, applicant: { ...s.applicant, ownership: e.target.value.replace(/[^\d.]/g, '') } }))
                    }
                  />
                </div>
                <div className="field">
                  <label>Director</label>
                  <label className="inv-ck kck">
                    <input
                      type="checkbox"
                      checked={a.director}
                      onChange={(e) => setKyb((s) => ({ ...s, applicant: { ...s.applicant, director: e.target.checked } }))}
                    />
                    <span>I am a director of the company</span>
                  </label>
                </div>
              </div>
            </fieldset>
          ) : null}

          <div className="kacts">
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => actions.go('company').catch((e) => toast(errorText(e)))}>
              Back
            </button>
            <Todo text={todo} />
            <div className="r">
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={!!todo}
                onClick={() => actions.go('owners').catch((e) => toast(errorText(e)))}
              >
                Continue
              </button>
            </div>
          </div>
        </form>
      </div>
      <Aside />
      {session ? <IdCheckDialog url={session} onPoll={actions.pollIdCheck} onClose={closeSession} /> : null}
    </div>
  );
}

/** A detail read from the ID: shown read-only; typed only when the ID did not show it. */
function IdField(props: {
  id: string;
  label: string;
  value: string;
  locked: boolean;
  type?: string;
  shown?: string;
  onChange: (e: { target: { value: string } }) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>
        {props.label} <em>{props.locked ? 'from your ID' : 'not shown on your ID'}</em>
      </label>
      {props.locked ? (
        <input id={props.id} readOnly value={props.shown || props.value} />
      ) : (
        <input id={props.id} type={props.type} value={props.value} onChange={props.onChange} />
      )}
    </div>
  );
}
