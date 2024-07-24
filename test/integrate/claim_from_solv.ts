const { ethers, network } = require('hardhat');

import * as Contracts from '../../typechain-types';
import { CHAINID, GOEFR_ADDRESS, WBTC_ADDRESS, WETH_ADDRESS, WETH_IMPERSONATED_SIGNER_ADDRESS } from '../../constants';
import { BigNumberish, Contract, Signer } from 'ethers';

const chainId: CHAINID = network.config.chainId;

console.log('Chain Id: ' + chainId);

describe('Claim form Solv', async () => {
    let wbtc: Contracts.IERC20;
    let weth: Contracts.IERC20;

    const tokenGOEFRAddress = GOEFR_ADDRESS[chainId] || '';
    const wbtcAddress = WBTC_ADDRESS[chainId] || '';
    const wethAddress = WETH_ADDRESS[chainId] || '';
    const wethImpersonated = WETH_IMPERSONATED_SIGNER_ADDRESS[chainId];

    beforeEach(async function () {
        wbtc = await ethers.getContractAt('IERC20', wbtcAddress);
        weth = await ethers.getContractAt('IERC20', wethAddress);
    });

    it('Claim from Solv', async () => {
        const admin = await ethers.getImpersonatedSigner(
            '0xBC05da14287317FE12B1a2b5a0E1d756Ff1801Aa'
        );
        const wethSigner = await ethers.getImpersonatedSigner(wethImpersonated);
        
        await ethers.provider.send('hardhat_setBalance', [
            wethImpersonated,
            '0x1000000000000000000',
        ]);
        await wethSigner.sendTransaction({
            to: admin,
            value: ethers.parseEther('0.5'),
        });
        
        let adminBalance = await wbtc.connect(admin).balanceOf(admin);
        console.log('wbtc of user before deposit %s', adminBalance);

        const GOEFR = await ethers.getContractAt(
            'ITokenGOEFR',
            tokenGOEFRAddress
        );
        
        await GOEFR.connect(admin).claimTo(
            await admin.getAddress(),
            2607,
            await wbtc.getAddress(),
            1401041011299379
        );
    });
});
