const { ethers, network, upgrades } = require('hardhat');
import * as Contracts from "../../typechain-types";
import {
    CHAINID,
    GOEFR_ADDRESS,
    GOEFS_ADDRESS,
    SOLV_ADDRESS,
    WBTC_ADDRESS,
    WBTC_IMPERSONATED_SIGNER_ADDRESS
} from "../../constants";
import { BigNumberish, Signer } from 'ethers';
import { expect } from "chai";
const hre = require('hardhat');
const chainId: CHAINID = network.config.chainId;
const poolId = "0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e";

console.log("chainId: ", chainId);
let admin: Signer;
let user1: Signer;
let wbtc: Contracts.IERC20;
let tokenGOEFS: Contracts.IERC721;
let tokenGOEFR: Contracts.IERC721;
let solvVaultContract: Contracts.SolvVault;

const wbtcAddress = WBTC_ADDRESS[chainId] || '';
const tokenGOEFSAddress = GOEFS_ADDRESS[chainId] || '';
const tokenGOEFRAddress = GOEFR_ADDRESS[chainId] || '';
const wbtcImpersonatedSigner = WBTC_IMPERSONATED_SIGNER_ADDRESS[chainId] || '';
const solvAddress = SOLV_ADDRESS[chainId] || '';

async function transferForUser(
    token: Contracts.IERC20,
    from: Signer,
    to: Signer,
    amount: BigNumberish
) {
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
            tokenGOEFRAddress,
            poolId,
            8,
            BigInt(1 * 1e5),
            BigInt(10000 * 1e8),
        ],
        { initializer: 'initialize' }
    );

    await solvVaultContract.waitForDeployment();

    console.log(
        'Deployed solv integrate at address %s',
        await solvVaultContract.getAddress()
    );
}

beforeEach(async () => {
    [admin, user1] = await ethers.getSigners();
    wbtc = await ethers.getContractAt('IERC20', wbtcAddress);
    tokenGOEFS = await ethers.getContractAt('IERC721', tokenGOEFSAddress);
    tokenGOEFR = await ethers.getContractAt('IERC721', tokenGOEFRAddress);

    await deploySolvVault();

    await hre.network.provider.request({
        method: 'hardhat_impersonateAccount',
        params: [wbtcImpersonatedSigner],
    });
});

afterEach(async () => {
    await hre.network.provider.request({
        method: 'hardhat_stopImpersonatingAccount',
        params: [wbtcImpersonatedSigner],
    });
});

describe("Deposit to Solv", async () => {
    it("Deposit - check amount smaller minimum supply", async () => {
        await expect(
            solvVaultContract
                .connect(admin)
                .deposit(
                    1 * 1e4
                )
        ).to.be.revertedWith('MIN_AMOUNT');
        
    })

    it('Deposit - check amount bigger cap', async () => {
        await expect(
            solvVaultContract
                .connect(admin)
                .deposit(BigInt(20000 * 1e8))
        ).to.be.revertedWith('EXCEED_CAP');
    });

    it('Deposit wbtc - happy part', async () => {
        const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

        console.log("Balance of signer wbtc ", await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress()));

        // Transfer WBTC from wbtcSigner to admin
        await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

        const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());
        
        console.log(
            'Deposit wbtc => balance admin: ', balance
        );

        await wbtc.connect(admin).approve(solvVaultContract.getAddress(), 20 * 1e8);

        //subscribe to solv
        await solvVaultContract.connect(admin).deposit(
            2 * 1e8
        );

        //to test this case, change getLatestToken function is external
        const tokenLatest = await solvVaultContract.getLatestToken(tokenGOEFS);

        console.log("Token latest: ", tokenLatest);

        const solvBalance = await wbtc.balanceOf(solvVaultContract.getAddress());

        expect(solvBalance).to.equal(0);
    });

    it('Deposit wbtc - happy part - double deposit', async () => {
        const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

        console.log(
            'Balance of signer wbtc ',
            await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress())
        );

        // Transfer WBTC from wbtcSigner to admin
        await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

        const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());

        console.log('Deposit wbtc => balance admin: ', balance);

        await wbtc
            .connect(admin)
            .approve(solvVaultContract.getAddress(), 20 * 1e8);

        //subscribe to solv
        await solvVaultContract.connect(admin).deposit(2 * 1e8);

        //to test this case, change getLatestToken function is external
        const tokenLatestFirst =
            await solvVaultContract.getLatestToken(tokenGOEFS);

        console.log('Token latest first: ', tokenLatestFirst);

        //shares = 1884364094154475514 when subscribe 2 * 1e8
        const shares = 1884364094154475514;

        await expect(
            solvVaultContract.initiateWithdrawal(BigInt(shares * 2))
        ).to.be.revertedWith('INVALID_SHARES');
    });

    it("Initiate withdraw - deposit shares smaller shares withdraw", async () => {
        const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

        console.log(
            'Balance of signer wbtc ',
            await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress())
        );

        // Transfer WBTC from wbtcSigner to admin
        await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

        const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());

        console.log('Deposit wbtc => balance admin: ', balance);

        await wbtc
            .connect(admin)
            .approve(solvVaultContract.getAddress(), 20 * 1e8);

        //subscribe to solv
        await solvVaultContract.connect(admin).deposit(2 * 1e8);

        //to test this case, change getLatestToken function is external
        const tokenLatestFirst =
            await solvVaultContract.getLatestToken(tokenGOEFS);

        const balanceOf = await solvVaultContract.connect(admin).balanceOf(await admin.getAddress());

        console.log('balanceOf admin: ', balanceOf);

        const hx = await solvVaultContract.initiateWithdrawal(balanceOf);

        expect(hx).to.not.equal(undefined || null);
    })

    it("Request redeem - not admin call", async () => {
        //shares = 1884364094154475514 when subscribe 2 * 1e8
        const shares = 1884364094154475000;
        expect(
            solvVaultContract.connect(user1).initiateWithdrawal(shares)
        ).to.be.revertedWith('ROCK_ONYX_ADMIN_ROLE_ERROR');
    })

    it("Request redeem - happy part", async () => {
        const wbtcSigner = await ethers.getSigner(wbtcImpersonatedSigner);

        console.log(
            'Balance of signer wbtc ',
            await wbtc.connect(wbtcSigner).balanceOf(wbtcSigner.getAddress())
        );

        // Transfer WBTC from wbtcSigner to admin
        await transferForUser(wbtc, wbtcSigner, admin, 20 * 1e8);

        const balance = await wbtc.connect(admin).balanceOf(admin.getAddress());

        console.log('Deposit wbtc => balance admin: ', balance);

        await wbtc
            .connect(admin)
            .approve(solvVaultContract.getAddress(), 20 * 1e8);

        //subscribe to solv
        await solvVaultContract.connect(admin).deposit(2 * 1e8);

        //to test this case, change getLatestToken function is external
        const tokenLatestFirst =
            await solvVaultContract.getLatestToken(tokenGOEFS);

        console.log('Token latest first: ', tokenLatestFirst);

        const balanceOf = await solvVaultContract.connect(admin).balanceOf(await admin.getAddress());

        console.log('balanceOf admin: ', balanceOf);

        const hx = await solvVaultContract.initiateWithdrawal(balanceOf);

        expect(hx).to.not.equal(undefined || null);
    })
})