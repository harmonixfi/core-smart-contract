const { ethers } = require("hardhat");
import axios from "axios";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  KYBER_SWAP_AGGREGATOR_ADDRESS,
  ETH_PRICE_FEED_ADDRESS
} from "../../constants";
import { network } from "hardhat";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId as CHAINID;
console.log("chainId", chainId);

async function getExactInputQuote(tokenIn: string, tokenOut: string, amountIn: BigInt, sender: string, recipient: string) {
    const params = {
        tokenIn,
        tokenOut,
        amountIn,
        gasInclude: true
    };
        
   let response = await axios.get('https://aggregator-api.kyberswap.com/arbitrum/api/v1/routes', { params });
   const routeSummary = response.data.data.routeSummary;

   const requestBody = {
       routeSummary,
       sender,
       recipient,
       slippageTolerance: 10 //0.1%
   }
   response = await axios.post('https://aggregator-api.kyberswap.com/arbitrum/api/v1/route/build', requestBody);
   return response.data.data.data;
}

describe("Kyber swap aggregator test", function () {
  let admin: Signer;
  let USDC: Contracts.IERC20;
  let WETH: Contracts.IERC20;
  let priceConsumerContract: Contracts.PriceConsumer;

  const usdcAddress = USDC_ADDRESS[chainId] || '';
  const wethAddress = WETH_ADDRESS[chainId] || '';
  const kyberSwapAggregatorAddress = KYBER_SWAP_AGGREGATOR_ADDRESS[chainId] || '';
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  
  let contract: Contracts.KyberSwapAggregator;

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");

    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress],
      [usdcAddress],
      [ethPriceFeed]
    );

    await priceConsumerContract.waitForDeployment();

    console.log(
      "Deployed price consumer contract at address %s",
      await priceConsumerContract.getAddress()
    );
  }

  async function deployKyberSwapContract() {
    const factory = await ethers.getContractFactory("KyberSwapAggregator");
    contract = await factory.deploy(admin, kyberSwapAggregatorAddress, await priceConsumerContract.getAddress());
    await contract.waitForDeployment();

    console.log("Deployed kyberSwapAggregatorAddress contract at address %s", await contract.getAddress());
  }

  beforeEach(async function () {
    USDC = await ethers.getContractAt("IERC20", usdcAddress);
    WETH = await ethers.getContractAt("IERC20", wethAddress);
    [admin] = await ethers.getSigners();

    await deployPriceConsumerContract();
    await deployKyberSwapContract();
  });

  it("get token price", async function () {
    console.log("-------------get weth_usd price feed---------------");
    const getEth_UsdPrice = await contract
      .connect(admin)
      .getPriceOf(WETH, USDC);
      console.log('1 WETH = %s USDC', getEth_UsdPrice);
  
    console.log("-------------get usd_eth price feed---------------");
    const getUsd_EthPrice = await contract
      .connect(admin)
      .getPriceOf(USDC, WETH);
      console.log('1 USDC = %s WETH', getUsd_EthPrice);
});

  it("swap 0.1 weth to usdc", async function () {
    console.log("-------------swap 0.1 eth to usdc---------------");

    const ethSigner = await ethers.getImpersonatedSigner("0xC3E5607Cd4ca0D5Fe51e09B60Ed97a0Ae6F874dd");
    await WETH.connect(ethSigner).approve(await contract.getAddress(), BigInt(0.1*1e18));

    const sellAmount = BigInt(0.1 * 1e18);
    console.log('eth before swap: ', await WETH.balanceOf(ethSigner));
    console.log('usdc before swap: ', await USDC.balanceOf(ethSigner));

    const quote = await getExactInputQuote(wethAddress, usdcAddress, sellAmount, await ethSigner.getAddress(), await ethSigner.getAddress());
    const swapTx = await contract.connect(ethSigner).swapTo(await ethSigner.getAddress(), wethAddress, sellAmount, usdcAddress, quote);
    await swapTx.wait();

    console.log('eth after swap: ', await WETH.balanceOf(ethSigner));
    console.log('usdc after swap: ', await USDC.balanceOf(ethSigner));
  }).timeout(1000000);
});
