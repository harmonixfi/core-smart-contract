// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../lib/BaseSwap.sol";
import "../../interfaces/UniSwap/IUniswapRouter.sol";
import "hardhat/console.sol";

contract ZeroXSwap  {
    address public exchangeAddress;

    constructor(address _exchangeAddress) {
        exchangeAddress = _exchangeAddress;
    }

    function swapTo(
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        bytes calldata swapCallData
    ) external {
        IERC20(sellToken).transferFrom(msg.sender, address(this), sellAmount);
        IERC20(sellToken).approve(exchangeAddress, sellAmount);
        (bool success,) = exchangeAddress.call(swapCallData);
        require(success, "Swap execution failed");

        uint256 buyTokenAmount = IERC20(buyToken).balanceOf(address(this));
        IERC20(buyToken).transfer(msg.sender, buyTokenAmount);
    }

    function swapToWithOutput(
        address buyToken,
        address sellToken,
        uint256 buyAmount,
        bytes calldata swapCallData
    ) external {
        IERC20(sellToken).transferFrom(msg.sender, address(this), buyAmount);
        IERC20(sellToken).approve(exchangeAddress, buyAmount);
        (bool success,) = exchangeAddress.call(swapCallData);
        require(success, "Swap execution failed");

        uint256 buyTokenAmount = IERC20(buyToken).balanceOf(address(this));
        IERC20(buyToken).transfer(msg.sender, buyTokenAmount);
    }
}