const { ethers, network, upgrades } = require('hardhat');
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
const hre = require('hardhat');
const chainId: CHAINID = network.config.chainId;
const poolId = "0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e";
const openFundShareId = 0;
const currentcyAmount = 2 * 1e8;
const valueRedeem = 2 * 1e8;

console.log("chainId: ", chainId);

describe("Integrate with Solv", async () => {
    let admin: Signer;
    let wbtc: Contracts.IERC20;
    let weth: Contracts.IERC20;
    let tokenGOEFS: Contracts.IERC721;
    let solvVaultContract: Contracts.SolvVault;

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

    async function deploySolvVault() {
        const factory = await ethers.getContractFactory('SolvVault');
        
        solvVaultContract = await upgrades.deployProxy(
            factory,
            [
                await admin.getAddress(),
                solvAddress,
                wbtcAddress,
                tokenGOEFSAddress,
                poolId,
                8,
                BigInt(1 * 1e5),
                BigInt(10000 * 1e8),
            ],
            { initializer: 'initialize' }
        );

        await solvVaultContract.waitForDeployment();

        console.log("Deployed solv integrate at address %s", await solvVaultContract.getAddress());
    }

    beforeEach(async () => {
        [admin] = await ethers.getSigners();
        wbtc = await ethers.getContractAt('IERC20', wbtcAddress);
        weth = await ethers.getContractAt('IERC20', wethAddress);
        tokenGOEFS = await ethers.getContractAt("IERC721", tokenGOEFSAddress);
        
        await deploySolvVault();

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

    // it("Should revert if currency amount equal zero", async () => {
    //     await expect(
    //         solvVaultContract
    //             .connect(admin)
    //             .deposit(
    //                 '0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e',
    //                 1 * 1e4,
    //                 0
    //             )
    //     ).to.be.revertedWith('MIN_AMOUNT');
    // })

    // it('Should revert if amount min', async () => {
    //     await expect(
    //         solvVaultContract
    //             .connect(admin)
    //             .deposit(
    //                 '0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e',
    //                 0,
    //                 0
    //             )
    //     ).to.be.revertedWith('MIN_AMOUNT');
    // });

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

        await wbtc.connect(admin).approve(solvVaultContract.getAddress(), 20 * 1e8);

        //subscribe to solv
        await solvVaultContract.connect(admin).deposit(
            poolId,
            2 * 1e8,
            openFundShareId
        );

        const solvBalance = await wbtc.balanceOf(solvVaultContract.getAddress());

        //before run test this case, change user in contract to public
        const user = await solvVaultContract.user(admin.getAddress())

        const count = await solvVaultContract.tokensOfOwner(solvVaultContract.getAddress());

        console.log("List token of solvContract ", count);

        expect(solvBalance).to.equal(0);
        expect(user.owner).to.equal(await admin.getAddress());
        expect(user.poolId).to.equal(poolId);
        expect(user.currentcyAmount).to.equal(2 * 1e8);
    });

    // it("Request redeem wbtc - happy part", async () => {
    //     console.log('----------------Request redeem wbtc----------------');
    //     const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

    //     console.log(
    //         'Balance of signer wbtc ',
    //         await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress())
    //     );

    //     // Transfer WBTC from wbtcSigner to admin
    //     await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

    //     const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());

    //     console.log('Subscribe wbtc => balance admin: ', balance);

    //     await wbtc.connect(admin).approve(solvVaultContract.getAddress(), 2 * 1e8);

    //     //subscribe to solv
    //     await solvVaultContract
    //         .connect(admin)
    //         .subscribe(poolId, valueRedeem, openFundShareId, true);

    //     const count = await solvVaultContract.tokensOfOwner(
    //         solvVaultContract.getAddress()
    //     );

    //     console.log('List token of solvContract ', count);

    //     const balanceAdminBefore = await wbtc
    //         .connect(admin)
    //         .balanceOf(await admin.getAddress());

    //     console.log('NINVB => balanceAdmin before ', balanceAdminBefore);

    //     const hx = await solvVaultContract.requestRedeem(
    //         poolId,
    //         4310,
    //         0,
    //         currentcyAmount
    //     );
    //     await hx.wait();

    //     // console.log("NINVB => hx ", hx);

    //     console.log('List token of solvContract ', count);

    //     //before run test this case, change user in contract to public
    //     const user = await solvVaultContract.user(admin.getAddress());

    //     const solvBalance = await wbtc.balanceOf(solvVaultContract.getAddress());

    //     const balanceAdmin = await wbtc.connect(admin).balanceOf(await admin.getAddress());

    //     console.log("NINVB => balanceAdmin ", balanceAdmin);
        
    //     expect(solvBalance).to.equal(0);
    //     expect(user.currentcyAmount).to.equal(1*1e8);
    // })
})