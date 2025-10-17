const { ethers, network } = require("hardhat");
import { FundContract, IWETH } from "../../../typechain-types";
import { CHAINID } from "../../../constants";
import { Signer } from "ethers";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

// Contract addresses
const FUND_CONTRACT_ADDRESS = "0x98870db3d3c8577dDb58835c59420646b1634205";
const WHYPE_ADDRESS = "0x5555555555555555555555555555555555555555";

// User details
const USER_ADDRESS = "0x7354F8aDFDfc6ca4D9F81Fc20d04eb8A7b11b01b";
const TESTER_PRIVATE_KEY = process.env.TESTER_ARB_PRIVATE_KEY || "";

let fundContract: FundContract;
let wHypeContract: IWETH;
let userSigner: Signer;

async function setUpContract() {
  if (!TESTER_PRIVATE_KEY) {
    throw new Error("TESTER_ARB_PRIVATE_KEY environment variable is required");
  }

  userSigner = new ethers.Wallet(TESTER_PRIVATE_KEY, ethers.provider);
  
  fundContract = await ethers.getContractAt(
    "FundContract",
    FUND_CONTRACT_ADDRESS
  );
  
  wHypeContract = await ethers.getContractAt("IWETH", WHYPE_ADDRESS);
  
  console.log("User address:", await userSigner.getAddress());
  console.log("Fund contract address:", FUND_CONTRACT_ADDRESS);
}

async function getUserInfo() {
  const userAddress = await userSigner.getAddress();
  
  // Get user's share balance
  const shareBalance = await fundContract.balanceOf(userAddress);
  console.log("User share balance:", ethers.formatEther(shareBalance), "shares");
  
  // Get user's locked shares
  const lockedShares = await fundContract.getLockedShares(userAddress);
  console.log("User locked shares:", ethers.formatEther(lockedShares), "shares");
  
  // Get available shares for withdrawal
  const availableShares = shareBalance - lockedShares;
  console.log("Available shares for withdrawal:", ethers.formatEther(availableShares), "shares");
  
  // Get user's pending withdrawal shares
  const withdrawalShares = await fundContract.getUserWithdrawlShares(userAddress);
  console.log("User withdrawal shares:", ethers.formatEther(withdrawalShares), "shares");
  
  // Get current price per share
  const pricePerShare = await fundContract.pricePerShare();
  console.log("Current price per share:", ethers.formatEther(pricePerShare), "HYPE");
  
  // Calculate potential withdrawal amount
  const potentialWithdrawal = (shareBalance * pricePerShare) / (10n ** 18n);
  console.log("Potential withdrawal amount:", ethers.formatEther(potentialWithdrawal), "HYPE");
  
  // Check if user can complete withdrawal
  const canCompleteWithdraw = await fundContract.canCompleteWithdraw(userAddress);
  console.log("Can complete withdrawal:", canCompleteWithdraw);
  
  return {
    shareBalance,
    lockedShares,
    availableShares,
    withdrawalShares,
    pricePerShare,
    canCompleteWithdraw
  };
}

async function initiateWithdrawal(shares: bigint, minAssetsOut: bigint = 0n) {
  console.log("\n=== Initiating Withdrawal ===");
  console.log("Shares to withdraw:", ethers.formatEther(shares));
  console.log("Minimum assets out:", ethers.formatEther(minAssetsOut));
  
  try {
    const tx = await fundContract.connect(userSigner).initiateWithdrawal(shares, minAssetsOut);
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);
    
    // Parse events
    const events = receipt?.logs || [];
    for (const event of events) {
      try {
        const parsedEvent = fundContract.interface.parseLog(event);
        if (parsedEvent?.name === "WithdrawalInitiated") {
          console.log("Withdrawal initiated:");
          console.log("  Account:", parsedEvent.args.account);
          console.log("  Withdrawal Amount:", ethers.formatEther(parsedEvent.args.withdrawalAmount), "HYPE");
          console.log("  Shares:", ethers.formatEther(parsedEvent.args.shares));
        }
      } catch (e) {
        // Skip events that can't be parsed
      }
    }
    
    return true;
  } catch (error: any) {
    console.error("Error initiating withdrawal:", error.message);
    return false;
  }
}

async function completeRedemption(shares: bigint) {
  console.log("\n=== Completing Redemption ===");
  console.log("Shares to redeem:", ethers.formatEther(shares));
  
  const userAddress = await userSigner.getAddress();
  
  try {
    // Get user's HYPE balance before redemption
    const balanceBefore = await wHypeContract.balanceOf(userAddress);
    console.log("HYPE balance before redemption:", ethers.formatEther(balanceBefore));
    
    const tx = await fundContract.connect(userSigner).redeem(shares, userAddress, userAddress);
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt?.blockNumber);
    
    // Get user's HYPE balance after redemption
    const balanceAfter = await wHypeContract.balanceOf(userAddress);
    console.log("HYPE balance after redemption:", ethers.formatEther(balanceAfter));
    
    const received = balanceAfter - balanceBefore;
    console.log("HYPE received:", ethers.formatEther(received));
    
    
    return true;
  } catch (error: any) {
    console.error("Error completing redemption:", error.message);
    return false;
  }
}

async function main() {
  console.log("=== Fund Redemption Script ===");
  console.log("Target user:", USER_ADDRESS);
  console.log("Fund contract:", FUND_CONTRACT_ADDRESS);
  
  await setUpContract();
  
  // Verify the signer address matches the target user
  const signerAddress = await userSigner.getAddress();
  if (signerAddress.toLowerCase() !== USER_ADDRESS.toLowerCase()) {
    throw new Error(`Signer address ${signerAddress} does not match target user ${USER_ADDRESS}`);
  }
  
  // Get current user info
  const userInfo = await getUserInfo();
  
  if (userInfo.shareBalance === 0n) {
    console.log("User has no shares to redeem");
    return;
  }
  
  // Check if user has pending withdrawal
  if (userInfo.withdrawalShares > 0n) {
    console.log("\nUser has pending withdrawal shares");
    
    if (userInfo.canCompleteWithdraw) {
      console.log("User can complete withdrawal");
      
      // Ask user if they want to complete the existing withdrawal
      console.log("Completing existing withdrawal...");
      await completeRedemption(userInfo.withdrawalShares);
    } else {
      console.log("Withdrawal funds not yet acquired. Cannot complete withdrawal.");
    }
  } 
//   else {
//     console.log("\nNo pending withdrawal found");
    
//     if (userInfo.availableShares > 0n) {
//       console.log("Initiating withdrawal for all available shares...");
      
//       // Calculate minimum assets out (with 1% slippage tolerance)
//       const expectedAssets = (userInfo.availableShares * userInfo.pricePerShare) / (10n ** 18n);
//       const minAssetsOut = (expectedAssets * 99n) / 100n; // 1% slippage
      
//       const success = await initiateWithdrawal(userInfo.availableShares, minAssetsOut);
      
//       if (success) {
//         console.log("\nWithdrawal initiated successfully!");
//         console.log("Note: You will need to wait for the admin to acquire withdrawal funds before you can complete the redemption.");
//         console.log("Run this script again later to complete the redemption.");
//       }
//     } else {
//       console.log("No available shares to withdraw (all shares are locked)");
//     }
//   }
  
  // Show final user info
  console.log("\n=== Final User Info ===");
  await getUserInfo();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
