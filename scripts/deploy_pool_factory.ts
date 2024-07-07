import { ethers, upgrades, network } from "hardhat";
import { CHAINID } from "../constants";

let UPGRADEABLE_PROXY;

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

async function upgradeProxy() {
  if (chainId == CHAINID.ARBITRUM_MAINNET) {
    UPGRADEABLE_PROXY = "0x7274463BF93E0058481042Cbd6e0cc73042E6285";
  } else if (chainId == CHAINID.BASE_MAINNET) {
    UPGRADEABLE_PROXY = "0x45dC73fB760f2382Cfd11e28C0Dd0a3A8d3E4C31";
  } else if (chainId == CHAINID.ETH_MAINNET) {
  } else {
    console.log("Not deployed contract to %s", chainId);
    process.exit(1);
  }

  // Get the contract factory
  const PoolFactory = await ethers.getContractFactory("PoolFactory");

  let upgrade = await upgrades.upgradeProxy(UPGRADEABLE_PROXY, PoolFactory);

  console.log("PoolFactory Proxy deployed to:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log("PoolFactory implementation address: %s", implementationAddress);
}

async function deployProxy() {
  // Get the contract factory
  const PoolFactory = await ethers.getContractFactory("PoolFactory");

  // Deploy the contract using the proxy pattern
  const poolFactory = await upgrades.deployProxy(PoolFactory, [], {
    initializer: "initialize",
  });
  await poolFactory.waitForDeployment();

  console.log("PoolFactory deployed to:", await poolFactory.getAddress());
}

async function main() {
  await deployProxy();
  // await upgradeProxy();
}

// Execute the main function and catch any errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
