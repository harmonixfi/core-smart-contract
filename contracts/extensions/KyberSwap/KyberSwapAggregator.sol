// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;


import "../../lib/BaseSwapAggregator.sol";
import "hardhat/console.sol";

contract KyberSwapAggregator is BaseSwapAggregator {
    constructor(
        address _exchangeAddress,
        address _priceConsumer
    ) BaseSwapAggregator(_exchangeAddress, _priceConsumer) {}
}