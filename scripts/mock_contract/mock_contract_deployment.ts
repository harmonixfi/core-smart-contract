import { ethers, upgrades, network } from "hardhat";
import { CHAINID } from "../../constants";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

let contractAdmin;

let UPGRADEABLE_PROXY;

async function deployMockDeltaNeutralVault() {
  const mockDeltaNeutralVaultFactory = await ethers.getContractFactory(
    "MockDeltaNeutralSmartContract"
  );

  const mockDNVault = await upgrades.deployProxy(
    mockDeltaNeutralVaultFactory,
    [],
    { initializer: "initialize" }
  );

  await mockDNVault.waitForDeployment();

  console.log(
    "deploy kelpRestakingDNVault proxy successfully: %s",
    await mockDNVault.getAddress()
  );

  // Print the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    await mockDNVault.getAddress()
  );
  console.log(
    "KelpRestakingDNVault implementation address: %s",
    implementationAddress
  );
}

async function upgradeProxy() {
  const mockDeltaNeutralVaultFactory = await ethers.getContractFactory(
    "MockDeltaNeutralSmartContract"
  );
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    mockDeltaNeutralVaultFactory
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log(
    "MockDeltaNeutralSmartContract implementation address: %s",
    implementationAddress
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await deployMockDeltaNeutralVault();
  // await upgradeProxy();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
