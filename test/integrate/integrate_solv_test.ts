const { ethers, network } = require("hardhat");
import * as Contracts from "../../typechain-types";
import {
    CHAINID,
    GOEFS_ADDRESS,
    SOLV_ADDRESS,
    WBTC_ADDRESS,
    WBTC_IMPERSONATED_SIGNER_ADDRESS,
    WETH_ADDRESS,
    WETH_IMPERSONATED_SIGNER_ADDRESS
} from "../../constants";
import { BigNumberish, Signer } from 'ethers';
import { expect } from "chai";
const { BigNumber } = require('ethers');
const hre = require('hardhat');
const chainId: CHAINID = network.config.chainId;
const poolId = "0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e";
const openFundShareId = 0;
const currentcyAmount = 1 * 1e8;
const valueRedeem = 2 * 1e8;

console.log("chainId: ", chainId);

describe("Integrate with Solv", async () => {
    let admin: Signer;
    let wbtc: Contracts.IERC20;
    let weth: Contracts.IERC20;
    let tokenGOEFS: Contracts.IERC721;
    let solvContract: Contracts.Solv;

    const wbtcAddress = WBTC_ADDRESS[chainId] || "";
    const wethAddress = WETH_ADDRESS[chainId] || "";
    const tokenGOEFSAddress = GOEFS_ADDRESS[chainId] || "";
    const wbtcImpersonatedSigner = WBTC_IMPERSONATED_SIGNER_ADDRESS[chainId] || '';
    const wethImpersonatedSigner = WETH_IMPERSONATED_SIGNER_ADDRESS[chainId] || '';
    const solvAddress = SOLV_ADDRESS[chainId] || "";

    async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
        const transferTx = await token.connect(from).transfer(to, amount);
        await transferTx.wait();
    }

    async function deploySolvIntegrate() {
        const factory = await ethers.getContractFactory('Solv');
        solvContract = await factory.deploy(
            solvAddress,
            wbtcAddress,
            wethAddress,
            tokenGOEFSAddress
        )
        await solvContract.waitForDeployment();

        console.log("Deployed solv integrate at address %s", await solvContract.getAddress());
    }

    beforeEach(async () => {
        [admin] = await ethers.getSigners();
        wbtc = await ethers.getContractAt('IERC20', wbtcAddress);
        weth = await ethers.getContractAt('IERC20', wethAddress);
        tokenGOEFS = await ethers.getContractAt("IERC721", tokenGOEFSAddress);

        await deploySolvIntegrate();

        await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [wbtcImpersonatedSigner],
        });

        await hre.network.provider.request({
            method: 'hardhat_impersonateAccount',
            params: [wethImpersonatedSigner],
        });
    })

    afterEach(async () => {
        await hre.network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [wbtcImpersonatedSigner],
        });

        await hre.network.provider.request({
            method: 'hardhat_stopImpersonatingAccount',
            params: [wethImpersonatedSigner],
        });
    })

    it("Should revert if currency amount equal zero", async () => {
        await expect(
            solvContract
                .connect(admin)
                .subscribe(
                    '0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e',
                    0,
                    0,
                    true
                )
        ).to.be.revertedWith('INVALID_SUBSCRIBE_AMOUNT');
    })

    it('Subscribe wbtc - happy part', async () => {
        console.log('--------subscribe wbtc with solv happy part--------');
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
            currentcyAmount,
            openFundShareId,
            true
        );

        const solvBalance = await wbtc.balanceOf(solvContract.getAddress());

        //before run test this case, change user in contract to public
        const user = await solvContract.user(admin.getAddress())

        const count = await solvContract.tokensOfOwner(solvContract.getAddress());

        console.log("List token of solvContract ", count);

        expect(solvBalance).to.equal(0);
        expect(user.owner).to.equal(await admin.getAddress());
        expect(user.poolId).to.equal(poolId);
        expect(user.currentcyAmount).to.equal(currentcyAmount);
    });

    it("Request redeem wbtc - happy part", async () => {
        console.log('----------------Request redeem wbtc----------------');
        const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

        console.log(
            'Balance of signer wbtc ',
            await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress())
        );

        // Transfer WBTC from wbtcSigner to admin
        await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

        const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());

        console.log('Subscribe wbtc => balance admin: ', balance);

        await wbtc.connect(admin).approve(solvContract.getAddress(), 2 * 1e8);

        //subscribe to solv
        await solvContract
            .connect(admin)
            .subscribe(poolId, valueRedeem, openFundShareId, true);

        const count = await solvContract.tokensOfOwner(
            solvContract.getAddress()
        );

        console.log('List token of solvContract ', count);

        await solvContract.requestRedeem(
            poolId,
            4310,
            0,
            currentcyAmount
        );

        console.log('List token of solvContract ', count);

        //before run test this case, change user in contract to public
        const user = await solvContract.user(admin.getAddress());

        const solvBalance = await wbtc.balanceOf(solvContract.getAddress());

        expect(solvBalance).to.equal(0);
        expect(user.currentcyAmount).to.equal(1*1e8);
    })

    // it('Subscribe weth - happy part', async () => {
    //     console.log('--------subscribe weth with solv--------');

    //     const tx1 = await admin.sendTransaction({
    //         to: wethImpersonatedSigner,
    //         value: ethers.parseEther('2'),
    //     });

    //     const wethSigner = await ethers.getImpersonatedSigner(
    //         wethImpersonatedSigner
    //     );

    //     const transferTx0 = await weth
    //         .connect(wethSigner)
    //         .transfer(admin, ethers.parseEther('20'));
    //     await transferTx0.wait();

    //     const balance = await weth.connect(admin).balanceOf(admin.getAddress());

    //     console.log('Subscribe weth => balance admin: ', balance);

    //     const wethAmount = ethers.parseUnits('2', 18);

    //     // Transfer WETH to the contract
    //     await weth.connect(admin).transfer(solvContract.getAddress(), wethAmount);

    //     // Check WETH balance in the contract before subscribe
    //     const contractBalance = await weth.balanceOf(solvContract.getAddress());
    //     console.log('WETH Balance of contract: ', contractBalance.toString());

    //     // Approve the contract to use the WETH
    //     await weth.connect(admin).approve(solvContract.getAddress(), wethAmount);
        
    //     //subscribe to solv
    //     await solvContract
    //         .connect(admin)
    //         .subscribe(poolId, wethAmount, openFundShareId, false);

    //     console.log('NINVB => vao day');

    //     // const solvBalance = await wbtc.balanceOf(solvContract.getAddress());

    //     // //before run test this case, change user in contract to public
    //     // const user = await solvContract.user(admin.getAddress());

    //     // expect(solvBalance).to.equal(0);
    //     // expect(user.owner).to.equal(await admin.getAddress());
    //     // expect(user.poolId).to.equal(poolId);
    //     // expect(user.currentcyAmount).to.equal(wethAmount);
    // })
})