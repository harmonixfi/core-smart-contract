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
  KYBER_SWAP_ROUTER_ADDRESS,
} from "../../constants";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 42161;
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
const swapRouterAddress = KYBER_SWAP_ROUTER_ADDRESS[chainId] || AddressZero;

let contractAdmin: string;
let UPGRADEABLE_PROXY: string;
let aevoRecipientAddress: string;
let deployer: Signer;
if (chainId == CHAINID.ARBITRUM_MAINNET) {
  console.log("Setting up params for Arbitrum network");
  // mainnet
  contractAdmin = "0x0d4eef21D898883a6bd1aE518B60fEf7A951ce4D";
  aevoRecipientAddress = "0x0F8C856907DfAFB96871AbE09a76586311632ef8";

  UPGRADEABLE_PROXY = "0x4a10C31b642866d3A3Df2268cEcD2c5B14600523";
} else if (chainId == CHAINID.ETH_MAINNET) {
  console.log("Setting up params for Ether network");
  // mainnet
  contractAdmin = "0x470e1d28639B1bd5624c85235eeF29624A597E68";
  UPGRADEABLE_PROXY = "";
  aevoRecipientAddress = "0x9d95DC7c1Aa6F6CC784edD5690C003692470d616";
}

// remove after finish test
UPGRADEABLE_PROXY = "0xCFbFc51A3da26eBab8E9DE77d0f33a06e9C4bc0F";
const kyberswapRouterAddress = "0x09873cAeaD90d60cD84C9543e0d5CD772C44cdF1";

async function updateSwapAggregatorAddress() {
  console.log("UPGRADEABLE_PROXY %s", UPGRADEABLE_PROXY);
  const proxy = await ethers.getContractAt("KelpRestakingDeltaNeutralVault", UPGRADEABLE_PROXY);

  const initiateV2Tx = await proxy
    .connect(deployer)
    .initializeV2(kyberswapRouterAddress, {
      gasLimit: 650000,
    });

  await initiateV2Tx.wait();
}

async function deployKelpRestakingDeltaNeutralVault() {
  const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
    "KelpRestakingDeltaNeutralVault"
  );

  const kelpRestakingDNVault = await upgrades.deployProxy(
    kelpRestakingDeltaNeutralVault,
    [
      await deployer.getAddress(),
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

  const gasLimit = 5000000;
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    kelpRestakingDeltaNeutralVault,
    { gasLimit }
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
  [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  // await deployKelpRestakingDeltaNeutralVault();
  // await upgradeProxy();
  await updateSwapAggregatorAddress();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
