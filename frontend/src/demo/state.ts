import { createContext, useContext } from 'react';

import type { NewIssue } from './data';

/**
 * Page state shared by the exchange app. The provider is in DemoContext.tsx.
 *
 * Who the viewer is comes from the real session: Privy login plus the backend's KYB status (GET /api/me).
 * In development the prototype's "view as" switcher can preview the other states on top of it.
 * The AIUSD balance and the new issues are still the prototype's sample data, changed by subscribing and withdrawing.
 */
export type Access = 'public' | 'unverified' | 'pending' | 'verified';
export const ACCS: Access[] = ['public', 'unverified', 'pending', 'verified'];

export interface DemoState {
  /** Effective access tier: the preview if one is set, otherwise the real session. */
  access: Access;
  ok: boolean;
  /** Privy or the backend session is still loading; the header stays empty meanwhile. */
  loading: boolean;
  /** Signed in with Privy. */
  signedIn: boolean;
  /** The signed-in user's wallet (embedded for email and Google users); the sample address while previewing. */
  wallet: string | null;
  /** All the user's Ethereum wallets from Privy, for choosing the investing address. */
  wallets: { address: string; kind: 'EXTERNAL' | 'EMBEDDED'; delegated: boolean }[];
  /** The signed-in user's email (email or Google sign-in). */
  email: string | null;
  signIn: () => void;
  signOut: () => void;
  /** Development only: preview another access tier; null = live session. */
  preview: Access | null;
  setPreview: (a: Access | null) => void;
  showSwitcher: boolean;
  /** Set when the backend refused the session (e.g. EMAIL_IN_USE); the header then only offers sign-out. */
  sessionError: string | null;
  bal: number;
  setBal: (f: (b: number) => number) => void;
  issues: NewIssue[];
  subscribe: (sym: string, amount: number) => void;
  withdraw: (sym: string) => void;
  toastText: string;
  toastShown: boolean;
  toast: (t: string) => void;
  gateOpen: boolean;
  openGate: () => void;
  closeGate: () => void;
  /** Deposit page direction and network, kept across visits as in the prototype. */
  depositDir: 'mint' | 'redeem';
  setDepositDir: (d: 'mint' | 'redeem') => void;
  depositNet: string;
  setDepositNet: (n: string) => void;
}

export const DemoCtx = createContext<DemoState | null>(null);

export function useDemo() {
  const v = useContext(DemoCtx);
  if (!v) throw new Error('useDemo outside DemoProvider');
  return v;
}
