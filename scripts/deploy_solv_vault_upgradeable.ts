// Note: Should update priceConsumerAddress and redeploy camelotSwapContract before deploy the vault in next release
import { ethers, upgrades, network } from 'hardhat';

import { CHAINID, GOEFR_ADDRESS, GOEFS_ADDRESS, POOL_SOLV_WBTC, SOLV_ADDRESS, WBTC_ADDRESS, WBTC_IMPERSONATED_SIGNER_ADDRESS, WETH_IMPERSONATED_SIGNER_ADDRESS } from '../constants';
import * as Contracts from '../typechain-types';

const chainId: CHAINID = network.config.chainId ?? 0;
console.log('chainId ', chainId);

const admin = '';

const wbtcAddress = WBTC_ADDRESS[chainId] || '';
const tokenGOEFSAddress = GOEFS_ADDRESS[chainId] || '';
const tokenGOEFRAddress = GOEFR_ADDRESS[chainId] || '';
const solvAddress = SOLV_ADDRESS[chainId] || '';
const poolId = POOL_SOLV_WBTC[chainId] || '';
/** TEST */
// ether mainnet wallet

let solvVault: Contracts.SolvVault;

async function deploySolvVault() {
    const solvVaultFactory = await ethers.getContractFactory(
        'SolvVault'
    );

    solvVault = await upgrades.deployProxy(
        solvVaultFactory,
        [
            admin,
            solvAddress,
            wbtcAddress,
            tokenGOEFSAddress,
            tokenGOEFRAddress,
            poolId,
            8,
            BigInt(1 * 1e5),
            BigInt(10000 * 1e8),
        ],
        { initializer: 'initialize' }
    );

    await solvVault.waitForDeployment();

    console.log(
        'deploy solvVault successfully: %s',
        await solvVault.getAddress()
    );
}

async function main() {
    const [deployer] = await ethers.getSigners();

    console.log(
        'Deploying contracts with the account:',
        await deployer.getAddress()
    );

    // MAINNET
    await deploySolvVault();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
