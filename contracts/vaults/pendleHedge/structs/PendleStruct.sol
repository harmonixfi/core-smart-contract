// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

struct VaultParamsPendle {
    address ptAddress;
    uint8 ptDecimals;
    address scAddress;
    uint8 scDecimals;
    address uaAddress;
    uint8 uaDecimals;
    uint256 minimumSupply; // by pt token
    uint256 cap;
    uint256 performanceFeeRate;
    uint256 managementFeeRate;
}

struct VaultStatePendle {
    address oldPtTokenAddress;
    uint256 pps;
    uint256 ptWithdrawPoolAmount;
    uint256 scWithdrawPoolAmount;
    uint256 totalPtAmount;
    uint256 totalShares;
    uint256 totalFeePoolAmount;
    uint256 lastUpdateManagementFeeDate;
}

struct DepositReceiptPendle {
    uint256 shares;
    uint256 depositAmount;
    uint256 depositPtAmount;
    uint256 depositScAmount;
}

struct WithdrawPendle {
    uint256 shares;
    uint256 performanceFee;
    uint256 ptWithdrawAmount;
    uint256 scWithdrawAmount;
    bool isForceWithdraw;
}

struct DepositWithPermit {
    address user;
    uint64 usd;
    uint64 deadline;
    Signature signature;
}

struct Signature {
    uint256 r;
    uint256 s;
    uint8 v;
}
