import { hx, short } from '../lib/format';
import { useDemo } from './state';
import { useGateClick } from './useGateClick';

// Small pieces shared by the pages, one per prototype helper (txl, lockv, gateBtn, lockStat, gatebox, docBtns).

/** Sample transaction or contract link. */
export function TxLink({ seed }: { seed: string }) {
  const h = hx(seed);
  return (
    <a className="txlink" href="#" onClick={(e) => e.preventDefault()} title={h}>
      {short(h)}
      <i className="ph-light ph-arrow-up-right"></i>
    </a>
  );
}

export function LockV({ text = 'Verified investors' }: { text?: string }) {
  return (
    <span className="lockv">
      <i className="ph ph-lock-simple"></i>
      {text}
    </span>
  );
}

export function GateBtn() {
  const { access } = useDemo();
  const onGate = useGateClick();
  const label = { public: 'Get access', unverified: 'Verify to see terms', pending: 'Verification in review' }[
    access as 'public' | 'unverified' | 'pending'
  ];
  return (
    <button className="btn btn-primary btn-sm" type="button" onClick={onGate}>
      {label}
    </button>
  );
}

export function LockStat({ title }: { title: string }) {
  const onGate = useGateClick();
  return (
    <div className="y">
      <span>{title}</span>
      <b className="lockb">
        <i className="ph ph-lock-simple"></i>Verified investors
      </b>
      <em>
        <button type="button" onClick={onGate}>
          See who can invest
        </button>
      </em>
    </div>
  );
}

export function GateBox({ title, items }: { title: string; items: string[] }) {
  const { access } = useDemo();
  return (
    <div className="gatebox">
      <div>
        <h4>{title}</h4>
        <p>
          {access === 'pending'
            ? 'Your business verification is in review. These open as soon as it is approved.'
            : 'Shown to verified institutional investors. Collateral, coverage, repayments and the on-chain record stay open to everyone.'}
        </p>
        <ul>
          {items.map((x) => (
            <li key={x}>
              <i className="ph ph-lock-simple"></i>
              {x}
            </li>
          ))}
        </ul>
      </div>
      {access === 'pending' ? <span className="xpend">In review</span> : <GateBtn />}
    </div>
  );
}

export function DocButtons({ docs }: { docs: [string, string][] }) {
  const { ok, toast } = useDemo();
  const onGate = useGateClick();
  return (
    <>
      {docs.map(([t, f]) =>
        ok ? (
          <button key={t} type="button" className="doc" onClick={() => toast('Download (demo)')}>
            <i className="ph-light ph-file-text"></i>
            <span>
              <b>{t}</b>
              <small>{f} · hash on-chain</small>
            </span>
            <i className="ph-light ph-download-simple"></i>
          </button>
        ) : (
          <button key={t} type="button" className="doc locked" onClick={onGate}>
            <i className="ph-light ph-file-text"></i>
            <span>
              <b>{t}</b>
              <small>{f} · verified investors</small>
            </span>
            <i className="ph-light ph-lock-simple"></i>
          </button>
        ),
      )}
    </>
  );
}
