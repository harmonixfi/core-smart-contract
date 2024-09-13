const { ethers, network, upgrades } = require("hardhat");
import { expect } from "chai";
import * as Contracts from "../../typechain-types";
import axios from "axios";
import {
  CHAINID,
  USDC_ADDRESS,
  PY_YT_LP_ORACLE,
  USDC_IMPERSONATED_SIGNER_ADDRESS,
  USDT_ADDRESS,
  DAI_ADDRESS,
  WETH_ADDRESS,
  RSETH_ADDRESS,
  ETH_PRICE_FEED_ADDRESS,
  RSETH_ETH_PRICE_FEED_ADDRESS,
  USDT_PRICE_FEED_ADDRESS,
  DAI_PRICE_FEED_ADDRESS,
  PENDLE_ALL_ACTION_V3,
  RSETH_IMPERSONATED_SIGNER_ADDRESS,
} from "../../constants";
import { BigNumberish, Signer } from "ethers";

const PRECISION = 2 * 1e6;
const PT_RSETH_ADDRESS = "0x30c98c0139b62290e26ac2a2158ac341dcaf1333";
const RS_ETH_MARKET = "0xed99fc8bdb8e9e7b8240f62f69609a125a0fbf14";
const PT_OLD_ADDRESS = "0x2ccfce9be49465cc6f947b5f6ac9383673733da9";

const chainId: CHAINID = network.config.chainId;
console.log("chainId ", chainId);

let aevoRecipientAddress: string;

describe("Pendle Hedge Vault", function () {
  this.timeout(120000);

  let admin: Signer, user1: Signer, user2: Signer, user3: Signer;
  let usdc: Contracts.IERC20;
  let rsEth: Contracts.IERC20;
  let ptToken: Contracts.IERC20;
  let pendleHedgeVault: Contracts.PendleHedgeVault;
  let swapAggregatorContract: Contracts.KyberSwapAggregator;
  let priceConsumerContract: Contracts.PriceConsumer;

  const pyYtLpOracle = PY_YT_LP_ORACLE[chainId] || "";
  const usdcImpersonatedSigner =
    USDC_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const rsETHImpersonatedSigner =
    RSETH_IMPERSONATED_SIGNER_ADDRESS[chainId] || "";
  const usdcAddress = USDC_ADDRESS[chainId] || "";
  const usdtAddress = USDT_ADDRESS[chainId] || "";
  const daiAddress = DAI_ADDRESS[chainId] || "";
  const wethAddress = WETH_ADDRESS[chainId] || "";
  const rsEthAddress = RSETH_ADDRESS[chainId] || "";
  //const swapRouterAddress = KYBER_SWAP_AGGREGATOR_ADDRESS[chainId] || '';
  const swapRouterAddress = "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5";
  const usdtPriceFeed = USDT_PRICE_FEED_ADDRESS[chainId] || "";
  const daiPriceFeed = DAI_PRICE_FEED_ADDRESS[chainId] || "";
  const iPAllActionV3 = PENDLE_ALL_ACTION_V3[chainId] || "";
  const ethPriceFeed = ETH_PRICE_FEED_ADDRESS[chainId] || "";
  const rsEth_EthPriceFeed = RSETH_ETH_PRICE_FEED_ADDRESS[chainId] || "";

  async function deployPendleHedgeVault() {
    const pendleVaultFactory =
      await ethers.getContractFactory("PendleHedgeVault");
    pendleHedgeVault = await upgrades.deployProxy(
      pendleVaultFactory,
      [
        await admin.getAddress(),
        pyYtLpOracle,
        iPAllActionV3,
        RS_ETH_MARKET,
        await swapAggregatorContract.getAddress(),
        usdcAddress,
        rsEthAddress,
        PT_RSETH_ADDRESS,
        wethAddress,
        18,
        BigInt(0.01 * 1e18), //eth 1e18
        BigInt(1000000 * 1e6),
        BigInt(0.2 * 1e6),
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

  async function deployPriceConsumerContract() {
    const factory = await ethers.getContractFactory("PriceConsumer");

    priceConsumerContract = await factory.deploy(
      admin,
      [wethAddress, rsEthAddress, usdtAddress, daiAddress],
      [usdcAddress, wethAddress, usdcAddress, usdcAddress],
      [ethPriceFeed, rsEth_EthPriceFeed, usdtPriceFeed, daiPriceFeed]
    );
    await priceConsumerContract.waitForDeployment();

    console.log(
      "Deployed price consumer contract at address %s",
      await priceConsumerContract.getAddress()
    );
  }

  async function deploySwapAggregatorContract() {
    const factory = await ethers.getContractFactory("KyberSwapAggregator");
    swapAggregatorContract = await factory.deploy(
      swapRouterAddress,
      priceConsumerContract.getAddress()
    );
    await swapAggregatorContract.waitForDeployment();

    console.log(
      "Deployed swap aggregator contract at address %s",
      await swapAggregatorContract.getAddress()
    );
  }

  async function getExactInputQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumberish
  ) {
    const params = {
      tokenIn,
      tokenOut,
      amountIn,
      gasInclude: true,
    };

    let response = await axios.get(
      "https://aggregator-api.kyberswap.com/arbitrum/api/v1/routes",
      { params }
    );
    const routeSummary = response.data.data.routeSummary;
    const requestBody = {
      routeSummary,
      sender: await swapAggregatorContract.getAddress(),
      recipient: await swapAggregatorContract.getAddress(),
      slippageTolerance: 10, //0.1%
    };
    response = await axios.post(
      "https://aggregator-api.kyberswap.com/arbitrum/api/v1/route/build",
      requestBody
    );
    return response.data.data.data;
  }

  async function deposit(
    sender: Signer,
    ptAmount: BigNumberish,
    sctoken: Contracts.IERC20,
    scAmount: BigNumberish
  ) {
    await ptToken
      .connect(sender)
      .approve(await pendleHedgeVault.getAddress(), ptAmount);

    await sctoken
      .connect(sender)
      .approve(await pendleHedgeVault.getAddress(), scAmount);

    if ((await sctoken.getAddress()) != (await usdc.getAddress())) {
      const quote = await getExactInputQuote(
        await sctoken.getAddress(),
        usdcAddress,
        scAmount
      );
      await pendleHedgeVault
        .connect(sender)
        .deposit(PT_RSETH_ADDRESS, usdcAddress, ptAmount, scAmount, quote);
      return;
    }

    await pendleHedgeVault
      .connect(sender)
      .deposit(PT_RSETH_ADDRESS, usdcAddress, ptAmount, scAmount, "0x");
  }

  async function logAndReturnTotalValueLock() {
    const totalValueLocked = await pendleHedgeVault
      .connect(admin)
      .totalValueLocked();

    console.log("totalValueLocked %s", totalValueLocked);

    return totalValueLocked;
  }

  beforeEach(async () => {
    [admin, user1, user2, user3] = await ethers.getSigners();
    aevoRecipientAddress = await user3.getAddress();
    usdc = await ethers.getContractAt("IERC20", usdcAddress);
    ptToken = await ethers.getContractAt("IERC20", PT_RSETH_ADDRESS);
    rsEth = await ethers.getContractAt("IERC20", rsEthAddress);
    await deployPriceConsumerContract();
    await deploySwapAggregatorContract();
    await deployPendleHedgeVault();
    console.log("deployPendleHedgeVault");
  });

  async function transferForUser(
    token: Contracts.IERC20,
    from: Signer,
    to: Signer,
    amount: BigNumberish
  ) {
    const transferTx = await token
      .connect(from)
      .transfer(await to.getAddress(), amount);
    await transferTx.wait();
  }

  it("seed data", async function () {
    const usdcSigner = await ethers.getImpersonatedSigner(
      usdcImpersonatedSigner
    );

    const rsETHSigner = await ethers.getImpersonatedSigner(
      rsETHImpersonatedSigner
    );
    //transfer usdc
    await transferForUser(usdc, usdcSigner, user1, 100000 * 1e6);
    await transferForUser(usdc, usdcSigner, user2, 100000 * 1e6);
    await transferForUser(usdc, usdcSigner, user3, 100000 * 1e6);
    await transferForUser(usdc, usdcSigner, admin, 100000 * 1e6);

    const ptRsETHSigner = await ethers.getImpersonatedSigner(
      "0x78E552552f257Ea357DA81F264D327219A8d8000"
    );
    await transferForUser(ptToken, ptRsETHSigner, admin, BigInt(10 * 1e18));
    await transferForUser(ptToken, ptRsETHSigner, user1, BigInt(20 * 1e18));
  });

  it.skip("Estimate sc amount from pt amount - test unhappy", async () => {
    await expect(
      pendleHedgeVault.estimateScAmountFromPtAmount(BigInt(0))
    ).to.be.revertedWith("INVALID_AMOUNT");
  });

  it.skip("Estimate sc amount from pt amount - test happy", async () => {
    const estimateScAmount =
      await pendleHedgeVault.estimateScAmountFromPtAmount(BigInt(2 * 1e18));

    console.log("Estimate sc amount ", estimateScAmount);
  });

  it.skip("deposit - test unhappy", async () => {
    await expect(
      pendleHedgeVault
        .connect(admin)
        .deposit(
          PT_OLD_ADDRESS,
          usdcAddress,
          BigInt(1 * 1e16),
          BigInt(0),
          "0x1234"
        )
    ).to.be.revertedWith("INVALID_PT_ADDRESS");

    await expect(
      pendleHedgeVault
        .connect(admin)
        .deposit(
          PT_RSETH_ADDRESS,
          usdcAddress,
          BigInt(1 * 1e16),
          BigInt(0),
          "0x1234"
        )
    ).to.be.revertedWith("INVALID_PT_AMOUNT");

    await ptToken
      .connect(admin)
      .approve(await pendleHedgeVault.getAddress(), BigInt(5 * 1e16));
    await expect(
      pendleHedgeVault
        .connect(admin)
        .deposit(
          PT_RSETH_ADDRESS,
          usdcAddress,
          BigInt(5 * 1e16),
          BigInt(0),
          "0x1234"
        )
    ).to.be.revertedWith("INVALID_SC_AMOUNT");
  });

  it.skip("deposit - test happy", async () => {
    const ptAmount = BigInt(1e18);
    const estimateScAmount =
      await pendleHedgeVault.estimateScAmountFromPtAmount(ptAmount);

    await deposit(admin, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      estimateScAmount * BigInt(2),
      PRECISION
    );

    let userState = await pendleHedgeVault.getUserState();
    console.log(userState);
    expect(userState[0]).to.approximately(BigInt(1e18), PRECISION);
    expect(userState[1]).to.approximately(estimateScAmount, PRECISION);

    await deposit(admin, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));
    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      estimateScAmount * BigInt(4),
      PRECISION
    );

    userState = await pendleHedgeVault.getUserState();
    console.log(userState);
    expect(userState[0]).to.approximately(BigInt(2e18), PRECISION);
    expect(userState[1]).to.approximately(
      estimateScAmount + estimateScAmount,
      PRECISION
    );

    const pps = await pendleHedgeVault.pricePerShare();
    console.log("pps ", pps);
    expect(pps).to.approximately(BigInt(1e6), PRECISION);
  });

  it.skip("initiate force withdrawal - test", async () => {
    const estimateScAmount =
      await pendleHedgeVault.estimateScAmountFromPtAmount(BigInt(1 * 1e18));
    const estimateScAmountUser1 =
      await pendleHedgeVault.estimateScAmountFromPtAmount(BigInt(1 * 1e18));

    await deposit(admin, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));
    await deposit(user1, BigInt(1 * 1e18), usdc, BigInt(estimateScAmountUser1));

    await pendleHedgeVault.initiateForceWithdrawal();

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      (estimateScAmount + estimateScAmountUser1) * BigInt(2),
      PRECISION
    );

    let pps = await pendleHedgeVault.pricePerShare();
    console.log("pps ", pps);
    expect(pps).to.approximately(BigInt(1e6), PRECISION);

    const userWithdraw = await pendleHedgeVault.getUserWithdraw();
    console.log("userWithdraw ", userWithdraw);
    expect(userWithdraw[0]).to.approximately(
      estimateScAmount * BigInt(2),
      PRECISION
    );
    expect(userWithdraw[2]).to.approximately(BigInt(1 * 1e18), PRECISION);
    expect(userWithdraw[3]).to.approximately(estimateScAmount, PRECISION);
  });

  it.skip("complete force withdrawal - test", async () => {
    const estimateScAmount =
      await pendleHedgeVault.estimateScAmountFromPtAmount(BigInt(1 * 1e18));
    const estimateScAmountUser1 =
      await pendleHedgeVault.estimateScAmountFromPtAmount(BigInt(1 * 1e18));

    console.log("-----Deposit------");
    await deposit(admin, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));
    await deposit(user1, BigInt(1 * 1e18), usdc, BigInt(estimateScAmountUser1));

    let pps = await pendleHedgeVault.pricePerShare();
    console.log("pps ", pps);
    expect(pps).to.approximately(BigInt(1e6), PRECISION);

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      (estimateScAmount + estimateScAmountUser1) * BigInt(2),
      PRECISION
    );

    const balanceAdminAfter = await usdc
      .connect(admin)
      .balanceOf(admin.getAddress());
    console.log("Balance usdc admin before => ", balanceAdminAfter);

    console.log("-----initiateForceWithdrawal------");
    await pendleHedgeVault.initiateForceWithdrawal();

    let userWD = await pendleHedgeVault.getUserWithdraw();
    console.log("userWD ", userWD);

    console.log("-----acquireWithdrawalFunds------");
    await pendleHedgeVault.acquireWithdrawalFunds(
      BigInt(1 * 1e18),
      BigInt(estimateScAmount)
    );

    let withdrawPool = await pendleHedgeVault.getWithdrawPoolAmount();
    console.log("withdrawPool ", withdrawPool);

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      (estimateScAmount + estimateScAmountUser1) * BigInt(2),
      PRECISION
    );

    console.log("-----completeWithdrawal------");
    await pendleHedgeVault.completeWithdrawal();
    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      estimateScAmountUser1 * BigInt(2),
      PRECISION
    );
    const balanceAdminAfterForce = await usdc
      .connect(admin)
      .balanceOf(admin.getAddress());
    console.log(
      "Balance usdc admin balanceAdminAfterForce => ",
      balanceAdminAfterForce
    );

    userWD = await pendleHedgeVault.getUserWithdraw();
    console.log("userWD ", userWD);

    withdrawPool = await pendleHedgeVault.getWithdrawPoolAmount();
    console.log("withdrawPool ", withdrawPool);
  });

  it.skip("withdraw - timestamp > PT maturity data, should be pass", async () => {
    console.log("----------Deposit to vault----------");
    const ptAmount = BigInt(1e18);
    const estimateScAmount =
      await pendleHedgeVault.estimateScAmountFromPtAmount(ptAmount);

    await deposit(admin, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      estimateScAmount * BigInt(2),
      PRECISION
    );

    const increaseTime = 86400 * 100;
    await network.provider.send("evm_increaseTime", [increaseTime]);
    await network.provider.send("evm_mine");

    console.log("----------initial withdraw----------");
    await pendleHedgeVault.initiateWithdrawal();
    await logAndReturnTotalValueLock();

    console.log("----------acquire withdrawal funds----------");
    await pendleHedgeVault.acquireWithdrawalFunds(ptAmount, estimateScAmount);
    await logAndReturnTotalValueLock();

    console.log("----------complete withdrawal----------");
    await pendleHedgeVault.completeWithdrawal();
    await logAndReturnTotalValueLock();
  });

  it.skip("initiate force withdrawal -> redeem -> complete force withdraw, should be pass", async () => {
    console.log("----------Deposit to vault----------");
    const ptAmount = BigInt(1e18);
    const estimateScAmount =
      await pendleHedgeVault.estimateScAmountFromPtAmount(ptAmount);

    await deposit(admin, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));
    await deposit(user1, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      estimateScAmount * BigInt(4),
      PRECISION
    );

    await pendleHedgeVault.initiateForceWithdrawal();
    await pendleHedgeVault.connect(user1).initiateForceWithdrawal();

    console.log("----------acquire withdrawal funds----------");
    await pendleHedgeVault.acquireWithdrawalFunds(
      ptAmount + ptAmount,
      estimateScAmount + estimateScAmount
    );

    const increaseTime = 86400 * 100;
    await network.provider.send("evm_increaseTime", [increaseTime]);
    await network.provider.send("evm_mine");

    let usdcAdminBalance = await usdc
      .connect(admin)
      .balanceOf(admin.getAddress());
    console.log("Balance usdc admin before complete wd => ", usdcAdminBalance);
    let usdcUser1Balance = await usdc
      .connect(user1)
      .balanceOf(user1.getAddress());
    console.log("Balance usdc user1 before complete wd => ", usdcUser1Balance);

    console.log("----------complete withdrawal----------");
    await pendleHedgeVault.completeWithdrawal();
    await pendleHedgeVault.connect(user1).completeWithdrawal();
    await logAndReturnTotalValueLock();

    usdcAdminBalance = await usdc.connect(admin).balanceOf(admin.getAddress());
    console.log("Balance usdc admin before complete wd=> ", usdcAdminBalance);
    usdcUser1Balance = await usdc.connect(user1).balanceOf(user1.getAddress());
    console.log("Balance usdc user1 before complete wd => ", usdcUser1Balance);
  });

  it("deposit -> syncbalance -> initiate force withdrawal -> complete force withdraw, should be pass", async () => {
    console.log("----------Deposit to vault----------");
    const ptAmount = BigInt(1e18);
    const estimateScAmount =
      await pendleHedgeVault.estimateScAmountFromPtAmount(ptAmount);

    console.log("estimateScAmount ", estimateScAmount);
    await deposit(admin, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));
    await deposit(user1, BigInt(1 * 1e18), usdc, BigInt(estimateScAmount));

    let totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      estimateScAmount * BigInt(4),
      PRECISION
    );

    console.log("----------syncbalance and update pps----------");
    await pendleHedgeVault.syncBalance(BigInt(1e7));

    let pps = await pendleHedgeVault.pricePerShare();
    console.log("pps ", pps);
    expect(pps).to.approximately(BigInt(1001023), PRECISION);

    totalValueLock = await logAndReturnTotalValueLock();
    expect(totalValueLock).to.approximately(
      estimateScAmount * BigInt(4) + BigInt(1e7),
      PRECISION
    );

    await pendleHedgeVault.initiateForceWithdrawal();
    await pendleHedgeVault.connect(user1).initiateForceWithdrawal();
    await logAndReturnTotalValueLock();

    console.log("----------handle post withdraw----------");
    await usdc.approve(await pendleHedgeVault.getAddress(), 1e7);
    const handlePostWithdrawTx = await pendleHedgeVault
      .handlePostWithdrawFromVendor(1e7);
    await handlePostWithdrawTx.wait();

    console.log("----------acquire withdrawal funds----------");
    await pendleHedgeVault.acquireWithdrawalFunds(
      ptAmount + ptAmount,
      estimateScAmount + estimateScAmount + BigInt(1e7)
    );
    await logAndReturnTotalValueLock();

    console.log("----------complete withdrawal----------");
    await pendleHedgeVault.completeWithdrawal();
    await logAndReturnTotalValueLock();

    await pendleHedgeVault.connect(user1).completeWithdrawal();
    await logAndReturnTotalValueLock();
  });

  it.skip("Blacklist withdraw - test case", async () => {
    console.log(
      "------------------------Blacklist test case------------------------"
    );
    //update after, my computer is caching test => can not run test case
  });
});
