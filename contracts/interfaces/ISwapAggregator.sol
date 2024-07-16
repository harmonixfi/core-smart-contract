// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface ISwapAggregator {
    function swapTo(address recipient, address tokenIn, uint256 amountIn, address tokenOut, bytes calldata swapCallData) external returns (uint256);
    function getPriceOf(address token0, address token1) external view returns (uint256);
}