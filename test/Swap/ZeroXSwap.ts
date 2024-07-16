const { ethers } = require("hardhat");
import axios from "axios";

import * as Contracts from "../../typechain-types";
import {
  CHAINID,
  WETH_ADDRESS,
  USDC_ADDRESS,
  // ZEROXSWAP_EXCHANGE_ADDRESS
} from "../../constants";
import { network } from "hardhat";
import {
  Signer,
} from "ethers";

const chainId: CHAINID = network.config.chainId as CHAINID;
console.log("chainId", chainId);

async function getExactInputQuote(sellToken: string, buyToken: string, sellAmount: BigInt, takerAddress: string) {
    const params = {
        sellToken,
        buyToken,
        sellAmount
    };

    const headers = {
        '0x-api-key': '5cc7f2db-cb7c-4ce0-a09a-bad639ac4e15',
      };

    const response = await axios.get('https://api.0x.org/swap/v1/quote', { params, headers });
    return response;
}

async function getExactOutputQuote(sellToken: string, buyToken: string, buyAmount: BigInt, takerAddress: string) {
    const params = {
        sellToken,
        buyToken,
        buyAmount,
        takerAddress
    };

    const response = await axios.get('https://arbitrum.api.0x.org/swap/v1/quote', { params });
    return response;
}

describe("ZeroXSwap", function () {
  let admin: Signer;
  let USDC: Contracts.IERC20;
  let WETH: Contracts.IERC20;

  const usdcAddress = USDC_ADDRESS[chainId] || '';
  const wethAddress = WETH_ADDRESS[chainId] || '';
  // const zeroXSwapAddress = ZEROXSWAP_EXCHANGE_ADDRESS[chainId] || '';

  let zeroXSwapContract: Contracts.ZeroXSwap;

  async function deployZeroXSapContract() {
    const factory = await ethers.getContractFactory("ZeroXSwap");
    zeroXSwapContract = await factory.deploy(zeroXSwapAddress);
    await zeroXSwapContract.waitForDeployment();

    console.log("Deployed zeroXSwap contract at address %s", await zeroXSwapContract.getAddress());
  }

  beforeEach(async function () {
    [admin] = await ethers.getSigners();
    USDC = await ethers.getContractAt("IERC20", usdcAddress);
    WETH = await ethers.getContractAt("IERC20", wethAddress);

    // await deployZeroXSapContract();
  });

  it("get token price", async function () {
    console.log("-----------------get token price------------------");
    const params = {
        sellToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        buyToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
        sellAmount: '100000000000000000000',
        taker: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        chainId: 1
    };
        const headers = {
        '0x-api-key': '29c1a8d2-488b-4fa5-8870-413cf31401a6',
        };
        try {
        const response = await axios.get('https://api.0x.org/swap/permit2/price', {
        params,
        headers,
        });
        console.log(response.data);
        } catch (error) {
        console.error('Error:', error);
        }
  });

  it.skip("swap 1 weth to usdc", async function () {
    console.log("-------------swap 0.1 eth to usdc---------------");
    const sellAmount = BigInt(0.1 * 1e18);

    const quote = await getExactInputQuote(wethAddress, usdcAddress, sellAmount, wethAddress);
    console.log(quote);
    // const swapTx = zeroXSwapContract.swapTo(wethAddress, usdcAddress, sellAmount, quote.data);
  });

  it.skip("swap usdc to 1 weth", async function () {
    console.log("-------------swap usdc to 1 weth---------------");
    const buyAmount = BigInt(0.1 * 1e18);

    const quote = await getExactOutputQuote(usdcAddress, wethAddress, buyAmount, await zeroXSwapContract.getAddress());
    const swapTx = zeroXSwapContract.swapToWithOutput(usdcAddress, wethAddress, buyAmount, quote.data);
  });
});
