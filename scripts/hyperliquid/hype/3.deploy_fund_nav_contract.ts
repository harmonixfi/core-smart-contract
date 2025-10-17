const { ethers, network, upgrades } = require("hardhat");
import { PerpDexFundNavContract } from "../../../typechain-types";
import { CHAINID } from "../../../constants";
import { enableUsingBigBlocks } from "../hyperliquid_deploy_helper";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

let fundNavContract: PerpDexFundNavContract;
let deployer: Signer;
// testnet
// const UPGRADEABLE_PROXY = "0x48E94D68fe260c13ACBe2356721d0884d9Ea9b82";
// const contractAdmin = "0xB53d2A2E935B4BD88Ddd748D6fe3170c78B2bA07";

// mainnet
const UPGRADEABLE_PROXY = "";
const contractAdmin = "0xa3e2e81079bf3d4f708be4c6a6897e82749424c6";

async function deployFundNavContract() {
  const fundNavFactory = await ethers.getContractFactory(
    "PerpDexFundNavContract"
  );

  fundNavContract = await upgrades.deployProxy(
    fundNavFactory,
    [contractAdmin],
    {
      initializer: "initialize",
    }
  );

  await fundNavContract.waitForDeployment();

  console.log(
    "deploy fundNavContract proxy successfully: %s",
    await fundNavContract.getAddress()
  );
}

async function upgradeProxy() {
  const fundNavFactory = await ethers.getContractFactory(
    "PerpDexFundNavContract"
  );
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, fundNavFactory);
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log(
    "fundNavContract implementation address: %s",
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
  await deployFundNavContract();
  // await upgradeProxy();
  await enableUsingBigBlocks(deployer, false);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
