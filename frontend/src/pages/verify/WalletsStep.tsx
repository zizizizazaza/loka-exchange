import { useDemo } from '../../demo/state';
import { errorText, useKybActions } from '../../kyb/actions';
import { isAddress, setKyb, useKyb } from '../../kyb/store';
import { short } from '../../lib/format';
import { Aside } from './Aside';
import { Todo } from './Todo';

/**
 * Step 3: the lending address(es), chosen from the user's own wallets, and the company's withdrawal address.
 * Embedded wallets delegated to an app server are refused (docs/wallets-and-permissions.md).
 */
export function WalletsStep() {
  const kyb = useKyb();
  const { wallets, toast } = useDemo();
  const actions = useKybActions();
  const toggle = (address: string) =>
    setKyb((s) => ({
      ...s,
      wallets: s.wallets.includes(address) ? s.wallets.filter((w) => w !== address) : [...s.wallets, address],
    }));
  const treasuryOk = isAddress(kyb.treasury);
  const todo = !kyb.wallets.length
    ? 'choose a lending address'
    : !kyb.treasury
      ? 'enter the withdrawal address'
      : !treasuryOk
        ? 'correct the withdrawal address'
        : null;

  return (
    <div className="dbody">
      <div className="panel kstep">
        <h2>Addresses</h2>
        <p>
          Choose the wallet you will lend from. Once you are verified it is whitelisted, so it can hold AIUSD and
          lend. Withdrawals only go to an address the company controls.
        </p>

        <div className="field">
          <label>Lending address</label>
          <div className="kwal">
            {wallets.length ? (
              wallets.map((w) => (
                <label key={w.address} className={w.delegated ? 'off' : ''}>
                  <input
                    type="checkbox"
                    checked={kyb.wallets.includes(w.address)}
                    disabled={w.delegated}
                    onChange={() => toggle(w.address)}
                  />
                  <span>
                    <span className="mono">{short(w.address)}</span>
                    <small>
                      {w.kind === 'EMBEDDED' ? 'Wallet created at sign-in, controlled by you' : 'Your connected wallet'}
                      {w.delegated ? ' · signing is delegated to an app, cannot be used' : ''}
                    </small>
                  </span>
                  <span className="sig">{w.kind === 'EMBEDDED' ? 'Embedded' : 'External'}</span>
                </label>
              ))
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                No wallet found. Sign in again to create one.
              </p>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="k-treasury">
            Withdrawal address <em>controlled by the company</em>
          </label>
          <input
            id="k-treasury"
            className="mono"
            placeholder="0x…"
            value={kyb.treasury}
            onChange={(e) => setKyb((s) => ({ ...s, treasury: e.target.value.trim() }))}
          />
        </div>
        {kyb.treasury && !treasuryOk ? <p className="kerr">Enter a 0x address with 40 hexadecimal characters.</p> : null}
        <p className="note-line" style={{ margin: '0 0 0' }}>
          After approval you register it on-chain from your wallet. New withdrawal addresses can be used 24 hours after
          they are registered.
        </p>

        <div className="kacts">
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => actions.go('owners').catch((e) => toast(errorText(e)))}>
            Back
          </button>
          <Todo text={todo} />
          <div className="r">
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={!!todo}
              onClick={() => actions.go('review').catch((e) => toast(errorText(e)))}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
      <Aside />
    </div>
  );
}
