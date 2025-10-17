const { ethers, network } = require("hardhat");
const hre = require("hardhat");
import { FetchRequest, JsonRpcProvider, Signer, ZeroAddress } from "ethers";
import { IWETH, BalanceContract, IERC20 } from "../../../typechain-types";
import { CHAINID } from "../../../constants";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId", chainId);

const FELIX_ADDRESS = "0x5b271dc20ba7beb8eee276eb4f1644b6a217f0a3";
const WHYPE_ADDRESS = "0x5555555555555555555555555555555555555555";
const FEUSD_ADDRESS = "0x02c6a2fa58cc01a18b8d9e00ea48d65e4df26c70";

const HINT_HELPER__ADDRESS = "0xa32e89c658f7fdcc0bdb2717f253bacd99f864d4";
const TROVE_MANAGER_ADDRESS = "0x3100f4e7bda2ed2452d9a57eb30260ab071bbe62";
const SORTED_TROVES_ADDRESS = "0xd1caa4218808eb94d36e1df7247f7406f43f2ef6";
const TROVE_NFT = "0x5AD1512e7006FdBD0f3EbB8aa35c5e9234a03AA7";

let balanceContract: BalanceContract;
let wHypeContract: IWETH;
let feUSDContract: IERC20;
let user: Signer;

async function setUpContract() {
  const [_, user1, user2, user3, user4, user5, user6, user7] =
    await ethers.getSigners();
  user = user6;
  wHypeContract = (await ethers.getContractAt("IWETH", WHYPE_ADDRESS)) as IWETH;
  feUSDContract = (await ethers.getContractAt(
    "ERC20",
    FEUSD_ADDRESS
  )) as IERC20;
}

async function modifyMaxCapacity() {
  const slot = "117";
  const value = BigInt(5000000000 * 1e18);
  await network.provider.send("hardhat_setStorageAt", [
    FELIX_ADDRESS,
    ethers.zeroPadValue(ethers.toBeHex(slot), 32),
    ethers.zeroPadValue(ethers.toBeHex(value), 32),
  ]);
  console.log(`Set slot ${slot} to ${value.toString()} at ${FELIX_ADDRESS}`);

  const storageValue = await network.provider.send("eth_getStorageAt", [
    FELIX_ADDRESS,
    ethers.zeroPadValue(ethers.toBeHex(slot), 32),
    "latest",
  ]);

  console.log(`Value at slot ${slot}: ${ethers.toBigInt(storageValue)}`);
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

async function setupWHype() {
  const depositTx = await wHypeContract.connect(user).deposit({
    value: ethers.parseEther("599"),
  });
  await depositTx.wait();
  console.log("WHYPE balance of user:", await wHypeContract.balanceOf(user));

  const approveTx = await wHypeContract
    .connect(user)
    .approve(FELIX_ADDRESS, ethers.parseEther("599"));
  await approveTx.wait();

  console.log(
    "Allowance of WHYPE with owner user and spender FELIX_ADDRESS:",
    await wHypeContract.allowance(user, FELIX_ADDRESS)
  );
}

async function exeOpenTrove() {
  const userAddress = await user.getAddress();

  const borrowedAmount = ethers.parseUnits("2000", 18);
  const interestRate = ethers.parseUnits("0.0225", 18);
  const maxUpfrontFee = await findMaxUpfrontFee(borrowedAmount, interestRate);
  const hint = await findHints(0, interestRate);
  const upperHint = hint.upperHint;
  const lowerHint = hint.lowerHint;
  console.log("Predicted Upfront Fee:", maxUpfrontFee);
  console.log("upperHint ", hint.upperHint);
  console.log("lowerHint ", hint.lowerHint);

  // const maxUpfrontFee = BigInt(1498875686561556224n);
  // const upperHint = BigInt(85185547447814179435880144526515640718554331027009034100364033764704204839129n);
  // const lowerHint = BigInt(31548801879590293404623443798116308681745079866814263399296825538553898995447n);

  const abi = [
    "function openTrove(address _owner,uint256 _ownerIndex,uint256 _ETHAmount,uint256 _feUSDAmount,uint256 _upperHint,uint256 _lowerHint,uint256 _annualInterestRate,uint256 _maxUpfrontFee,address _addManager,address _removeManager,address _receiver)",
  ];

  console.log("_owner ", userAddress);
  console.log("_ownerIndex ", 0);
  console.log("_ETHAmount ", ethers.parseEther("599"));
  console.log("_feUSDAmount ", BigInt(2000 * 1e18));
  console.log("_upperHint ", upperHint);
  console.log("_lowerHint ", lowerHint);
  console.log("_annualInterestRate ", ethers.parseUnits("0.0225", 18));
  console.log("_maxUpfrontFee ", maxUpfrontFee);
  console.log("_addManager ", ZeroAddress);
  console.log("_removeManager ", ZeroAddress);
  console.log("_receiver ", ZeroAddress);

  const felixContract = new ethers.Contract(
    FELIX_ADDRESS,
    abi,
    ethers.provider
  );
  try {
    const tx = await felixContract
      .connect(user)
      .openTrove(
        userAddress,
        0,
        ethers.parseEther("599"),
        borrowedAmount,
        upperHint,
        lowerHint,
        interestRate,
        maxUpfrontFee,
        ZeroAddress,
        ZeroAddress,
        ZeroAddress
      );
    await tx.wait();
    const id = await getTroveNFTId(userAddress);
    console.log("id ", id);
  } catch (err: any) {
    console.error("Error:", err.message);
    console.error("Stack:", err.stack); // Native JS stack
  }

  console.log(
    "feUSD balance of userAddress:",
    await feUSDContract.balanceOf(userAddress)
  );
}

async function exeAddColl(id: any) {
  const abi = ["function addColl(uint256 _troveId, uint256 _ETHAmount)"];
  const felixContract = new ethers.Contract(
    FELIX_ADDRESS,
    abi,
    ethers.provider
  );
  const tx = await felixContract
    .connect(user)
    .addColl(id, ethers.parseEther("1"));
  await tx.wait();
  const nftId = await getTroveNFTId(await user.getAddress());
  console.log("nftId ", nftId);
}

async function exeWithdrawColl(id: any) {
  const abi = ["function withdrawColl(uint256 _troveId, uint256 _amount)"];
  const felixContract = new ethers.Contract(
    FELIX_ADDRESS,
    abi,
    ethers.provider
  );
  const tx = await felixContract
    .connect(user)
    .withdrawColl(id, ethers.parseEther("1"));
  await tx.wait();
  const nftId = await getTroveNFTId(await user.getAddress());
  console.log("nftId ", nftId);
}

async function exeRepayFeUsd(id: any, amount: any) {
  const approveTx = await feUSDContract
    .connect(user)
    .approve(FELIX_ADDRESS, ethers.parseUnits("10", 18));
  await approveTx.wait();

  const abi = ["function repayfeUSD(uint256 _troveId, uint256 _amount)"];
  const felixContract = new ethers.Contract(
    FELIX_ADDRESS,
    abi,
    ethers.provider
  );
  const tx = await felixContract.connect(user).repayfeUSD(id, amount);
  await tx.wait();
  const nftId = await getTroveNFTId(await user.getAddress());
  console.log("nftId ", nftId);

  console.log(
    "feUSD balance of userAddress:",
    await feUSDContract.balanceOf(await user.getAddress())
  );
}

async function logTroveInformation(id: any) {
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
  await setUpContract();
  await setupWHype();
  await modifyMaxCapacity();
  // await exeOpenTrove();
  //  await exeAddColl(BigInt("19262044746572279107556133973402074384256429917906265770874193274084971297092"));
  //  await exeWithdrawColl(BigInt("19262044746572279107556133973402074384256429917906265770874193274084971297092"));
  // await logTroveInformation(
  //   BigInt(
  //     "19262044746572279107556133973402074384256429917906265770874193274084971297092"
  //   )
  // );
  //   await exeRepayFeUsd(
  //     BigInt(
  //       "19262044746572279107556133973402074384256429917906265770874193274084971297092"
  //     ),
  //     ethers.parseUnits("10", 18)
  //   );
  //   await findHints(0, ethers.parseUnits("0.0225", 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
