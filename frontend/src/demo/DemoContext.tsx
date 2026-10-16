import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { num } from '../lib/format';
import { primaryWallet, useSession } from '../session/useSession';
import { INITIAL_BAL, INITIAL_NEW, isOpen, ME, type NewIssue } from './data';
import { type Access, ACCS, DemoCtx, type DemoState } from './state';

/** The "view as" switcher is a development tool; production always shows the real session. */
const SHOW_SWITCHER = import.meta.env.DEV;

const SESSION_ERRORS: Record<string, string> = {
  EMAIL_IN_USE: 'This email already has an account. Sign out and sign in the way you did before.',
};

/** Development preview: ?view=, then the last choice; none means the live session. */
function initialPreview(): Access | null {
  if (!SHOW_SWITCHER) return null;
  const q = new URLSearchParams(location.search).get('view') as Access | null;
  if (q && ACCS.includes(q)) return q;
  try {
    const v = localStorage.getItem('loka-view') as Access | null;
    if (v && ACCS.includes(v)) return v;
  } catch {
    // Storage blocked: no preview.
  }
  return null;
}

/** Holds the page state; read it with useDemo() from ./state. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const [preview, setPreviewState] = useState<Access | null>(initialPreview);
  const [bal, setBalState] = useState(INITIAL_BAL);
  const [issues, setIssues] = useState<NewIssue[]>(() => INITIAL_NEW.map((n) => ({ ...n, cd: [...n.cd] })));
  const [toastText, setToastText] = useState('');
  const [toastShown, setToastShown] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [depositDir, setDepositDir] = useState<'mint' | 'redeem'>('mint');
  const [depositNet, setDepositNet] = useState('Ethereum');
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((t: string) => {
    setToastText(t);
    setToastShown(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastShown(false), 2600);
  }, []);

  const setPreview = useCallback((a: Access | null) => {
    setPreviewState(a);
    try {
      if (a) localStorage.setItem('loka-view', a);
      else localStorage.removeItem('loka-view');
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  }, []);

  // Sign in and out through Privy. "Signed in" is shown once the backend session is ready, as the prototype does.
  const { login, logout, profile, error, loading, authenticated } = session;
  const awaitingSignIn = useRef(false);
  const signIn = useCallback(() => {
    awaitingSignIn.current = true;
    login();
  }, [login]);
  const signOut = useCallback(() => {
    void logout().then(() => toast('Signed out'));
  }, [logout, toast]);

  useEffect(() => {
    if (profile && awaitingSignIn.current) {
      awaitingSignIn.current = false;
      toast('Signed in');
    }
  }, [profile, toast]);

  // Shown in the toast bar for as long as it lasts (see Layout).
  const sessionError = error ? (SESSION_ERRORS[error.code] ?? 'Sign-in failed. Please try again.') : null;

  const liveTier = loading ? 'public' : session.tier;
  const access: Access = preview ?? liveTier;
  const wallet = authenticated ? primaryWallet(profile) : preview && preview !== 'public' ? ME : null;
  const wallets = useMemo(
    () =>
      authenticated && profile
        ? profile.wallets.map(({ address, kind, delegated }) => ({ address, kind, delegated }))
        : preview && preview !== 'public'
          ? [{ address: ME, kind: 'EXTERNAL' as const, delegated: false }]
          : [],
    [authenticated, profile, preview],
  );
  const email = authenticated ? (profile?.user.email ?? null) : null;

  const setBal = useCallback((f: (b: number) => number) => setBalState(f), []);

  const subscribe = useCallback((sym: string, a: number) => {
    setBalState((b) => b - a);
    setIssues((list) =>
      list.map((n) => {
        if (n.sym !== sym) return n;
        const sub = Math.min(1, n.sub + a / n.amt);
        const full = sub >= 1;
        return {
          ...n,
          mine: n.mine + a,
          sub,
          full: full ? '2026-10-12' : n.full,
          cd: full ? ['2026-10-12', ...n.cd.slice(1)] : n.cd,
        };
      }),
    );
  }, []);

  const withdraw = useCallback(
    (sym: string) => {
      const n = issues.find((x) => x.sym === sym);
      if (!n || !n.mine || !isOpen(n)) return;
      setBalState((b) => b + n.mine);
      setIssues((list) =>
        list.map((x) => (x.sym === sym ? { ...x, sub: Math.max(0, x.sub - x.mine / x.amt), mine: 0 } : x)),
      );
      toast(`Withdrew ${num(n.mine)} AIUSD from ${n.sym} escrow (demo)`);
    },
    [issues, toast],
  );

  const value = useMemo<DemoState>(
    () => ({
      access,
      ok: access === 'verified',
      loading: !preview && loading,
      signedIn: authenticated,
      wallet,
      wallets,
      email,
      signIn,
      signOut,
      preview,
      setPreview,
      showSwitcher: SHOW_SWITCHER,
      sessionError: preview ? null : sessionError,
      bal,
      setBal,
      issues,
      subscribe,
      withdraw,
      toastText,
      toastShown,
      toast,
      gateOpen,
      openGate: () => setGateOpen(true),
      closeGate: () => setGateOpen(false),
      depositDir,
      setDepositDir,
      depositNet,
      setDepositNet,
    }),
    [
      access,
      preview,
      loading,
      authenticated,
      wallet,
      wallets,
      email,
      signIn,
      signOut,
      setPreview,
      sessionError,
      bal,
      setBal,
      issues,
      subscribe,
      withdraw,
      toastText,
      toastShown,
      toast,
      gateOpen,
      depositDir,
      depositNet,
    ],
  );

  return <DemoCtx.Provider value={value}>{children}</DemoCtx.Provider>;
}
