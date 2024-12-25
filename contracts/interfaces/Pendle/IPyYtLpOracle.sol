// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IPyYtLpOracle {
    function getPtToAssetRate(address market, uint32 duration) external view returns(uint256);
}