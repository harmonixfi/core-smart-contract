// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../interfaces/Solv/SolvStruct.sol";

interface ISolv {
    function subscribe(
        bytes32 _poolId,
        uint256 _currencyAmount,
        uint256 _openFundShareId,
        uint64 _expireTime
    ) external returns (uint256 _value);

    function requestRedeem(
        bytes32 _poolId,
        uint256 _openFundShareId,
        uint256 _openFundRedemptionId,
        uint256 _redeemValue
    ) external;
    
    function poolInfos(
        bytes32 _poolId
    )
        external
        returns (
            PoolSFTInfo memory poolSFTInfo,
            PoolFeeInfo memory poolFeeInfo,
            ManagerInfo memory managerInfo,
            SubscribeLimitInfo memory subscribeLimitInfo,
            address vault,
            address currency,
            address navOracle,
            uint64 valueDate,
            bool permissionless,
            uint256 fundraisingAmount
        );
}
