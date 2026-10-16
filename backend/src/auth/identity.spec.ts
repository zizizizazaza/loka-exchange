import type { User } from '@privy-io/node';

import { toIdentity } from './identity.js';

const user = (linked: unknown[]) =>
  ({ id: 'did:privy:abc', created_at: 0, has_accepted_terms: true, is_guest: false, linked_accounts: linked, mfa_methods: [] }) as unknown as User;

describe('toIdentity', () => {
  it('reads the email and Ethereum wallets, lowercasing addresses', () => {
    const identity = toIdentity(
      user([
        { type: 'email', address: 'ops@northwind.example' },
        { type: 'wallet', chain_type: 'ethereum', address: '0xAbC0000000000000000000000000000000000001', wallet_client_type: 'metamask', connector_type: 'injected' },
        { type: 'wallet', chain_type: 'ethereum', address: '0xDEF0000000000000000000000000000000000002', wallet_client_type: 'privy', connector_type: 'embedded', delegated: false },
      ]),
    );
    expect(identity).toEqual({
      privyDid: 'did:privy:abc',
      email: 'ops@northwind.example',
      wallets: [
        { address: '0xabc0000000000000000000000000000000000001', kind: 'EXTERNAL', delegated: false },
        { address: '0xdef0000000000000000000000000000000000002', kind: 'EMBEDDED', delegated: false },
      ],
    });
  });

  it('flags embedded wallets delegated to the app server', () => {
    const identity = toIdentity(
      user([{ type: 'wallet', chain_type: 'ethereum', address: '0x0000000000000000000000000000000000000003', wallet_client_type: 'privy', connector_type: 'embedded', delegated: true }]),
    );
    expect(identity.wallets[0]).toMatchObject({ kind: 'EMBEDDED', delegated: true });
  });

  it('ignores non-Ethereum wallets and smart wallets', () => {
    const identity = toIdentity(
      user([
        { type: 'wallet', chain_type: 'solana', address: 'So1anaAddress' },
        { type: 'smart_wallet', address: '0x0000000000000000000000000000000000000004' },
      ]),
    );
    expect(identity).toEqual({ privyDid: 'did:privy:abc', email: null, wallets: [] });
  });

  it('takes the email from a Google sign-in when there is no email sign-in', () => {
    expect(toIdentity(user([{ type: 'google_oauth', email: 'pm@northwind.example', subject: '1' }])).email).toBe(
      'pm@northwind.example',
    );
    expect(
      toIdentity(
        user([
          { type: 'google_oauth', email: 'personal@gmail.com', subject: '1' },
          { type: 'email', address: 'work@northwind.example' },
        ]),
      ).email,
    ).toBe('work@northwind.example');
  });
});
