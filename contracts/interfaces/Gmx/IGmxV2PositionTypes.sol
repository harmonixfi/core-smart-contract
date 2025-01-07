// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IGmxV2PositionTypes {
    struct Position {
        uint256 sizeInUsd;
        address market;
        uint256 borrowingFactor;
        uint256 borrowingExponent;
    }
}
