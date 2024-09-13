// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IPriceConsumerProxy.sol";
import "../interfaces/ISwapAggregator.sol";
import "../extensions/TransferHelper.sol";
import "hardhat/console.sol";

abstract contract BaseSwapAggregator is ISwapAggregator {
    IPriceConsumerProxy immutable internal priceConsumer;
    address immutable internal exchangeAddress;

    constructor(
        address _exchangeAddress,
        address _priceConsumer) {
        exchangeAddress = _exchangeAddress;
        priceConsumer = IPriceConsumerProxy(_priceConsumer);
    }

    function getPriceOf(
        address token0,
        address token1
    ) external view returns (uint256) {
        return priceConsumer.getPriceOf(token0, token1);
    }

    function swapTo(
        address recipient,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        bytes calldata swapCallData
    ) external override returns (uint256){
        TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
        TransferHelper.safeApprove(tokenIn, exchangeAddress, amountIn);
        
        (bool success,) = exchangeAddress.call(swapCallData);
        require(success, "SWAP_EXECUTION_FAIL");

        uint256 outTokenAmount = IERC20(tokenOut).balanceOf(address(this));
        require(outTokenAmount > 0, "SWAP_EXECUTION_FAIL_TOKEN_OUT");
        TransferHelper.safeTransfer(
            tokenOut,
            recipient,
            outTokenAmount
        );

        return outTokenAmount;
    }
}
