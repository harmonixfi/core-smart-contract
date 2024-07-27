const { ethers } = require("hardhat");
import axios from "axios";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  KYBER_SWAP_ROUTER_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  USDT_IMPERSONATED_SIGNER_ADDRESS,
  USDT_ADDRESS,
  WETH_IMPERSONATED_SIGNER_ADDRESS,
  DAI_ADDRESS,
  DAI_IMPERSONATED_SIGNER_ADDRESS
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
   
   const priceImpact = (routeSummary.amountOutUsd - routeSummary.amountInUsd) / routeSummary.amountInUsd;
   console.log("priceImpact ", priceImpact);
   const requestBody = {
       routeSummary,
       sender,
       recipient,
       slippageTolerance: 10 //0.1%
   }
   response = await axios.post('https://aggregator-api.kyberswap.com/arbitrum/api/v1/route/build', requestBody);
   console.log("routeSummary ", routeSummary);
   return response.data.data.data;
}

describe("Kyber swap aggregator test", function () {
  let admin: Signer;
  let USDC: Contracts.IERC20;
  let WETH: Contracts.IERC20;
  let USDT: Contracts.IERC20;
  let DAI: Contracts.IERC20;

  let priceConsumerContract: Contracts.PriceConsumer;

  const usdcAddress = USDC_ADDRESS[chainId] || '';
  const usdtAddress = USDT_ADDRESS[chainId] || '';
  const daiAddress = DAI_ADDRESS[chainId] || '';
  const wethAddress = WETH_ADDRESS[chainId] || '';
  const kyberSwapAggregatorAddress = KYBER_SWAP_ROUTER_ADDRESS[chainId] || '';
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId];
  const usdtImpersonatedSigner = USDT_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const daiImpersonatedSigner = DAI_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const ethImpersonatedSigner = WETH_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  
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
    contract = await factory.deploy(kyberSwapAggregatorAddress, await priceConsumerContract.getAddress());
    await contract.waitForDeployment();

    console.log("Deployed kyberSwapAggregatorAddress contract at address %s", await contract.getAddress());
  }

  before(async function () {
    USDC = await ethers.getContractAt("IERC20", usdcAddress);
    WETH = await ethers.getContractAt("IERC20", wethAddress);
    USDT = await ethers.getContractAt("IERC20", usdtAddress);
    DAI = await ethers.getContractAt("IERC20", daiAddress);
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

  it.skip("swap 0.1 weth to usdc", async function () {
    console.log("-------------swap 0.1 eth to usdc---------------");

    const ethSigner = await ethers.getImpersonatedSigner(ethImpersonatedSigner);
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

  it("swap 100 usdt to usdc", async function () {
    console.log("-------------swap 100 usdt to usdc---------------");

    const usdtSigner = await ethers.getImpersonatedSigner(usdtImpersonatedSigner);
    await USDT.connect(usdtSigner).approve(await contract.getAddress(), BigInt(100*1e6));

    const sellAmount = BigInt(100 * 1e6);
    console.log('usdt before swap: ', await USDT.balanceOf(usdtSigner));
    console.log('usdc before swap: ', await USDC.balanceOf(usdtSigner));

    const quote = await getExactInputQuote(usdtAddress, usdcAddress, sellAmount, await usdtSigner.getAddress(), await usdtSigner.getAddress());
    const swapTx = await contract.connect(usdtSigner).swapTo(await usdtSigner.getAddress(), usdtAddress, sellAmount, usdcAddress, quote);
    await swapTx.wait();

    console.log('usdt after swap: ', await USDT.balanceOf(usdtSigner));
    console.log('usdc after swap: ', await USDC.balanceOf(usdtSigner));
  }).timeout(1000000);

  it.skip("swap 100 dai to usdc", async function () {
    console.log("-------------swap 100 usdt to usdc---------------");

    const daiSigner = await ethers.getImpersonatedSigner(daiImpersonatedSigner);
    await DAI.connect(daiSigner).approve(await contract.getAddress(), BigInt(100*1e18));

    const sellAmount = BigInt(100 * 1e18);
    console.log('dai before swap: ', await DAI.balanceOf(daiSigner));
    console.log('usdc before swap: ', await USDC.balanceOf(daiSigner));

    const quote = await getExactInputQuote(daiAddress, usdcAddress, sellAmount, await daiSigner.getAddress(), await daiSigner.getAddress());
    const swapTx = await contract.connect(daiSigner).swapTo(await daiSigner.getAddress(), daiAddress, sellAmount, usdcAddress, quote);
    await swapTx.wait();

    console.log('dai after swap: ', await DAI.balanceOf(daiSigner));
    console.log('usdc after swap: ', await USDC.balanceOf(daiSigner));
  }).timeout(1000000);
});
