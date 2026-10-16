import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { createConfig, WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { bscTestnet, hardhat } from 'viem/chains';

import { appChain } from './config/chains';

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID;
if (!privyAppId) throw new Error('VITE_PRIVY_APP_ID is not set; see frontend/.env.example');

const queryClient = new QueryClient();
// A transport for every chain the app can be built for; only appChain is active.
const wagmiConfig = createConfig({
  chains: [appChain],
  transports: { [hardhat.id]: http(), [bscTestnet.id]: http() },
});

/**
 * Login is email, Google or the user's own wallet. Email and Google users without a wallet get a Privy embedded
 * wallet, owned by them alone, and pay their own gas (backend/docs/wallets-and-permissions.md, section 2).
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: appChain,
        supportedChains: [appChain],
        appearance: { theme: 'light' },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
