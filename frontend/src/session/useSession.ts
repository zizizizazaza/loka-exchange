import { useIdentityToken, usePrivy } from '@privy-io/react-auth';
import { useQuery } from '@tanstack/react-query';

import type { AccessTier, ApiError, Profile } from './types';

/**
 * The signed-in user as the backend sees them.
 * After every Privy login (and whenever the identity token changes, e.g. a wallet was linked) the profile is
 * synced through POST /api/auth/session, which needs both Privy tokens.
 */
export function useSession() {
  const { ready, authenticated, login, logout, getAccessToken } = usePrivy();
  const { identityToken } = useIdentityToken();

  const session = useQuery<Profile, ApiError>({
    queryKey: ['session', identityToken],
    enabled: ready && authenticated && Boolean(identityToken),
    retry: false,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'privy-id-token': identityToken! },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw { status: res.status, code: body.code ?? 'UNKNOWN', message: body.message ?? res.statusText };
      return body as Profile;
    },
  });

  const loading = !ready || (authenticated && (!identityToken || session.isPending));
  const tier: AccessTier = authenticated && session.data ? session.data.accessTier : 'public';

  return { loading, authenticated, tier, profile: session.data ?? null, error: session.error, login, logout };
}

/** The address shown in the header: the first wallet, which is the embedded one for email and Google users. */
export function primaryWallet(profile: Profile | null): string | null {
  return profile?.wallets[0]?.address ?? null;
}
