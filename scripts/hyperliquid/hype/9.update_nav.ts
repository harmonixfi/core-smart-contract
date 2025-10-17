const { ethers, network } = require("hardhat");
import {
  FundContract,
  FundContractReader,
  IWETH,
  PerpDexFundNavContract,
} from "../../../typechain-types";
import { CHAINID } from "../../../constants";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const adminPrivateKey = process.env.ADMIN_PRIVATE_KEY || "";
let fundNavContract: PerpDexFundNavContract;
let fundContract: FundContract;
let fundContractReader: FundContractReader;
let wHypeContract: IWETH;

const WHYPE_ADDRESS = "0x5555555555555555555555555555555555555555";
// testnet
// const BALANCE_CONTRACT_ADDRESS = "0xf768d02F06b242aD58B1b3202B7C3C4BCbF0F2D0";

// const fundNavContractAddress = "0x48E94D68fe260c13ACBe2356721d0884d9Ea9b82";
// const fundContractAddress = "0x98870db3d3c8577dDb58835c59420646b1634205";
// const fundContractReaderAddress = "0x179348034c7fa35d2d5a0149C17cEde52FbB22c6";

const BALANCE_CONTRACT_ADDRESS = "0x543303266113B64d03Ec17B7ec3829f8CddADaC4";

const fundNavContractAddress = "0x9E780bf57beD1c7E7aDD2E0A618Fb4aEe3490dBA";
const fundContractAddress = "0xFde5B0626fC80E36885e2fA9cD5ad9d7768D725c";
const fundContractReaderAddress = "0xDe38eDE7D792Bb805971cc46D1A8F684E9d218FF";

const ADMIN_PRIVATE_KEY =
  process.env.HYPEREVM_DN_HYPE_V3_ADMIN_PRIVATE_KEY || "";
const OPERATOR_PRIVATE_KEY =
  process.env.HYPEREVM_DN_HYPE_V3_OPERATOR_PRIVATE_KEY || "";

let admin: Signer;

async function setUpContract() {
  admin = new ethers.Wallet(ADMIN_PRIVATE_KEY, ethers.provider);
  wHypeContract = await ethers.getContractAt("IWETH", WHYPE_ADDRESS);
  fundContract = await ethers.getContractAt(
    "FundContract",
    fundContractAddress
  );
  fundContractReader = await ethers.getContractAt(
    "FundContractReader",
    fundContractReaderAddress
  );
  fundNavContract = await ethers.getContractAt(
    "PerpDexFundNavContract",
    fundNavContractAddress
  );
}

async function calculateExpectedNav(expectedPPS: number, expectedTotalSupply: number) {
  const expectedNav = expectedPPS * expectedTotalSupply;
  return expectedNav;
}

async function main() {
  await setUpContract();
  const balanceContractBalance = await wHypeContract.balanceOf(
    BALANCE_CONTRACT_ADDRESS
  );

  console.log(
    "Balance Contract WHYPE Balance:",
    ethers.formatEther(balanceContractBalance),
    "HYPE"
  );

  // Get the current PPS (Price Per Share)
  const currentPPS = await fundContractReader.pricePerShare(fundContractAddress);
  console.log(
    "Current Price Per Share (PPS):",
    ethers.formatEther(currentPPS),
    "HYPE"
  );

  // Get the current NAV (Net Asset Value)
  const currentNav = await fundContractReader.totalValueLocked(fundContractAddress);
  console.log(
    "Current NAV from fundContract:",
    ethers.formatEther(currentNav),
    "HYPE"
  );

  // Get the current withdraw pool amount
  const withdrawPoolAmount = await fundContractReader.getWithdrawPoolAmount(fundContractAddress);
  console.log(
    "Current Withdraw Pool Amount:",
    ethers.formatEther(withdrawPoolAmount),
    "HYPE"
  );

  // Get the current total supply
  const totalSupply = await fundContract.totalSupply();
  console.log(
    "Current Total Supply:",
    ethers.formatEther(totalSupply),
    "shares"
  );

  // const expectedNav = await calculateExpectedNav(1.00285, Number(totalSupply) / 1e18);
  // console.log(
  //   "Expected NAV:",
  //   ethers.formatEther(expectedNav),
  //   "HYPE"
  // );

  const nav = 30712.77;
  console.log("nav", nav);
  const newBalance = ethers.parseEther(nav.toString());  // DONNOT INCLUDE THE BALANCE CONTRACT

  // await fundNavContract.connect(admin).syncPerpDexBalance(newBalance);
  console.log("syncPerpDexBalance done");
  // await fundContract.connect(admin).updateNav();
  console.log("updateNav done");

  // Get the current NAV (Net Asset Value)
  const currentNavAfter = await fundContract.totalAssets();
  console.log(
    "Current NAV from fundContract after update nav:",
    ethers.formatEther(currentNavAfter),
    "HYPE"
  );

  // Get the current PPS (Price Per Share) after update
  const currentPPSAfter = await fundContractReader.pricePerShare(fundContractAddress);
  console.log(
    "Current Price Per Share (PPS) after update:",
    ethers.formatEther(currentPPSAfter),
    "HYPE"
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
