import { ethers, upgrades, network } from "hardhat";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  RSETH_ADDRESS,
  ZIRCUIT_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_REF_ID,
  UNI_SWAP_ADDRESS,
  AddressZero,
} from "../../constants";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const usdcAddress = USDC_ADDRESS[chainId] || AddressZero;
const usdtAddress = USDT_ADDRESS[chainId] || AddressZero;
const daiAddress = DAI_ADDRESS[chainId] || AddressZero;
const wethAddress = WETH_ADDRESS[chainId] || AddressZero;
const rsEthAddress = RSETH_ADDRESS[chainId] || AddressZero;
const uniSwapAddress = UNI_SWAP_ADDRESS[chainId] || AddressZero;
const aevoAddress = AEVO_ADDRESS[chainId] || AddressZero;
const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] || AddressZero;
const kelpDepositAddress = KELP_DEPOSIT_ADDRESS[chainId] || AddressZero;
const kelpDepositRefId = KELP_DEPOSIT_REF_ID[chainId] || AddressZero;
const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId] || AddressZero;

let contractAdmin;

let UPGRADEABLE_PROXY;
let aevoRecipientAddress;

if (chainId == CHAINID.ARBITRUM_MAINNET) {
  console.log("Setting up params for Arbitrum network");
  // mainnet
  contractAdmin = "0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D";
  UPGRADEABLE_PROXY = "";
  aevoRecipientAddress = "0x0F8C856907DfAFB96871AbE09a76586311632ef8";
} else if (chainId == CHAINID.ETH_MAINNET) {
  console.log("Setting up params for Ether network");
  // mainnet
  contractAdmin = "0x470e1d28639B1bd5624c85235eeF29624A597E68";
  UPGRADEABLE_PROXY = "";
  aevoRecipientAddress = "0x9d95DC7c1Aa6F6CC784edD5690C003692470d616";
}

async function deployKelpRestakingDeltaNeutralVault() {
  const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
    "KelpRestakingDeltaNeutralVault"
  );

  const kelpRestakingDNVault = await upgrades.deployProxy(
    kelpRestakingDeltaNeutralVault,
    [
      contractAdmin,
      usdcAddress,
      6,
      BigInt(5 * 1e6),
      BigInt(1000000 * 1e6),
      BigInt(1 * 1e6),
      wethAddress,
      aevoAddress,
      aevoRecipientAddress,
      aevoConnectorAddress,
      rsEthAddress,
      BigInt(1 * 1e6),
      [kelpDepositAddress, zircuitDepositAddress],
      kelpDepositRefId,
      uniSwapAddress,
      [usdcAddress, rsEthAddress, usdtAddress, daiAddress],
      [wethAddress, wethAddress, usdcAddress, usdtAddress],
      [500, 100, 100, 100],
      chainId,
    ],
    { initializer: "initialize" }
  );

  await kelpRestakingDNVault.waitForDeployment();

  console.log(
    "deploy kelpRestakingDNVault proxy successfully: %s",
    await kelpRestakingDNVault.getAddress()
  );

  // Print the implementation address
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(
    await kelpRestakingDNVault.getAddress()
  );
  console.log(
    "KelpRestakingDNVault implementation address: %s",
    implementationAddress
  );
}

async function upgradeProxy() {
  const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
    "KelpRestakingDeltaNeutralVault"
  );
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    kelpRestakingDeltaNeutralVault
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log(
    "KelpRestakingDNVault implementation address: %s",
    implementationAddress
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await deployKelpRestakingDeltaNeutralVault();
  // await upgradeProxy();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
