const { ethers, network } = require("hardhat");
import { FundContract, FundStorage } from "../../../typechain-types";
import { CHAINID } from "../../../constants";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const adminPrivateKey = process.env.HYPE_V3_ADMIN_PRIVATE_KEY || "";
let fundStorageContract: FundStorage;
let fundContract: FundContract;

// mainnet
const fundStorageAddress = "0x933E97cA3F892411a4083D91Fa29D056FD65D270";
const fundContractAddress = "0xFde5B0626fC80E36885e2fA9cD5ad9d7768D725c";
const feeReceiverAddress = "0xb647C98e723A3730b044E38Cde967E18BE5d5F9b";

async function main() {
  const fundStorageAdmin = new ethers.Wallet(adminPrivateKey, ethers.provider);
  console.log("fundStorageAdmin ", await fundStorageAdmin.getAddress());
  fundStorageContract = await ethers.getContractAt(
    "FundStorage",
    fundStorageAddress
  );

  const role_controller =
    "0x97adf037b2472f4a6a9825eff7d2dd45e37f2dc308df2a260d6a72af4189a65b";
  await fundStorageContract
    .connect(fundStorageAdmin)
    .grantRole(role_controller, fundContractAddress);

  fundContract = await ethers.getContractAt(
    "FundContract",
    fundContractAddress
  );

  const fundContractAdmin = new ethers.Wallet(adminPrivateKey, ethers.provider);
  await fundContract.connect(fundContractAdmin).setupVault(
    BigInt(0.001 * 1e18), //_minimumSupply 0.01HYPE
    BigInt(1000000000 * 1e18), // _capacity 100m$
    BigInt(10), // _performanceFeeRate 10%
    BigInt(1), // _managementFeeRate 1%
    feeReceiverAddress, // fee receiver
    feeReceiverAddress, // fee receiver
    BigInt(0.001 * 1e18) // _networkCost 0.001HYPE
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
