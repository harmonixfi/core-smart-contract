// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

struct VaultParamsPendle {
    uint8 decimals;
    address asset;
    uint256 minimumSupply;
    uint256 cap;
    uint256 performanceFeeRate;
    uint256 managementFeeRate;
}

struct VaultStatePendle {
    uint256 withdrawPoolAmount;
    uint256 pendingDepositAmount;
    uint256 totalShares;
    uint256 totalFeePoolAmount;
    uint256 lastUpdateManagementFeeDate;
}

struct DepositReceiptPendle {
    uint256 shares;
    uint256 depositAmount;
    address ptToken;
}