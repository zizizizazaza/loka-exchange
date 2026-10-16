// Deploys the core system: Guardian, Registry, AIUSD gateway (with AIUSD), the three loan implementations and
// the loan factory. Writes the addresses to deployments/<network>.json.
//
//   npx hardhat run scripts/deploy.ts --network localhost
//   npx hardhat run scripts/deploy.ts --network bscTestnet
//
// Optional environment variables:
//   MULTISIG    operations multisig (a Safe). Defaults to the deployer, which is only acceptable on test networks.
//   COMPLIANCE  compliance key that whitelists investors. Defaults to the deployer.
//   USDC        existing 6-decimal USDC. Defaults to deploying MockUSDC.
import { mkdirSync, writeFileSync } from "node:fs";
import { getAddress, type Address } from "viem";
import { network } from "hardhat";

const { viem, networkName } = await network.getOrCreate();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();
const me = deployer.account.address;

const env = (name: string): Address | undefined => (process.env[name] ? getAddress(process.env[name]!) : undefined);
const multisig = env("MULTISIG") ?? me;
const compliance = env("COMPLIANCE") ?? me;

const wait = async (hash: Promise<`0x${string}`>) => publicClient.waitForTransactionReceipt({ hash: await hash });

console.log(`Deploying to ${networkName} from ${me}`);

let usdc = env("USDC");
if (!usdc) {
  usdc = (await viem.deployContract("MockUSDC")).address;
  console.log(`MockUSDC        ${usdc}`);
}

const guardian = await viem.deployContract("Guardian", [multisig]);
const registry = await viem.deployContract("Registry", [guardian.address, compliance]);
const gateway = await viem.deployContract("AIUSDGateway", [usdc, registry.address, guardian.address]);
const aiusd = await gateway.read.aiusdToken();
const escrowImpl = await viem.deployContract("LoanEscrow");
const vaultImpl = await viem.deployContract("CollectionVault");
const sharesImpl = await viem.deployContract("LoanShares");
const factory = await viem.deployContract("LoanFactory", [
  registry.address,
  gateway.address,
  guardian.address,
  escrowImpl.address,
  vaultImpl.address,
  sharesImpl.address,
]);

if (multisig === me) {
  await wait(gateway.write.setFactory([factory.address]));
} else {
  console.log(`\nNext, from the Safe ${multisig}: call AIUSDGateway(${gateway.address}).setFactory(${factory.address})`);
}

const deployment = {
  network: networkName,
  chainId: await publicClient.getChainId(),
  deployedAt: new Date().toISOString(),
  multisig,
  compliance,
  contracts: {
    USDC: usdc,
    AIUSD: aiusd,
    Guardian: guardian.address,
    Registry: registry.address,
    AIUSDGateway: gateway.address,
    LoanFactory: factory.address,
    LoanEscrowImplementation: escrowImpl.address,
    CollectionVaultImplementation: vaultImpl.address,
    LoanSharesImplementation: sharesImpl.address,
  },
};

mkdirSync("deployments", { recursive: true });
writeFileSync(`deployments/${networkName}.json`, JSON.stringify(deployment, null, 2) + "\n");
console.table(deployment.contracts);
console.log(`Saved deployments/${networkName}.json`);
