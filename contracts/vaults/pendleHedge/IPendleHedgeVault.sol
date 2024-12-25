// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IPendleHedgeVault {
    function depositRollOverMaturity(
        uint256 _ptAmount,
        uint256 _scAmount
    ) external;
}
