import { IERC20 } from './../../typechain-types/@openzeppelin/contracts/token/ERC20/IERC20';
const { ethers, network } = require("hardhat");

import * as Contracts from "../../typechain-types";

import {
    CHAINID,
    WBTC_ADDRESS
} from "../../constants";

import { BigNumberish, Signer } from "ethers";

const chainId: CHAINID = network.config.chainId;

describe("Integrate with Solv", async () => {
    let admin: Signer
    let wbtc: Contracts.IERC20
    const wbtcAddress = WBTC_ADDRESS[chainId] || "";

    async function transferForUser(token: Contracts.IERC20, from: Signer, to: Signer, amount: BigNumberish) {
        const transferTx = await token.connect(from).transfer(to, amount);
        await transferTx.wait();
    }

    beforeEach(async () => {
        [admin] = await ethers.getSigners();
        wbtc = await ethers.getContractAt('IERC20', wbtcAddress);
    })

    it("Subscribe wbtc", async () => {
        console.log("--------subscribe wbtc with solv--------");
        console.log("NINVB => balance ", await wbtc.connect(admin).balanceOf(admin));
        
    })
})