import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

// Optimizer on in both profiles so tests run against bytecode close to what gets deployed
// (LoanEscrow is ~24.5 KB unoptimized, right at the 24 KB limit).
// evmVersion pinned to cancun: BSC and every target chain support it, including the transient storage
// used by the reentrancy guards. The compiler default (osaka) may emit opcodes those chains lack.
const settings = {
  evmVersion: "cancun",
  optimizer: {
    enabled: true,
    runs: 200,
  },
};

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: { version: "0.8.34", settings },
      production: { version: "0.8.34", settings },
    },
  },
  networks: {
    // `localhost` (http://127.0.0.1:8545, started with `npx hardhat node`) is built in.
    // BSC testnet, chain id 97. Set the RPC URL and key with `npx hardhat keystore set`.
    bscTestnet: {
      type: "http",
      chainType: "l1",
      chainId: 97,
      url: configVariable("BSC_TESTNET_RPC_URL"),
      accounts: [configVariable("BSC_TESTNET_PRIVATE_KEY")],
    },
  },
});
