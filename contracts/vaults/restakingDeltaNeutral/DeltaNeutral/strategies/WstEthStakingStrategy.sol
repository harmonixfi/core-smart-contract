// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../../../interfaces/IWETH.sol";
import "./../../Base/strategies/BaseRestakingStrategy.sol";
import "./../../Base/BaseSwapVault.sol";

contract WstEthStakingStrategy is BaseRestakingStrategy {
    IERC20 private stakingToken;

    function ethRestaking_Initialize(
        address _restakingToken,
        address _usdcAddress,
        address _ethAddress,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees,
        uint64 _network
    ) internal override
    {
        super.ethRestaking_Initialize(_restakingToken, _usdcAddress, _ethAddress, _swapAddress, _token0s, _token1s, _fees, _network);
    }

    function syncRestakingBalance() internal override{
        uint256 restakingTokenAmount = restakingToken.balanceOf(address(this));
        uint256 ethAmount = restakingTokenAmount * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
        restakingState.totalBalance = restakingState.unAllocatedBalance + ethAmount * swapProxy.getPriceOf(address(ethToken), address(usdcToken)) / 1e18;
    }

    function depositToRestakingProxy(uint256 ethAmount, bytes calldata swapCallData) external override nonReentrant{
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        ethToken.approve(address(swapProxy), ethAmount);
            swapAggregator.swapTo(
                address(this),
                address(ethToken),
                ethAmount,
                address(restakingToken),
                swapCallData
            );
    }

    function withdrawFromRestakingProxy(uint256 restakingTokenAmount, bytes calldata swapCallData) external override nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        restakingToken.approve(address(swapProxy), restakingTokenAmount);
        swapAggregator.swapTo(
            address(this),
            address(restakingToken),
            restakingTokenAmount,
            address(ethToken),
            swapCallData
        );
    }
}