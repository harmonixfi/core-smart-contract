const { ethers, network } = require("hardhat");
const hre = require("hardhat");
import { getAddress, Signer, toUtf8Bytes, ZeroAddress } from "ethers";
import { IWETH, BalanceContract, IERC20 } from "../../../typechain-types";
import { CHAINID, NFT_POSITION_ADDRESS } from "../../../constants";
const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId", chainId);

const ADMIN_PRIVATE_KEY =
  process.env.HYPEREVM_DN_HYPE_V3_ADMIN_PRIVATE_KEY || "";
  const APPROVER_PRIVATE_KEY =
  process.env.HYPEREVM_DN_HYPE_V3_APPROVER_PRIVATE_KEY || "";

const OPERATOR_PRIVATE_KEY =
  process.env.HYPEREVM_DN_HYPE_V3_OPERATOR_PRIVATE_KEY || "";
const HL_TRADER_ADDRESS = "0xd4737ef74fc7bb5932ce917cf51b2e1a0263210a";
// const BALANCE_CONTRACT_ADDRESS = getAddress(
//   "0xEe6286ad0C0FCa50CCc89fE0e51532aD2D63D9F6"
// );
// testnet
// const BALANCE_CONTRACT_ADDRESS = getAddress(
//   "0xf768d02F06b242aD58B1b3202B7C3C4BCbF0F2D0"
// );
// // const FUND_CONTRACT_ADDRESS = "0xd040c6482c34F123271466fF40056f6D66de73b6";
// const FUND_CONTRACT_ADDRESS = "0x98870db3d3c8577dDb58835c59420646b1634205";

// mainnet
const BALANCE_CONTRACT_ADDRESS = getAddress(
  "0x543303266113B64d03Ec17B7ec3829f8CddADaC4"
);
const FUND_CONTRACT_ADDRESS = "0xFde5B0626fC80E36885e2fA9cD5ad9d7768D725c";

const FELIX_ADDRESS = "0x5b271dc20ba7beb8eee276eb4f1644b6a217f0a3";
const STABILITY_POOL_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";
const HYPER_LEND_ADDRESS = "0x3100f4e7bda2ed2452d9a57eb30260ab071bbe62";

const WHYPE_ADDRESS = "0x5555555555555555555555555555555555555555";
const STHYPE_ADDRESS = "0xfFaa4a3D97fE9107Cef8a3F48c069F577Ff76cC1";
const LHYPE_ADDRESS = "0x5748ae796AE46A4F1348a1693de4b50560485562";
const FEUSD_ADDRESS = "0x02c6a2fa58cc01a18b8d9e00ea48d65e4df26c70";

const HINT_HELPER__ADDRESS = "0xa32e89c658f7fdcc0bdb2717f253bacd99f864d4";
const TROVE_MANAGER_ADDRESS = "0x3100f4e7bda2ed2452d9a57eb30260ab071bbe62";
const SORTED_TROVES_ADDRESS = "0xd1caa4218808eb94d36e1df7247f7406f43f2ef6";
const TROVE_NFT = "0x5AD1512e7006FdBD0f3EbB8aa35c5e9234a03AA7";

const HYPER_SWAP_FACTORY = "0xB1c0fa0B789320044A6F623cFe5eBda9562602E3";
const HYPER_SWAP_ROUTER = "0x4E2960a8cd19B467b82d26D83fAcb0fAE26b094D";
const HYPER_SWAP_NFT_MANAGER = "0x6eDA206207c09e5428F281761DdC0D300851fBC8";

const STAKED_HYPE_OVERSEER_V1 = "0xB96f07367e69e86d6e9C3F29215885104813eeAE";

let balanceContract: BalanceContract;
let wHypeContract: IWETH;
let feUSDContract: IERC20;
let user: Signer;
let admin: Signer;
let operator: Signer;
let approver: Signer;

const ActionType = {
  CONTRACT: 0,
  FUNCTION: 1,
  PARAMETER: 2,
};

async function setUpContract() {
  const [_, _user] = await ethers.getSigners();
  user = _user;

  admin = new ethers.Wallet(ADMIN_PRIVATE_KEY, ethers.provider);
  operator = new ethers.Wallet(OPERATOR_PRIVATE_KEY, ethers.provider);
  approver = new ethers.Wallet(APPROVER_PRIVATE_KEY, ethers.provider);

  wHypeContract = (await ethers.getContractAt("IWETH", WHYPE_ADDRESS)) as IWETH;
  feUSDContract = (await ethers.getContractAt(
    "ERC20",
    FEUSD_ADDRESS
  )) as IERC20;

  balanceContract = await ethers.getContractAt(
    "BalanceContract",
    BALANCE_CONTRACT_ADDRESS
  );
}

async function approveAction(params: any) {
  const tx = await balanceContract
    .connect(approver)
    .approveAction(
      params.actionType,
      params.target,
      params.selector,
      params.paramIndex,
      params.paramHash,
      params.status
    );
  await tx.wait();
}

function getFunctionSelector(signature: string) {
  return ethers.keccak256(toUtf8Bytes(signature)).slice(0, 10);
}

//#region approve token
async function approveApproveWHYPE() {
  const selector = getFunctionSelector("approve(address,uint256)");

  // approve for FELIX
  let encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [FELIX_ADDRESS]
  );
  let paramHash = ethers.keccak256(encodedAddress);
  let approveParams = {
    actionType: ActionType.PARAMETER,
    target: WHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };
  await approveAction(approveParams);

  // approve for HYPER_SWAP_ROUTER
  encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HYPER_SWAP_ROUTER]
  );
  paramHash = ethers.keccak256(encodedAddress);
  approveParams = {
    actionType: ActionType.PARAMETER,
    target: WHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };
  await approveAction(approveParams);

  // approve for HYPER_SWAP_NFT_MANAGER
  encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HYPER_SWAP_NFT_MANAGER]
  );
  paramHash = ethers.keccak256(encodedAddress);
  approveParams = {
    actionType: ActionType.PARAMETER,
    target: WHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };
  await approveAction(approveParams);
  await isAllowApproveApproveWHYPE();
}
async function isAllowApproveApproveWHYPE() {
  // check approve for FELIX_ADDRESS
  let data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [FELIX_ADDRESS, 1]);

  let isAllowed = await balanceContract.isActionAllowed(WHYPE_ADDRESS, data);
  console.log("isActionAllowed FELIX_ADDRESS (approve):", isAllowed);

  // check approve for HYPER_SWAP_ROUTER
  data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [HYPER_SWAP_ROUTER, 1]);

  isAllowed = await balanceContract.isActionAllowed(WHYPE_ADDRESS, data);
  console.log("isActionAllowed HYPER_SWAP_ROUTER (approve):", isAllowed);

  // check approve for HYPER_SWAP_NFT_MANAGER
  data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [HYPER_SWAP_NFT_MANAGER, 1]);

  isAllowed = await balanceContract.isActionAllowed(WHYPE_ADDRESS, data);
  console.log("isActionAllowed HYPER_SWAP_NFT_MANAGER (approve):", isAllowed);
}
async function approveApproveSTHYPE() {
  const selector = getFunctionSelector("approve(address,uint256)");

  // approve for HYPER_SWAP_ROUTER
  let encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HYPER_SWAP_ROUTER]
  );
  let paramHash = ethers.keccak256(encodedAddress);
  let approveParams = {
    actionType: ActionType.PARAMETER,
    target: STHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };
  await approveAction(approveParams);

  // approve for HYPER_SWAP_NFT_MANAGER
  encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HYPER_SWAP_NFT_MANAGER]
  );
  paramHash = ethers.keccak256(encodedAddress);
  approveParams = {
    actionType: ActionType.PARAMETER,
    target: STHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };
  await approveAction(approveParams);
  await isAllowApproveApproveSTHYPE();
}
async function isAllowApproveApproveSTHYPE() {
  // check approve for HYPER_SWAP_ROUTER
  let data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [HYPER_SWAP_ROUTER, 1]);

  let isAllowed = await balanceContract.isActionAllowed(STHYPE_ADDRESS, data);
  console.log("isActionAllowed HYPER_SWAP_ROUTER (approve):", isAllowed);

  // check approve for HYPER_SWAP_NFT_MANAGER
  data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [HYPER_SWAP_NFT_MANAGER, 1]);

  isAllowed = await balanceContract.isActionAllowed(STHYPE_ADDRESS, data);
  console.log("isActionAllowed HYPER_SWAP_NFT_MANAGER (approve):", isAllowed);
}
async function approveApproveLHYPE() {
  const selector = getFunctionSelector("approve(address,uint256)");

  // approve for HYPER_SWAP_ROUTER
  let encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HYPER_SWAP_ROUTER]
  );
  let paramHash = ethers.keccak256(encodedAddress);
  let approveParams = {
    actionType: ActionType.PARAMETER,
    target: LHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };
  await approveAction(approveParams);

  // approve for HYPER_SWAP_NFT_MANAGER
  encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HYPER_SWAP_NFT_MANAGER]
  );
  paramHash = ethers.keccak256(encodedAddress);
  approveParams = {
    actionType: ActionType.PARAMETER,
    target: LHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };
  await approveAction(approveParams);
  await isAllowApproveApproveLHYPE();
}
async function isAllowApproveApproveLHYPE() {
  // check approve for HYPER_SWAP_ROUTER
  let data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [HYPER_SWAP_ROUTER, 1]);

  let isAllowed = await balanceContract.isActionAllowed(LHYPE_ADDRESS, data);
  console.log("isActionAllowed HYPER_SWAP_ROUTER (approve):", isAllowed);

  // check approve for HYPER_SWAP_NFT_MANAGER
  data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [HYPER_SWAP_NFT_MANAGER, 1]);

  isAllowed = await balanceContract.isActionAllowed(LHYPE_ADDRESS, data);
  console.log("isActionAllowed HYPER_SWAP_NFT_MANAGER (approve):", isAllowed);
}
async function TokenApproveActions() {
  await approveApproveWHYPE();
  await approveApproveSTHYPE();
  await approveApproveLHYPE();
}
//#endregion

//#region Use Felix
async function approveOpenTroveOnFelix() {
  const selector = getFunctionSelector(
    "openTrove(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,address,address)"
  );
  console.log("selector approveOpenTroveOnFelix", selector);
  const encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedAddress);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: FELIX_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveOpenTroveOnFelix();
}

async function isAllowApproveOpenTroveOnFelix() {
  const data = new ethers.Interface([
    "function openTrove(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,address,address)",
  ]).encodeFunctionData("openTrove", [
    BALANCE_CONTRACT_ADDRESS,
    1,
    1000,
    500,
    0,
    0,
    5,
    100,
    BALANCE_CONTRACT_ADDRESS,
    BALANCE_CONTRACT_ADDRESS,
    BALANCE_CONTRACT_ADDRESS,
  ]);

  const isAllowed = await balanceContract.isActionAllowed(FELIX_ADDRESS, data);
  console.log("isActionAllowed (OpenTrove):", isAllowed);
}

async function approveAddCollateralOnFelix() {
  const selector = getFunctionSelector("addColl(uint256,uint256)");
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: FELIX_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveAddCollateralOnFelix();
}

async function isAllowApproveAddCollateralOnFelix() {
  const data = new ethers.Interface([
    "function addColl(uint256,uint256)",
  ]).encodeFunctionData("addColl", [1, 1000]);

  const isAllowed = await balanceContract.isActionAllowed(FELIX_ADDRESS, data);
  console.log("isActionAllowed (AddCollateral):", isAllowed);
}

async function approveWithdrawOnFelix() {
  const selector = getFunctionSelector("withdrawColl(uint256,uint256)");
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: FELIX_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveWithdrawOnFelix();
}

async function isAllowApproveWithdrawOnFelix() {
  const data = new ethers.Interface([
    "function withdrawColl(uint256,uint256)",
  ]).encodeFunctionData("withdrawColl", [1, 500]);

  const isAllowed = await balanceContract.isActionAllowed(FELIX_ADDRESS, data);
  console.log("isActionAllowed (WithdrawColl):", isAllowed);
}

async function approveWithdrawFelixOnFelix() {
  const selector = getFunctionSelector(
    "withdrawfeUSD(uint256,uint256,uint256)"
  );
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: FELIX_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveWithdrawFelixOnFelix();
}

async function isAllowApproveWithdrawFelixOnFelix() {
  const data = new ethers.Interface([
    "function withdrawfeUSD(uint256,uint256,uint256)",
  ]).encodeFunctionData("withdrawfeUSD", [1, 500, 50]);

  const isAllowed = await balanceContract.isActionAllowed(FELIX_ADDRESS, data);
  console.log("isActionAllowed (WithdrawFelix):", isAllowed);
}

async function approveRepayFelixOnFelix() {
  const selector = getFunctionSelector("repayfeUSD(uint256,uint256)");
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: FELIX_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveRepayFelixOnFelix();
}

async function isAllowApproveRepayFelixOnFelix() {
  const data = new ethers.Interface([
    "function repayfeUSD(uint256,uint256)",
  ]).encodeFunctionData("repayfeUSD", [1, 200]);

  const isAllowed = await balanceContract.isActionAllowed(FELIX_ADDRESS, data);
  console.log("isActionAllowed (RepayFelix):", isAllowed);
}

async function approveAdjustTroveInterestRateOnFelix() {
  const selector = getFunctionSelector(
    "adjustTroveInterestRate(uint256,uint256,uint256,uint256,uint256)"
  );
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: FELIX_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveAdjustTroveInterestRateOnFelix();
}

async function isAllowApproveAdjustTroveInterestRateOnFelix() {
  const data = new ethers.Interface([
    "function adjustTroveInterestRate(uint256,uint256,uint256,uint256,uint256)",
  ]).encodeFunctionData("adjustTroveInterestRate", [1, 10, 0, 0, 5]);

  const isAllowed = await balanceContract.isActionAllowed(FELIX_ADDRESS, data);
  console.log("isActionAllowed (AdjustTroveInterestRate):", isAllowed);
}

async function approveCloseTroveOnFelix() {
  const selector = getFunctionSelector("closeTrove(uint256)");
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: FELIX_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveCloseTroveOnFelix();
}

async function isAllowApproveCloseTroveOnFelix() {
  const data = new ethers.Interface([
    "function closeTrove(uint256)",
  ]).encodeFunctionData("closeTrove", [1]);

  const isAllowed = await balanceContract.isActionAllowed(FELIX_ADDRESS, data);
  console.log("isActionAllowed (CloseTrove):", isAllowed);
}

async function approveProvideToSPOnFelix() {
  const selector = getFunctionSelector("provideToSP(uint256,bool)");
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: STABILITY_POOL_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveProvideToSPOnFelix();
}

async function isAllowApproveProvideToSPOnFelix() {
  const data = new ethers.Interface([
    "function provideToSP(uint256,bool)",
  ]).encodeFunctionData("provideToSP", [1000, true]);

  const isAllowed = await balanceContract.isActionAllowed(
    STABILITY_POOL_ADDRESS,
    data
  );
  console.log("isActionAllowed (ProvideToSP):", isAllowed);
}

async function approveWithdrawFromSPOnFelix() {
  const selector = getFunctionSelector(
    "solidityCopyEditwithdrawFromSP(uint256,bool)"
  );
  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: STABILITY_POOL_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveWithdrawFromSPOnFelix();
}

async function isAllowApproveWithdrawFromSPOnFelix() {
  const data = new ethers.Interface([
    "function solidityCopyEditwithdrawFromSP(uint256,bool)",
  ]).encodeFunctionData("solidityCopyEditwithdrawFromSP", [500, true]);

  const isAllowed = await balanceContract.isActionAllowed(
    STABILITY_POOL_ADDRESS,
    data
  );
  console.log("isActionAllowed (solidityCopyEditwithdrawFromSP):", isAllowed);
}

async function UseFelixApproveActions() {
  await approveOpenTroveOnFelix();
  await approveAddCollateralOnFelix();
  await approveWithdrawOnFelix();
  await approveWithdrawFelixOnFelix();
  await approveRepayFelixOnFelix();
  await approveAdjustTroveInterestRateOnFelix();
  await approveCloseTroveOnFelix();
  await approveProvideToSPOnFelix();
  await approveWithdrawFromSPOnFelix();
}
//#endregion

//#region Hyper Lend
async function approveSupplyOnHyperLend() {
  const selector = getFunctionSelector(
    "supply(address,uint256,address,uint16)"
  );
  const encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedAddress);
  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: HYPER_LEND_ADDRESS,
    selector: selector,
    paramIndex: 2,
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveSupplyOnHyperLend();
}

async function isAllowApproveSupplyOnHyperLend() {
  const data = new ethers.Interface([
    "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  ]).encodeFunctionData("supply", [
    BALANCE_CONTRACT_ADDRESS,
    1,
    BALANCE_CONTRACT_ADDRESS,
    0,
  ]);

  const isAllowed = await balanceContract.isActionAllowed(
    HYPER_LEND_ADDRESS,
    data
  );
  console.log("isActionAllowed (supply):", isAllowed);
}

async function HyperLendApproveActions() {
  await approveSupplyOnHyperLend();
}
//#endregion

//#region Hyper Swap
async function approveExactOutputSingleOnHyperLend() {
  const selector = getFunctionSelector(
    "exactOutputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))"
  );

  // Encode the nested `recipient` address field
  const encodedRecipient = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedRecipient);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: HYPER_SWAP_ROUTER,
    selector: selector,
    paramIndex: 3, // Index of the whole `params` struct
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowExactOutputSingleOnHyperLend();
}

async function isAllowExactOutputSingleOnHyperLend() {
  const iface = new ethers.Interface([
    "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountOut,uint256 amountInMaximum,uint160 sqrtPriceLimitX96))",
  ]);

  const data = iface.encodeFunctionData("exactOutputSingle", [
    {
      tokenIn: "0x0000000000000000000000000000000000000001",
      tokenOut: "0x0000000000000000000000000000000000000002",
      fee: 3000,
      recipient: BALANCE_CONTRACT_ADDRESS,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      amountOut: ethers.parseUnits("1.0", 18),
      amountInMaximum: ethers.parseUnits("2.0", 18),
      sqrtPriceLimitX96: 0n,
    },
  ]);

  const isAllowed = await balanceContract.isActionAllowed(
    HYPER_SWAP_ROUTER,
    data
  );
  console.log("isActionAllowed (exactOutputSingle):", isAllowed);
}

async function approveExactInputSingleOnHyperLend() {
  const selector = getFunctionSelector(
    "exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160))"
  );

  // Encode the nested `recipient` address field
  const encodedRecipient = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedRecipient);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: HYPER_SWAP_ROUTER,
    selector: selector,
    paramIndex: 3, // Index of the whole `params` struct
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowExactInputSingleOnHyperLend();
}

async function isAllowExactInputSingleOnHyperLend() {
  const iface = new ethers.Interface([
    "function exactOutputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96))",
  ]);

  const data = iface.encodeFunctionData("exactOutputSingle", [
    {
      tokenIn: "0x0000000000000000000000000000000000000001",
      tokenOut: "0x0000000000000000000000000000000000000002",
      fee: 3000,
      recipient: BALANCE_CONTRACT_ADDRESS,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      amountIn: ethers.parseUnits("1.0", 18),
      amountOutMinimum: ethers.parseUnits("2.0", 18),
      sqrtPriceLimitX96: 0n,
    },
  ]);

  const isAllowed = await balanceContract.isActionAllowed(
    HYPER_SWAP_ROUTER,
    data
  );
  console.log("isActionAllowed (exactOutputSingle):", isAllowed);
}

async function approveHyperSwapMintPosition() {
  const selector = getFunctionSelector(
    "mint((address,address,uint24,int24,int24,uint256,uint256,uint256,uint256,address,uint256))"
  );

  // Encode just the `recipient` field as bytes
  const encodedRecipient = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedRecipient);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: HYPER_SWAP_NFT_MANAGER,
    selector: selector,
    paramIndex: 9, // MintParams is the first param
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowHyperSwapMintPosition();
}

async function isAllowHyperSwapMintPosition() {
  const iface = new ethers.Interface([
    "function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline))",
  ]);

  const dummyMintParams = {
    token0: "0x0000000000000000000000000000000000000001",
    token1: "0x0000000000000000000000000000000000000002",
    fee: 3000,
    tickLower: 0,
    tickUpper: 0,
    amount0Desired: 1,
    amount1Desired: 1,
    amount0Min: 0,
    amount1Min: 0,
    recipient: BALANCE_CONTRACT_ADDRESS,
    deadline: Math.floor(Date.now() / 1000) + 60,
  };

  const data = iface.encodeFunctionData("mint", [dummyMintParams]);

  const isAllowed = await balanceContract.isActionAllowed(
    HYPER_SWAP_NFT_MANAGER,
    data
  );
  console.log("isActionAllowed (hyperswap mint):", isAllowed);
}

async function approveHyperSwapIncreaseLiquidity() {
  const selector = getFunctionSelector(
    "increaseLiquidity((uint256,uint256,uint256,uint256,uint256,uint256))"
  );

  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: HYPER_SWAP_NFT_MANAGER,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowHyperSwapIncreaseLiquidity();
}

async function isAllowHyperSwapIncreaseLiquidity() {
  const iface = new ethers.Interface([
    "function increaseLiquidity((uint256 tokenId,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,uint256 deadline))",
  ]);

  const dummyIncreaseLiquidityParams = {
    tokenId: 1,
    amount0Desired: 1,
    amount1Desired: 1,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(Date.now() / 1000) + 60,
  };

  const data = iface.encodeFunctionData("increaseLiquidity", [
    dummyIncreaseLiquidityParams,
  ]);

  const isAllowed = await balanceContract.isActionAllowed(
    HYPER_SWAP_NFT_MANAGER,
    data
  );
  console.log("isActionAllowed (hyper swap increase liquidity):", isAllowed);
}

async function approveHyperSwapDecreaseLiquidity() {
  const selector = getFunctionSelector(
    "decreaseLiquidity((uint256,uint128,uint256,uint256,uint256))"
  );

  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: HYPER_SWAP_NFT_MANAGER,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowHyperSwapDecreaseLiquidity();
}

async function isAllowHyperSwapDecreaseLiquidity() {
  const iface = new ethers.Interface([
    "function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline))",
  ]);

  const dummyDecreaseLiquidityParams = {
    tokenId: 1,
    liquidity: 1,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(Date.now() / 1000) + 60,
  };

  const data = iface.encodeFunctionData("decreaseLiquidity", [
    dummyDecreaseLiquidityParams,
  ]);

  const isAllowed = await balanceContract.isActionAllowed(
    HYPER_SWAP_NFT_MANAGER,
    data
  );
  console.log("isActionAllowed (decrease liquidity):", isAllowed);
}

async function approveHyperSwapCollect() {
  const selector = getFunctionSelector(
    "collect((uint256,address,uint128,uint128))"
  );

  // Encode just the `tokenId` field
  const encodedRecipient = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedRecipient);

  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: HYPER_SWAP_NFT_MANAGER,
    selector: selector,
    paramIndex: 1, // CollectParams struct is at index 0
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowHyperSwapCollect();
}

async function isAllowHyperSwapCollect() {
  const iface = new ethers.Interface([
    "function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max))",
  ]);

  const dummyCollectParams = {
    tokenId: 1,
    recipient: BALANCE_CONTRACT_ADDRESS,
    amount0Max: 1,
    amount1Max: 1,
  };

  const data = iface.encodeFunctionData("collect", [dummyCollectParams]);

  const isAllowed = await balanceContract.isActionAllowed(
    HYPER_SWAP_NFT_MANAGER,
    data
  );
  console.log("isActionAllowed (collect):", isAllowed);
}

async function HyperSwapApproveActions() {
  // await approveExactOutputSingleOnHyperLend();
  await approveExactInputSingleOnHyperLend();
  // await approveHyperSwapMintPosition();
  // await approveHyperSwapIncreaseLiquidity();
  // await approveHyperSwapDecreaseLiquidity();
  // await approveHyperSwapCollect();
}

//#endregion

//#region Staked Hype
async function approveStakeHype() {
  const selector = getFunctionSelector("mint(address,string)");

  // Encode the nested `recipient` address field
  const encodedRecipient = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedRecipient);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: STAKED_HYPE_OVERSEER_V1,
    selector: selector,
    paramIndex: 0, // Index of the whole `params` struct
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowStakedHype();
}

async function isAllowStakedHype() {
  const iface = new ethers.Interface([
    "function mint(address to,string communityCode)",
  ]);

  const data = iface.encodeFunctionData("mint", [BALANCE_CONTRACT_ADDRESS, ""]);

  const isAllowed = await balanceContract.isActionAllowed(
    STAKED_HYPE_OVERSEER_V1,
    data
  );
  console.log("isActionAllowed (staked hype mint):", isAllowed);
}

async function approveUnStakeHype() {
  const selector = getFunctionSelector(
    "burnAndRedeemIfPossible(address,uint256,string)"
  );

  // Encode the nested `recipient` address field
  const encodedRecipient = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [BALANCE_CONTRACT_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedRecipient);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: STAKED_HYPE_OVERSEER_V1,
    selector: selector,
    paramIndex: 0, // Index of the whole `params` struct
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
  await isAllowUnStakedHype();
}

async function isAllowUnStakedHype() {
  const iface = new ethers.Interface([
    "function burnAndRedeemIfPossible(address to, uint256 amount, string communityCode)",
  ]);

  const data = iface.encodeFunctionData("burnAndRedeemIfPossible", [
    BALANCE_CONTRACT_ADDRESS,
    0,
    "",
  ]);

  const isAllowed = await balanceContract.isActionAllowed(
    STAKED_HYPE_OVERSEER_V1,
    data
  );
  console.log("isActionAllowed (unStaked hype mint):", isAllowed);
}

async function StakedHypeApproveActions() {
  await approveStakeHype();
  await approveUnStakeHype();
}

//#endregion

//#region Wrap token
async function approveDepositWrapToken() {
  const selector = getFunctionSelector("deposit()");

  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: WHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0, // Index of the whole `params` struct
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowApproveDepositWrapToken();
}

async function isAllowApproveDepositWrapToken() {
  const iface = new ethers.Interface([
    "function deposit()",
  ]);

  const data = iface.encodeFunctionData("deposit", []);
  const isAllowed = await balanceContract.isActionAllowed(
    WHYPE_ADDRESS,
    data
  );
  console.log("isAllowApproveDepositWrapToken:", isAllowed);
}

async function approveWithdrawWrapToken() {
  const selector = getFunctionSelector("withdraw(uint256)");

  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: WHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0, // Index of the whole `params` struct
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
  await isAllowUnStakedHype();
}

async function isAllowApproveWithdrawWrapToken() {
  const iface = new ethers.Interface(["function withdraw(uint256 amount)"]);

  const data = iface.encodeFunctionData("withdraw", [1]);

  const isAllowed = await balanceContract.isActionAllowed(
    WHYPE_ADDRESS,
    data
  );
  console.log("isAllowApproveWithdrawWrapToken:", isAllowed);
}

async function WrapTokenApproveActions() {
  await approveDepositWrapToken();
  await approveWithdrawWrapToken();
}

//#endregion

//#region fund contract
async function approveTransferActionToHlTrade() {
  const selector = getFunctionSelector("transfer(address,uint256)");
  const encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HL_TRADER_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedAddress);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: WHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
}

async function approveTransferFeUsdActionToHlTrade() {
  const selector = getFunctionSelector("transfer(address,uint256)");
  const encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [HL_TRADER_ADDRESS]
  );
  const paramHash = ethers.keccak256(encodedAddress);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: FEUSD_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
}

async function approveApproveActionForFundContract() {
  const selector = getFunctionSelector("approve(address,uint256)");
  const encodedAddress = ethers.AbiCoder.defaultAbiCoder().encode(
    ["address"],
    [FUND_CONTRACT_ADDRESS]
  );
  let paramHash = ethers.keccak256(encodedAddress);

  const approveParams = {
    actionType: ActionType.PARAMETER,
    target: WHYPE_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash,
    status: true,
  };

  await approveAction(approveParams);
}

async function approveAcquireActionForFundContract() {
  const selector = getFunctionSelector(
    "acquireWithdrawalFunds(uint256,address[],uint256[])"
  );

  const approveParams = {
    actionType: ActionType.FUNCTION,
    target: FUND_CONTRACT_ADDRESS,
    selector: selector,
    paramIndex: 0,
    paramHash: "0x" + "00".repeat(32),
    status: true,
  };

  await approveAction(approveParams);
}

//#endregion

async function balanceContractApproveActions() {
  await approveTransferActionToHlTrade();
  await approveTransferFeUsdActionToHlTrade();
  await approveApproveActionForFundContract();
  await approveAcquireActionForFundContract();

  await TokenApproveActions();
  // await UseFelixApproveActions();
  // await HyperSwapApproveActions();
  // await StakedHypeApproveActions();
  // await HyperLendApproveActions();
  await WrapTokenApproveActions();
}

async function setupWHype() {
  // Send native token to balance contract
  const sendNativeTx = await user.sendTransaction({
    to: BALANCE_CONTRACT_ADDRESS,
    value: ethers.parseEther("1000"),
  });
  await sendNativeTx.wait();

  // Check balance after sending
  const balanceAfter = await ethers.provider.getBalance(
    BALANCE_CONTRACT_ADDRESS
  );
  console.log(
    "Native token balance of BALANCE_CONTRACT_ADDRESS:",
    balanceAfter
  );

  const depositTx = await wHypeContract.connect(user).deposit({
    value: ethers.parseEther("1000"),
  });
  await depositTx.wait();

  console.log(
    "WHYPE balance of user1:",
    await wHypeContract.balanceOf(await user.getAddress())
  );

  const wethTransferTx = await wHypeContract
    .connect(user)
    .transfer(BALANCE_CONTRACT_ADDRESS, ethers.parseEther("1000"));
  await wethTransferTx.wait();
  console.log(
    "WHYPE balance of BALANCE_CONTRACT_ADDRESS:",
    await wHypeContract.balanceOf(BALANCE_CONTRACT_ADDRESS)
  );

  await approveWHYPEForFelix();
}

async function findMaxUpfrontFee(borrowedAmount: any, interestRate: any) {
  const hintHelperAbi = [
    "function predictOpenTroveUpfrontFee(uint256 _collIndex, uint256 _borrowedAmount, uint256 _interestRate) view returns (uint256)",
  ];
  const hintHelperContract = new ethers.Contract(
    HINT_HELPER__ADDRESS,
    hintHelperAbi
  );
  const collIndex = 0;

  const maxUpfrontFee = await hintHelperContract
    .connect(user)
    .predictOpenTroveUpfrontFee(collIndex, borrowedAmount, interestRate);
  console.log("Predicted Upfront Fee:", maxUpfrontFee);

  return maxUpfrontFee;
}

function sqrt(value: bigint): bigint {
  if (value < 2n) return value;
  let x0 = value / 2n;
  let x1 = (x0 + value / x0) / 2n;
  while (x1 < x0) {
    x0 = x1;
    x1 = (x0 + value / x0) / 2n;
  }
  return x0;
}

async function findHints(branch: any, interestRate: any) {
  const hintHelperAbi = [
    "function getApproxHint(uint256 _collIndex, uint256 _interestRate, uint256 _numTrials, uint256 _inputRandomSeed) view returns (uint256 hintId, uint256 diff, uint256 latestRandomSeed)",
  ];
  const troveManagerAbi = [
    "function getTroveIdsCount() view returns (uint256)",
  ];
  const sortedTrovesAbi = [
    "function findInsertPosition(uint256 _annualInterestRate, uint256 _prevId, uint256 _nextId) view returns (uint256, uint256)",
  ];
  const hintHelpers = new ethers.Contract(
    HINT_HELPER__ADDRESS,
    hintHelperAbi,
    ethers.provider
  );
  const troveManager = new ethers.Contract(
    TROVE_MANAGER_ADDRESS,
    troveManagerAbi,
    ethers.provider
  );
  const sortedTroves = new ethers.Contract(
    SORTED_TROVES_ADDRESS,
    sortedTrovesAbi,
    ethers.provider
  );

  const troveCount = await troveManager.getTroveIdsCount();

  const numTrials = sqrt(BigInt(parseInt(troveCount) * 100));
  const random = BigInt(Math.floor(Date.now() / 1000));
  console.log("branch ", branch.toString());
  console.log("interestRate ", interestRate.toString());
  console.log("numTrials ", numTrials.toString());
  console.log("random ", random.toString());

  // const approxHint = "85185547447814179435880144526515640718554331027009034100364033764704204839129";
  const [approxHint] = await hintHelpers.getApproxHint(
    branch,
    interestRate,
    numTrials,
    random
  );
  console.log("approxHint ", approxHint);

  const [upperHint, lowerHint] = await sortedTroves.findInsertPosition(
    interestRate,
    approxHint,
    approxHint
  );

  console.log("upperHint ", upperHint);
  console.log("lowerHint ", lowerHint);
  return { upperHint, lowerHint };
}

async function exeOpenTrove() {
  const borrowedAmount = ethers.parseUnits("2000", 18);
  const interestRate = ethers.parseUnits("0.06", 18);
  const maxUpfrontFee = await findMaxUpfrontFee(borrowedAmount, interestRate);
  const hint = await findHints(0, interestRate);
  const upperHint = hint.upperHint;
  const lowerHint = hint.lowerHint;

  console.log("upperHint ", upperHint);
  console.log("lowerHint ", lowerHint);
  console.log("maxUpfrontFee ", maxUpfrontFee);

  const data = new ethers.Interface([
    "function openTrove(address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,address,address)",
  ]).encodeFunctionData("openTrove", [
    BALANCE_CONTRACT_ADDRESS,
    0,
    ethers.parseEther("200"),
    borrowedAmount,
    upperHint,
    lowerHint,
    interestRate,
    maxUpfrontFee,
    ZeroAddress,
    ZeroAddress,
    ZeroAddress,
  ]);
  console.log("data ", data);
  const privateKey = process.env.ADMIN_PRIVATE_KEY || "";
  const operator = new ethers.Wallet(privateKey, ethers.provider);
  // const tx = await balanceContract
  //   .connect(operator)
  //   .executeAction(FELIX_ADDRESS, 0, data);
  // await tx.wait();
  // console.log(tx);
}

async function approveWHYPEForFelix() {
  const data = new ethers.Interface([
    "function approve(address,uint256)",
  ]).encodeFunctionData("approve", [FELIX_ADDRESS, ethers.parseEther("1000")]);
  console.log("data ", data);
  const tx = await balanceContract
    .connect(operator)
    .executeAction(WHYPE_ADDRESS, 0, data);
  await tx.wait();

  const allowance = await wHypeContract.allowance(
    BALANCE_CONTRACT_ADDRESS,
    FELIX_ADDRESS
  );
  console.log(
    "Allowance of WHYPE with owner BALANCE_CONTRACT_ADDRESS and spender FELIX_ADDRESS:",
    allowance.toString()
  );
}

async function checkfeUSD() {
  console.log(
    "feUSD balance of BALANCE_CONTRACT_ADDRESS:",
    await feUSDContract.balanceOf(BALANCE_CONTRACT_ADDRESS)
  );
}

async function getTroveNFTId(userWallet: any) {
  try {
    const troveNFTAbi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
    ];

    const troveNFTContract = new ethers.Contract(
      TROVE_NFT,
      troveNFTAbi,
      ethers.provider
    );

    // Check if the user has any NFTs
    const balance = await troveNFTContract.balanceOf(userWallet);

    if (balance > 0) {
      // Get the first NFT ID (assuming we want the first one)
      const troveId = await troveNFTContract.tokenOfOwnerByIndex(userWallet, 0);
      console.log(`Trove NFT ID for ${userWallet}: ${troveId}`);
      return troveId;
    } else {
      console.log(`No Trove NFT found for ${userWallet}`);
      return null;
    }
  } catch (error: any) {
    console.error(`Error getting Trove NFT ID: ${error.message}`);
    return null;
  }
}

async function logTroveInformation() {
  const id = await getTroveNFTId(BALANCE_CONTRACT_ADDRESS);
  const troveManagerAbi = [
    "function getLatestTroveData(uint256 _troveId) view returns (uint256 entireDebt, uint256 entireColl, uint256 redistBoldDebtGain, uint256 redistCollGain, uint256 accruedInterest, uint256 recordedDebt, uint256 annualInterestRate, uint256 weightedRecordedDebt, uint256 accruedBatchManagementFee, uint256 lastInterestRateAdjTime)",
  ];

  const troveManager = new ethers.Contract(
    TROVE_MANAGER_ADDRESS,
    troveManagerAbi,
    ethers.provider
  );

  const tx = await troveManager.connect(user).getLatestTroveData(id);
  console.log(tx);
}

async function main() {
  // await setUpContract();
  // await balanceContractApproveActions();
  // await setupWHype();
  // await exeOpenTrove();
  // await logTroveInformation();

  const [_, __, _user2] = await ethers.getSigners();
  const user2 = _user2;

  // Send ETH to balance contract
  const tx = await user2.sendTransaction({
    to: "0x254A6ae645726d7600d6B5703ee9b4a882eB4b2E",
    value: ethers.parseEther("1.0") // Sending 1 ETH, adjust amount as needed
  });
  await tx.wait();
  console.log("Sent ETH to balance contract");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
