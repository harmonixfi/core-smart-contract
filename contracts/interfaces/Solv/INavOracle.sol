// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface INavOracle {
    function getSubscribeNav(
        bytes32 _poolId,
        uint256 _time
    ) external view returns (uint256 _nav, uint256 _navTime);
}
