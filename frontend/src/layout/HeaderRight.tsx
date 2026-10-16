import { Link } from 'react-router';

import { useDemo } from '../demo/state';
import { useGateClick } from '../demo/useGateClick';
import { num, short } from '../lib/format';

/**
 * Right side of the header, one variant per access tier: the prototype's renderHead().
 * Sign in opens Privy; clicking the wallet address signs out (the prototype has no sign-out of its own).
 */
export function HeaderRight() {
  const { access, bal, loading, signedIn, wallet, signIn, signOut, sessionError } = useDemo();
  const onGate = useGateClick();
  if (loading) return null;

  if (sessionError) {
    return (
      <button className="btn btn-ghost btn-sm" type="button" onClick={signOut}>
        Sign out
      </button>
    );
  }

  const chip = wallet ? (
    signedIn ? (
      <button className="xwal" type="button" title="Sign out" onClick={signOut}>
        <span className="dot"></span>
        <span className="mono">{short(wallet)}</span>
      </button>
    ) : (
      <span className="xwal">
        <span className="dot"></span>
        <span className="mono">{short(wallet)}</span>
      </span>
    )
  ) : null;

  switch (access) {
    case 'public':
      return (
        <>
          <button className="btn btn-ghost btn-sm" type="button" onClick={signIn}>
            Sign in
          </button>
          <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
            Get access
          </button>
        </>
      );
    case 'unverified':
      return (
        <>
          <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
            Verify your business
          </button>
          {chip}
        </>
      );
    case 'pending':
      return (
        <>
          <span className="xpend">Verification in review</span>
          {chip}
        </>
      );
    case 'verified':
      return (
        <>
          <span className="xbal">
            <span className="ic">A</span>
            <b>{num(bal)}</b>
            <small>AIUSD</small>
          </span>
          <Link className="btn btn-primary btn-sm" to="/deposit">
            Deposit
          </Link>
          {chip}
        </>
      );
  }
}
