// Note: Should update priceConsumerAddress and redeploy camelotSwapContract before deploy the vault in next release
const { ethers, network, upgrades } = require("hardhat");

import {
  CHAINID,
  GOEFR_ADDRESS,
  GOEFS_ADDRESS,
  POOL_SOLV_WBTC,
  SOLV_ADDRESS,
  WBTC_ADDRESS,
} from "../constants";
import * as Contracts from "../typechain-types";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const admin = "0x75bE1a23160B1b930D4231257A83e1ac317153c8";
const UPGRADEABLE_PROXY = "0x9d95527A298c68526Ad5227fe241B75329D3b91F";
const wbtcAddress = WBTC_ADDRESS[chainId] || "";
const tokenGOEFSAddress = GOEFS_ADDRESS[chainId] || "";
const tokenGOEFRAddress = GOEFR_ADDRESS[chainId] || "";
const solvAddress = SOLV_ADDRESS[chainId] || "";
const poolId = POOL_SOLV_WBTC[chainId] || "";
let solvVault: Contracts.SolvVault;

async function deploySolvVault() {
  const solvVaultFactory = await ethers.getContractFactory("SolvVault");

  solvVault = await upgrades.deployProxy(
    solvVaultFactory,
    [
      admin,
      solvAddress,
      wbtcAddress,
      tokenGOEFSAddress,
      tokenGOEFRAddress,
      poolId,
      8,
      BigInt(1 * 1e5),
      BigInt(10000 * 1e8),
    ],
    { initializer: "initialize" }
  );

  await solvVault.waitForDeployment();

  console.log(
    "deploy solvVault successfully: %s",
    await solvVault.getAddress()
  );
}

async function upgradeProxy() {
  const upgradeContract = await ethers.getContractFactory(
    "SolvVault"
  );
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    upgradeContract
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log(
    "SolvVault implementation address: %s",
    implementationAddress
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await upgradeProxy();
  // MAINNET
  // await deploySolvVault();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
