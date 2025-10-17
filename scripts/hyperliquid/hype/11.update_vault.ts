const { ethers, network } = require("hardhat");
import { FundContract } from "../../../typechain-types";
import { CHAINID } from "../../../constants";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

let fundContract: FundContract;

const fundContractAddress = "0xFde5B0626fC80E36885e2fA9cD5ad9d7768D725c";

const ADMIN_PRIVATE_KEY =
  process.env.HYPEREVM_DN_HYPE_V3_ADMIN_PRIVATE_KEY || "";

let admin: Signer;

async function setUpContract() {
  admin = new ethers.Wallet(ADMIN_PRIVATE_KEY, ethers.provider);
  fundContract = await ethers.getContractAt(
    "FundContract",
    fundContractAddress
  );
}

async function updateVaultSetting() {
  // Set vault parameters
  const minimumSupply = BigInt(0.001 * 1e18); // 1 HYPE minimum
  const capacity = BigInt(1000000000 * 1e18); // 100k HYPE capacity
  const performanceFeeRate = 10; // 10% performance fee
  const managementFeeRate = 1; // 1% management fee
  const managementFeeReceiver = "0x85dd97ede8c04163a511420b8e1d3fc86d1f7d4c"; // HyperEvm management fee receiver
  const performanceFeeReceiver = "0xbad8636f3e87247d96feb5e0816a54364efcb993"; // HyperEvm performance fee receiver
  const networkCost = BigInt(0.001 * 1e18); // 0.001 HYPE network cost

  console.log("Updating vault settings with parameters:");
  console.log("Minimum supply:", ethers.formatEther(minimumSupply), "HYPE");
  console.log("Capacity:", ethers.formatEther(capacity), "HYPE");
  console.log("Performance fee rate:", ethers.formatEther(performanceFeeRate), "%");
  console.log("Management fee rate:", ethers.formatEther(managementFeeRate), "%");
  console.log("Management fee receiver:", managementFeeReceiver);
  console.log("Performance fee receiver:", performanceFeeReceiver);
  console.log("Network cost:", ethers.formatEther(networkCost), "HYPE");

  // Call updateVaultSetting function
  const tx = await fundContract.connect(admin).updateVaultSetting(
    minimumSupply,
    capacity,
    performanceFeeRate,
    managementFeeRate,
    managementFeeReceiver,
    performanceFeeReceiver,
    networkCost
  );

  await tx.wait();
  console.log("Vault settings updated successfully");
}

async function updateVaultState() {
  // Get current timestamp
  const currentTimestamp = 1750862400;  // https://hyperevmscan.io/block/6726651
  const lastHarvest = 1752105600;  // Thursday, July 10, 2025 12:00:00 AM GMT+0

  // Update vault state parameters
  const highWatermark = ethers.parseEther("1.0");
  const deployedTimestamp = currentTimestamp;
  const lastHarvestManagementFeeTime = lastHarvest;
  const lastHarvestPerformanceFeeTime = lastHarvest;

  console.log("Updating vault state with parameters:");
  console.log("High watermark:", ethers.formatEther(highWatermark));
  console.log("Deployed timestamp:", deployedTimestamp);
  console.log("Last harvest management fee time:", lastHarvestManagementFeeTime);
  console.log("Last harvest performance fee time:", lastHarvestPerformanceFeeTime);

  // Call updateVaultState function
  const tx = await fundContract.connect(admin).updateVaultState(
    highWatermark,
    deployedTimestamp, 
    lastHarvestManagementFeeTime,
    lastHarvestPerformanceFeeTime
  );
  await tx.wait();
  console.log("Vault state updated successfully");
}

async function setBlackListContract(blackListAddress: string) {
  console.log("Setting blacklist contract address:", blackListAddress);
  
  // Call setBlackListContract function
  const tx = await fundContract.connect(admin).setBlackListContract(blackListAddress);
  await tx.wait();
  
  console.log("Blacklist contract set successfully");
}

async function main() {
  await setUpContract();
  await updateVaultSetting();
  await updateVaultState();
  await setBlackListContract("0x10F4a52b66eAD12fEc74d97293fF491dbB8fBE0D");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
