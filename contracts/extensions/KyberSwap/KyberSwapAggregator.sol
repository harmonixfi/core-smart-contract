// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../lib/BaseSwapAggregator.sol";
import "hardhat/console.sol";

contract KyberSwapAggregator is BaseSwapAggregator {
    address public exchangeAddress;

    constructor(
        address _admin,
        address _exchangeAddress,
        address _priceConsumer
    ) BaseSwapAggregator(_admin, _priceConsumer) {
        exchangeAddress = _exchangeAddress;
    }

    function swapTo(
        address recipient,
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        bytes calldata swapCallData
    ) external override returns (uint256){
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(exchangeAddress, amountIn);
        
        (bool success,) = exchangeAddress.call(swapCallData);
        require(success, "SWAP_EXECUTION_FAIL");

        uint256 outTokenAmount = IERC20(tokenOut).balanceOf(address(this));
        IERC20(tokenOut).transfer(recipient, outTokenAmount);
        return outTokenAmount;
    }
}