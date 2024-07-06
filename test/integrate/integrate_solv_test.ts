const { ethers, network } = require("hardhat");
import * as Contracts from "../../typechain-types";
import {
    CHAINID,
    SOLV_ADDRESS,
    WBTC_ADDRESS,
    WBTC_IMPERSONATED_SIGNER_ADDRESS
} from "../../constants";
import { BigNumberish, Signer } from 'ethers';
import { expect } from "chai";
const { BigNumber } = require('ethers');
const hre = require('hardhat');
const chainId: CHAINID = network.config.chainId;
const poolId = "0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e";
const openFundShareId = 0;
const currentCyAmount = 1 * 1e8;

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

    it("Should revert if currency amount equal zero", async () => {
        await expect(
            solvContract
                .connect(admin)
                .subscribe(
                    '0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e',
                    0,
                    0
                )
        ).to.be.revertedWith('INVALID_SUBSCRIBE_AMOUNT');
    })

    it('Subscribe wbtc - happy part', async () => {
        console.log('--------subscribe wbtc with solv--------');
        const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

        console.log("Balance of signer wbtc ", await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress()));

        // Transfer WBTC from wbtcSigner to admin
        await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

        const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());
        
        console.log(
            'Subscribe wbtc => balance admin: ', balance
        );

        await wbtc.connect(admin).approve(solvContract.getAddress(), 1 * 1e8);

        //subscribe to solv
        await solvContract.connect(admin).subscribe(
            poolId,
            currentCyAmount,
            openFundShareId
        );

        const solvBalance = await wbtc.balanceOf(solvContract.getAddress());

        //before run test this case, change user in contract to public
        const user = await solvContract.user(admin.getAddress())

        expect(solvBalance).to.equal(0);
        expect(user.owner).to.equal(await admin.getAddress());
        expect(user.poolId).to.equal(poolId);
        expect(user.currentcyAmount).to.equal(currentCyAmount);
        
        console.log("NINVB => support ", await solvContract.supportsInterface());
        
    });
})