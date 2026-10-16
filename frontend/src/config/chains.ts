import { bscTestnet, hardhat } from 'viem/chains';

/** Local Hardhat node for development, BSC testnet for demos. Mainnet is not decided yet. */
const CHAINS = { local: hardhat, bscTestnet } as const;

const selected = import.meta.env.VITE_CHAIN as keyof typeof CHAINS | undefined;
if (selected && !(selected in CHAINS)) throw new Error(`Unknown VITE_CHAIN "${selected}"`);

export const appChain = CHAINS[selected ?? 'local'];
