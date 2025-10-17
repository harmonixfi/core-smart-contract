const { ethers, network, upgrades } = require("hardhat");
import { FundContract } from "../../../typechain-types";
import { AddressZero, CHAINID, WHYPE_ADDRESS } from "../../../constants";
import { enableUsingBigBlocks } from "../hyperliquid_deploy_helper";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

let fundContract: FundContract;
let deployer: Signer;
const wHypeAddress = WHYPE_ADDRESS[chainId] || AddressZero;

// mainnet
const UPGRADEABLE_PROXY = "0xFde5B0626fC80E36885e2fA9cD5ad9d7768D725c";
const contractAdmin = "0xa3e2e81079bf3d4f708be4c6a6897e82749424c6";
const fundStorageContract = "0x933E97cA3F892411a4083D91Fa29D056FD65D270";
const balanceContract = "0x543303266113B64d03Ec17B7ec3829f8CddADaC4";
const fundNavContract = "0x9E780bf57beD1c7E7aDD2E0A618Fb4aEe3490dBA";
const bearingTokenName = "haHYPE";
const bearingTokenSymbol = "haHYPE";

const ADMIN_PRIVATE_KEY =
  process.env.HYPEREVM_DN_HYPE_V3_ADMIN_PRIVATE_KEY || "";

async function deployFundContract() {
  const fundContractFactory = await ethers.getContractFactory("FundContract");

  fundContract = await upgrades.deployProxy(
    fundContractFactory,
    [
      contractAdmin,
      wHypeAddress,
      fundStorageContract,
      balanceContract,
      fundNavContract,
      bearingTokenName,
      bearingTokenSymbol,
    ],
    {
      initializer: "initialize",
    }
  );

  await fundContract.waitForDeployment();
  console.log(
    "deploy fundContract proxy successfully: %s",
    await fundContract.getAddress()
  );
}

async function upgradeProxy() {
  const fundContractFactory = await ethers.getContractFactory("FundContract");
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    fundContractFactory
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log("fundContract implementation address: %s", implementationAddress);
}

async function main() {
  [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await enableUsingBigBlocks(deployer, true);
  // await deployFundContract();
  await upgradeProxy();
  await enableUsingBigBlocks(deployer, false);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
