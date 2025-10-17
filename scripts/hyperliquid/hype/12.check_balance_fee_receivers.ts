const { ethers, network } = require("hardhat");
import { Signer } from "ethers";

async function main() {
  // Contract address
  const contractAddress = "0xFde5B0626fC80E36885e2fA9cD5ad9d7768D725c";
  
  // Fee receiver addresses
  const managementFeeReceiver = "0x85dd97ede8c04163a511420b8e1d3fc86d1f7d4c";
  const performanceFeeReceiver = "0xbad8636f3e87247d96feb5e0816a54364efcb993";
  
  console.log("Checking balances for fee receivers...");
  console.log("Contract address:", contractAddress);
  console.log("Management fee receiver:", managementFeeReceiver);
  console.log("Performance fee receiver:", performanceFeeReceiver);
  
  // Get the contract instance
  const fundContract = await ethers.getContractAt("FundContract", contractAddress);
  
  // Check balances
  const managementFeeBalance = await fundContract.balanceOf(managementFeeReceiver);
  const performanceFeeBalance = await fundContract.balanceOf(performanceFeeReceiver);
  
  // Display results
  console.log("\nBalances:");
  console.log("Management fee receiver balance:", ethers.formatEther(managementFeeBalance), "tokens");
  console.log("Performance fee receiver balance:", ethers.formatEther(performanceFeeBalance), "tokens");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
