const { ethers, network } = require("hardhat");
import * as Contracts from "../../typechain-types";
import {
    CHAINID,
    SOLV_ADDRESS,
    WBTC_ADDRESS,
    WBTC_IMPERSONATED_SIGNER_ADDRESS
} from "../../constants";
import { BigNumberish, Signer } from 'ethers';
const { BigNumber } = require('ethers');
const hre = require('hardhat');
const chainId: CHAINID = network.config.chainId;

console.log("chainId: ", chainId);

describe("Integrate with Solv", async () => {
    let admin: Signer;
    let wbtc: Contracts.IERC20;
    let solvContract: Contracts.Solv;

    const wbtcAddress = WBTC_ADDRESS[chainId] || "";
    const wbtcImpersonatedSigner = WBTC_IMPERSONATED_SIGNER_ADDRESS[chainId] || '';
    const solvAddress = SOLV_ADDRESS[chainId] || "";

    async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
        const transferTx = await token.connect(from).transfer(to, amount);
        await transferTx.wait();
    }

    async function deploySolvIntegrate() {
        const factory = await ethers.getContractFactory('Solv');
        solvContract = await factory.deploy(
            solvAddress,
            wbtcAddress
        )
        await solvContract.waitForDeployment();

        console.log("Deployed solv integrate at address %s", await solvContract.getAddress());
    }

    beforeEach(async () => {
        [admin] = await ethers.getSigners();
        wbtc = await ethers.getContractAt('IERC20', wbtcAddress);

        await deploySolvIntegrate();

        await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [wbtcImpersonatedSigner],
        });
    })

    afterEach(async () => {
        await hre.network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [wbtcImpersonatedSigner],
        });
    })

    it('Subscribe wbtc', async () => {
        console.log('--------subscribe wbtc with solv--------');
        const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

        console.log("Balance of signer wbtc ", await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress()));

        // Transfer WBTC from wbtcSigner to admin
        await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

        const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());
        
        console.log(
            'Subscribe wbtc => balance admin: ', balance
        );

        //subscribe to solv
        await solvContract.subscribe(
            "0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e",
            1 * 1e8,
            0
        );
    });
})