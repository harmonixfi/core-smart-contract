const { ethers, network, upgrades } = require("hardhat");
import { BalanceContract } from "../../../typechain-types";
import { CHAINID } from "../../../constants";
import { enableUsingBigBlocks } from "../hyperliquid_deploy_helper";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

let balanceContract: BalanceContract;
let deployer: Signer;

//mainnet
const UPGRADEABLE_PROXY = "";
const contractAdmin = "0xa3e2e81079bf3d4f708be4c6a6897e82749424c6";
const contractOperator = "0x8588b843109d247a88e2ad4c07acc3f2153c889b";
const contractApprover = "0x4d2ca3b2323af0e3f20704363e671e5cce8df03c";

async function deployBalanceContract() {
  const balanceContractFactory =
    await ethers.getContractFactory("BalanceContract");

  balanceContract = await upgrades.deployProxy(
    balanceContractFactory,
    [contractAdmin, contractOperator, contractApprover],
    {
      initializer: "initialize",
    }
  );

  await balanceContract.waitForDeployment();

  console.log(
    "deploy balanceContract proxy successfully: %s",
    await balanceContract.getAddress()
  );
}

async function upgradeProxy() {
  const balanceContractFactory =
    await ethers.getContractFactory("BalanceContract");
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    balanceContractFactory
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log(
    "balanceContract implementation address: %s",
    implementationAddress
  );
}

async function main() {
  [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await enableUsingBigBlocks(deployer, true);
  await deployBalanceContract();
  // await upgradeProxy();
  await enableUsingBigBlocks(deployer, false);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
