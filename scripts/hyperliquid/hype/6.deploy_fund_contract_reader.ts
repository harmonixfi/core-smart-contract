const { ethers, network, upgrades } = require("hardhat");
import { FundContractReader } from "../../../typechain-types";
import { CHAINID } from "../../../constants";
import { enableUsingBigBlocks } from "../hyperliquid_deploy_helper";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

let fundContractReader: FundContractReader;
let deployer: Signer;

// testnet
// const UPGRADEABLE_PROXY = "0x179348034c7fa35d2d5a0149C17cEde52FbB22c6";
// const fundStorageContract = "0xBbB27658A1051a48CE6CED858C4cAEe4B35A8fB9";

// mainnet
const UPGRADEABLE_PROXY = "0xDe38eDE7D792Bb805971cc46D1A8F684E9d218FF";
const fundStorageContract = "0x933E97cA3F892411a4083D91Fa29D056FD65D270";
const vaultAddress = "0xFde5B0626fC80E36885e2fA9cD5ad9d7768D725c";

async function deployFundContractReaderContract() {
  const fundContractReaderFactory = await ethers.getContractFactory("FundContractReader");
  fundContractReader = await upgrades.deployProxy(
    fundContractReaderFactory,
    [fundStorageContract],
    {
      initializer: "initialize",
    }
  );

  await fundContractReader.waitForDeployment();

  console.log(
    "deploy fundContractReader proxy successfully: %s",
    await fundContractReader.getAddress()
  );
}


async function upgradeProxy() {
  const fundContractReaderFactory = await ethers.getContractFactory("FundContractReader");
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    fundContractReaderFactory
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log("fundContractReader implementation address: %s", implementationAddress);
}

async function runScript() { 
  const fundContractReader = await ethers.getContractAt("FundContractReader", UPGRADEABLE_PROXY);
  
  const pricePerShare = await fundContractReader.pricePerShare(vaultAddress);
  const highWatermark = await fundContractReader.highWatermark(vaultAddress);

  console.log("vault price per share: %s", pricePerShare);
  console.log("vault high watermark: %s", highWatermark);

  const performanceFeeAmount = await fundContractReader.getPerformanceFeeAmount(vaultAddress);
  console.log("performanceFeeAmount: %s", performanceFeeAmount);
}

async function main() {
  [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await enableUsingBigBlocks(deployer, true);
  // await deployFundContractReaderContract();
  // await upgradeProxy();
  await runScript();
  await enableUsingBigBlocks(deployer, false);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
