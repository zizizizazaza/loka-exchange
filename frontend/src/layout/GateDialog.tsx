import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useDemo } from '../demo/state';

/** "Open to verified institutions" dialog, the prototype's openGate(). */
export function GateDialog() {
  const { gateOpen, closeGate, access, signIn, toast } = useDemo();
  const navigate = useNavigate();
  // Verification opens inside the app the dialog was opened from (the v7 pages have their own frame).
  const verify = useLocation().pathname.startsWith('/v7') ? '/v7/verify' : '/verify';
  const ref = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (gateOpen && !d.open) {
      setEmail('');
      d.showModal();
    }
    if (!gateOpen && d.open) d.close();
  }, [gateOpen]);

  const inst =
    access === 'public'
      ? {
          p: 'Sign in, then verify your company. We check the business, its owners and who can sign for it.',
          b: 'Sign in to start',
          go: signIn,
        }
      : access === 'unverified'
        ? {
            p: 'About 15 minutes to submit. Review usually takes 2 to 5 business days (sample).',
            b: 'Start verification',
            go: () => navigate(verify),
          }
        : {
            p: 'Your documents are in review. You will get an email when your account is approved.',
            b: 'View status',
            go: () => navigate(verify),
          };

  const notify = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      emailRef.current?.focus();
      toast('Enter an email address');
      return;
    }
    closeGate();
    toast('Prototype: nothing was sent');
  };

  return (
    <dialog
      className="gate"
      ref={ref}
      aria-labelledby="gateT"
      onClose={closeGate}
      onClick={(e) => {
        if (e.target === ref.current) closeGate();
      }}
    >
      <div className="gate-h">
        <div>
          <h3 id="gateT">Open to verified institutions</h3>
          <p>
            Interest rates, full terms, documents and lending are open to institutional lenders after business
            verification. Everything else on Loka Capital is public.
          </p>
        </div>
        <button className="gate-x" type="button" aria-label="Close" onClick={closeGate}>
          <i className="ph ph-x"></i>
        </button>
      </div>
      <div className="gate-o">
        <div>
          <b>I lend for an institution</b>
          <p>{inst.p}</p>
          <ol>
            <li>Company details and registration</li>
            <li>Beneficial owners and authorized signers</li>
            <li>Withdrawal address controlled by the company</li>
          </ol>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => {
              closeGate();
              inst.go();
            }}
          >
            {inst.b}
          </button>
        </div>
        <div>
          <b>I am an individual</b>
          <p>Individual lending is not open in this phase. Leave an email and we will tell you when it opens in your region.</p>
          <label htmlFor="gEmail">Email</label>
          <input
            id="gEmail"
            ref={emailRef}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn-ghost btn-sm" type="button" onClick={notify}>
            Notify me
          </button>
        </div>
      </div>
    </dialog>
  );
}
