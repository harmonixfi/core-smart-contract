// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

struct DepositReceipt {
    uint256 shares;
    uint256 depositAmount;
}

struct Withdrawal {
    uint256 shares;
}

struct VaultParams {
    uint8 decimals;
    address asset;
    uint256 minimumSupply;
    uint256 cap;
}

struct VaultState {
    uint256 totalShares;
}