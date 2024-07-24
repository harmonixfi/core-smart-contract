const { ethers, network } = require('hardhat');

import * as Contracts from '../../typechain-types';
import { CHAINID, GOEFR_ADDRESS, WBTC_ADDRESS } from '../../constants';
import { BigNumberish, Contract, Signer } from 'ethers';

const chainId: CHAINID = network.config.chainId;

console.log('Chain Id: ' + chainId);

describe('Claim form Solv', async () => {
    let wbtc: Contracts.IERC20;

    const tokenGOEFRAddress = GOEFR_ADDRESS[chainId] || '';
    const wbtcAddress = WBTC_ADDRESS[chainId] || '';

    beforeEach(async function () {
        wbtc = await ethers.getContractAt('IERC20', wbtcAddress);
    });

    it('Claim from Solv', async () => {
        const admin = await ethers.getImpersonatedSigner(
            '0xBC05da14287317FE12B1a2b5a0E1d756Ff1801Aa'
        );
        let adminBalance = await wbtc.connect(admin).balanceOf(admin);
        console.log('wbtc of user before deposit %s', adminBalance);
            
        const GOEFR = await ethers.getContractAt(
            'ITokenGOEFR',
            tokenGOEFRAddress
        );

        await GOEFR.connect(admin).claimTo(
            admin.getAddress(),
            2607,
            wbtc.getAddress(),
            1401041011299379
        );

        console.log('NINVB => vao day');
    });
});
