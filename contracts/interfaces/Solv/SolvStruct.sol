// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

struct UserDepositSolv {
    address owner;
    bytes32 poolId;
    uint256 currentcyAmount;
    uint256 tokenId;
    uint256 share;
}

struct SFTInfo {
    address manager;
    bool isValid;
}

struct SubscribeLimitInfo {
    uint256 hardCap;
    uint256 subscribeMin;
    uint256 subscribeMax;
    uint64 fundraisingStartTime;
    uint64 fundraisingEndTime;
}

struct PoolSFTInfo {
    address openFundShare;
    address openFundRedemption;
    uint256 openFundShareSlot;
    uint256 latestRedeemSlot;
}

struct PoolFeeInfo {
    uint16 carryRate;
    address carryCollector;
    uint64 latestProtocolFeeSettleTime;
}

struct ManagerInfo {
    address poolManager;
    address subscribeNavManager;
    address redeemNavManager;
}

struct PoolInfo {
    PoolSFTInfo poolSFTInfo;
    PoolFeeInfo poolFeeInfo;
    ManagerInfo managerInfo;
    SubscribeLimitInfo subscribeLimitInfo;
    address vault;
    address currency;
    address navOracle;
    uint64 valueDate;
    bool permissionless;
    uint256 fundraisingAmount;
}