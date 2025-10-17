const { ethers, network, upgrades } = require("hardhat");
import { FundStorage } from "../../../typechain-types";
import { CHAINID } from "../../../constants";
import { enableUsingBigBlocks } from "../hyperliquid_deploy_helper";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

let fundStorage: FundStorage;
let deployer: Signer;

//mainnet
const UPGRADEABLE_PROXY = "";
const contractAdmin = "0xa3e2e81079bf3d4f708be4c6a6897e82749424c6";


async function deployFundStorageContract() {
  const fundStorageFactory = await ethers.getContractFactory("FundStorage");
  fundStorage = await upgrades.deployProxy(
    fundStorageFactory,
    [contractAdmin],
    {
      initializer: "initialize",
    }
  );

  await fundStorage.waitForDeployment();

  console.log(
    "deploy fundStorage proxy successfully: %s",
    await fundStorage.getAddress()
  );
}

async function upgradeProxy() {
  const fundStorageFactory = await ethers.getContractFactory("FundStorage");
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    fundStorageFactory
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log("fundStorage implementation address: %s", implementationAddress);
}

async function main() {
  [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await enableUsingBigBlocks(deployer, true);
  await deployFundStorageContract();
  // await upgradeProxy();
  await enableUsingBigBlocks(deployer, false);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
