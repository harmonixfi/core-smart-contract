import { ethers, network } from "hardhat";
import { expect } from "chai";
import { Contract, Signer } from "ethers";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  AEVO_ADDRESS,
  AEVO_CONNECTOR_ADDRESS,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDT_IMPERSONATED_SIGNER_ADDRESS,
  DAI_IMPERSONATED_SIGNER_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  DAI_PRICE_FEED_ADDRESS,
  RSETH_ETH_PRICE_FEED_ADDRESS,
  RSETH_ADDRESS,
  ZIRCUIT_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_ADDRESS,
  KELP_DEPOSIT_REF_ID,
  NETWORK_COST,
} from "../../constants";

const chainId: CHAINID = network.config.chainId || 0;
console.log("chainId ", chainId);

let aevoRecipientAddress: string;

describe("PoolFactory", function () {
  this.timeout(120000);
  let poolFactory: Contracts.PoolFactory;

  let admin: Signer, user1: Signer, user2: Signer, user3: Signer, user4: Signer;

  let kelpRestakingDNVault: Contracts.KelpRestakingDeltaNeutralVault;
  let usdc: Contracts.IERC20;
  let usdt: Contracts.IERC20;
  let dai: Contracts.IERC20;

  const usdcImpersonatedSigner =
    USDC_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const usdtImpersonatedSigner =
    USDT_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const daiImpersonatedSigner = DAI_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const daiAddress = DAI_ADDRESS[chainId] || "";
  const wethAddress = WETH_ADDRESS[chainId] || "";
  const rsEthAddress = RSETH_ADDRESS[chainId] || "";
  const swapRouterAddress = UNISWAP_ROUTER_ADDRESS[chainId] || "";
  const aevoAddress = AEVO_ADDRESS[chainId] || "";
  const aevoConnectorAddress = AEVO_CONNECTOR_ADDRESS[chainId] || "";
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId] || "";
  const rsEth_EthPriceFeed = RSETH_ETH_PRICE_FEED_ADDRESS[chainId] || "";
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId] || "";
  const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId] || "";
  const kelpDepositAddress = KELP_DEPOSIT_ADDRESS[chainId] || "";
  const kelpDepositRefId = KELP_DEPOSIT_REF_ID[chainId] || "";
  const zircuitDepositAddress = ZIRCUIT_DEPOSIT_ADDRESS[chainId] || "";
  const networkCost = BigInt(Number(NETWORK_COST[chainId]) * 1e6);

  let priceConsumerContract: Contracts.PriceConsumer;
  let uniSwapContract: Contracts.UniSwap;

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");

    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, rsEthAddress, usdtAddress, daiAddress],
      [usdcAddress, wethAddress, usdcAddress, usdtAddress],
      [ethPriceFeed, rsEth_EthPriceFeed, usdtPriceFeed, daiPriceFeed]
    );
    await priceConsumerContract.waitForDeployment();

    console.log(
      "Deployed price consumer contract at address %s",
      await priceConsumerContract.getAddress()
    );
  }

  async function deployUniSwapContract() {
    const factory = await ethers.getContractFactory("UniSwap");
    uniSwapContract = await factory.deploy(
      admin,
      swapRouterAddress,
      priceConsumerContract.getAddress(),
      chainId
    );
    await uniSwapContract.waitForDeployment();

    console.log(
      "Deployed uni swap contract at address %s",
      await uniSwapContract.getAddress()
    );
  }

  async function deployKelpRestakingDeltaNeutralVault() {
    const kelpRestakingDeltaNeutralVault = await ethers.getContractFactory(
      "KelpRestakingDeltaNeutralVault"
    );

    kelpRestakingDNVault = await upgrades.deployProxy(
      kelpRestakingDeltaNeutralVault,
      [
        await admin.getAddress(),
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
        await uniSwapContract.getAddress(),
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
  }

  before(async function () {
    [admin, user1, user2] = await ethers.getSigners();
    aevoRecipientAddress = await user2.getAddress();

    await deployPriceConsumerContract();
    await deployUniSwapContract();
    await deployKelpRestakingDeltaNeutralVault();

    const PoolFactoryFactory = await ethers.getContractFactory("PoolFactory");
    poolFactory = await upgrades.deployProxy(PoolFactoryFactory, [], {
      initializer: "initialize",
    });
    await poolFactory.waitForDeployment();
  });

  it("should allow admin to register and remove vaults", async function () {
    await poolFactory
      .connect(admin)
      .registerVault(await kelpRestakingDNVault.getAddress());
  });

  it("should correctly sum the TVL of all registered vaults", async function () {
    const totalTVL = await poolFactory.getVaultsTVL();
    expect(totalTVL).to.equal(0);
  });

  it("should update TVL correctly after vault removal", async function () {
    await poolFactory.removeVault(await kelpRestakingDNVault.getAddress());
  });
});
