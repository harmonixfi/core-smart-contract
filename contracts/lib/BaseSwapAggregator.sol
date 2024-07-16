// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../interfaces/IPriceConsumerProxy.sol";
import "../interfaces/ISwapAggregator.sol";
import "hardhat/console.sol";

abstract contract BaseSwapAggregator is ISwapAggregator {
    IPriceConsumerProxy internal priceConsumer;
    address internal owner;

    constructor(
        address _admin,
        address _priceConsumer) {
        priceConsumer = IPriceConsumerProxy(_priceConsumer);
        owner = _admin;
    }

    function getPriceOf(
        address token0,
        address token1
    ) external view returns (uint256) {
        return priceConsumer.getPriceOf(token0, token1);
    }

    function swapTo(address recipient, address tokenIn, uint256 amountIn, address tokenOut, bytes calldata swapCallData) external virtual returns (uint256) {}
}
