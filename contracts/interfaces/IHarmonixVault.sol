// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IHarmonixVault {
    function totalValueLocked() external view returns (uint256);
}
