const { ethers, network, upgrades } = require("hardhat");
import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  USDC_ADDRESS,
  PY_YT_LP_ORACLE,
  RSETH_ADDRESS,
  WETH_ADDRESS,
  PENDLE_ALL_ACTION_V3,
  KYBER_SWAP_AGGREGATOR_ADDRESS,
} from "../../constants";

const chainId: CHAINID = network.config.chainId;
console.log("chainId ", chainId);

let aevoRecipientAddress: string;
let pendleHedgeVault: Contracts.PendleHedgeVault;
const pyYtLpOracle = PY_YT_LP_ORACLE[chainId] || "";
const usdcAddress = USDC_ADDRESS[chainId] || "";
const rsEthAddress = RSETH_ADDRESS[chainId] || "";
let hmKyberSwapAggregator = KYBER_SWAP_AGGREGATOR_ADDRESS[chainId] || "";
const iPAllActionV3 = PENDLE_ALL_ACTION_V3[chainId] || "";
const wethAddress = WETH_ADDRESS[chainId] || "";

const admin = "0xea065ed6E86f6b6a9468ae26366616AB2f5d4F21";

// testnet
// aevoRecipientAddress = "0xF4aF6504462E5D574EDBdB161F1063633CCa0274";

// // main
aevoRecipientAddress = "0x86886957347be9dAb7e65EaC54cd7A7AB548F8e1";

// main
// PT rsETH 26 Sep 2024
// const PT_RSETH_ADDRESS = "0x30c98c0139b62290e26ac2a2158ac341dcaf1333";
// const RS_ETH_MARKET = "0xed99fc8bdb8e9e7b8240f62f69609a125a0fbf14";
// const PT_OLD_ADDRESS = "0x2ccfce9be49465cc6f947b5f6ac9383673733da9";

// PT rsETH 26 Dec 2024
const PT_RSETH_ADDRESS = "0x355ec27c9d4530de01a103fa27f884a2f3da65ef";
const RS_ETH_MARKET = "0xcb471665bf23b2ac6196d84d947490fd5571215f";
const PT_OLD_ADDRESS = "0x30c98c0139b62290e26ac2a2158ac341dcaf1333";

// trader
aevoRecipientAddress = "0x243937d8c75fd743741de1621c6c10abe579f4d2";

async function deployPendleHedgeVault() {
  const pendleVaultFactory =
    await ethers.getContractFactory("PendleHedgeVault");
  pendleHedgeVault = await upgrades.deployProxy(
    pendleVaultFactory,
    [
      admin,
      pyYtLpOracle,
      iPAllActionV3,
      RS_ETH_MARKET,
      hmKyberSwapAggregator,
      usdcAddress,
      rsEthAddress,
      PT_RSETH_ADDRESS,
      wethAddress,
      18,
      BigInt(0.01 * 1e18), //eth 1e18
      BigInt(1000000 * 1e6),
      BigInt(1.1 * 1e6),
      aevoRecipientAddress,
      BigInt(1 * 1e6),
      PT_OLD_ADDRESS,
    ],
    { initializer: "initialize" }
  );
  await pendleHedgeVault.waitForDeployment();

  console.log(
    "deploy pendleHedgeVault proxy successfully: %s",
    await pendleHedgeVault.getAddress()
  );
}

// const UPGRADEABLE_PROXY = "0xC5d824572E20BB73DE991dC31b9802Fcb0A64D1b";
// testnet
// const UPGRADEABLE_PROXY = "0xC0Fa1d8b8651FD8Ed8a3DD33CC0b090614cb50Ee";

// mainnet
const UPGRADEABLE_PROXY = "0x561B080120f67ef6dE911421BFFfa2cc909979FC";

async function upgradeProxy() {
  const pendleHedgingVault =
    await ethers.getContractFactory("PendleHedgeVault");
  console.log("Upgrading V1Contract...");
  let upgrade = await upgrades.upgradeProxy(
    UPGRADEABLE_PROXY,
    pendleHedgingVault
  );
  console.log("V1 Upgraded to V2");
  console.log("V2 Contract Deployed To:", await upgrade.getAddress());

  // Print the implementation address
  const implementationAddress =
    await upgrades.erc1967.getImplementationAddress(UPGRADEABLE_PROXY);
  console.log(
    "Pendle Hedging implementation address: %s",
    implementationAddress
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  // MAINNET
  await deployPendleHedgeVault();
  // await upgradeProxy();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
