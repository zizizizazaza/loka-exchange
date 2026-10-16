import type { LinkedAccount, User } from '@privy-io/node';

export type WalletKind = 'EXTERNAL' | 'EMBEDDED';

export interface IdentityWallet {
  /** Lowercase 0x address. */
  address: string;
  kind: WalletKind;
  /** Embedded wallet whose signing rights were delegated to the app's server. */
  delegated: boolean;
}

/** What the backend needs from a verified Privy identity token. */
export interface PrivyIdentity {
  privyDid: string;
  email: string | null;
  wallets: IdentityWallet[];
}

/**
 * Reduces a Privy user to the email and the Ethereum wallets we care about.
 * Solana, Bitcoin and Privy smart wallets are ignored: the contracts are EVM-only and we do not use smart wallets.
 */
export function toIdentity(user: User): PrivyIdentity {
  return { privyDid: user.id, email: emailOf(user.linked_accounts), wallets: walletsOf(user.linked_accounts) };
}

/** Email sign-in first; otherwise the address of a Google sign-in. Lowercased so lookups match. */
function emailOf(accounts: LinkedAccount[]): string | null {
  for (const a of accounts) if (a.type === 'email') return a.address.toLowerCase();
  for (const a of accounts) if (a.type === 'google_oauth') return a.email.toLowerCase();
  return null;
}

function walletsOf(accounts: LinkedAccount[]): IdentityWallet[] {
  const wallets: IdentityWallet[] = [];
  for (const account of accounts) {
    const wallet = ethereumWallet(account);
    if (wallet && !wallets.some((w) => w.address === wallet.address)) wallets.push(wallet);
  }
  return wallets;
}

function ethereumWallet(account: LinkedAccount): IdentityWallet | null {
  if (account.type !== 'wallet' || account.chain_type !== 'ethereum') return null;
  const embedded = account.wallet_client_type === 'privy' || account.connector_type === 'embedded';
  return {
    address: account.address.toLowerCase(),
    kind: embedded ? 'EMBEDDED' : 'EXTERNAL',
    delegated: 'delegated' in account && account.delegated === true,
  };
}
