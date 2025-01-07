// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface IDeltaNeutralNavReader {
    function getAccountValue(address user) external view returns (uint256);
}
