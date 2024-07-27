import { ethers, network } from "hardhat";
import {
  CHAINID,
  AddressZero,
  KYBER_SWAP_ROUTER_ADDRESS,
  PRICE_CONSUMER_ADDRESS,
} from "../../constants";

const chainId: CHAINID = network.config.chainId ?? 0;
console.log("chainId ", chainId);

const swapRouterAddress = KYBER_SWAP_ROUTER_ADDRESS[chainId] || AddressZero;
const priceConsumerAddress = PRICE_CONSUMER_ADDRESS[chainId] || AddressZero;

import * as Contracts from "../../typechain-types";

let swapAggregatorContract: Contracts.KyberSwapAggregator;

async function deploySwapAggregatorContract() {
  const factory = await ethers.getContractFactory("KyberSwapAggregator");
  swapAggregatorContract = await factory.deploy(
    swapRouterAddress,
    priceConsumerAddress
  );
  await swapAggregatorContract.waitForDeployment();

  console.log(
    "Deployed swap aggregator contract at address %s",
    await swapAggregatorContract.getAddress()
  );
}

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log(
    "Deploying contracts with the account:",
    await deployer.getAddress()
  );

  await deploySwapAggregatorContract();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
