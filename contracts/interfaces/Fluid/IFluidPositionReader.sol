// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;


interface IFluidVaultResolver {
   function positionsNftIdOfUser(address user) external view returns (uint256[] memory);
   function vaultByNftId(uint256 nftId) external view returns (address vault);
}

interface IFluidVault {
    struct ConstantViews {
        address liquidity;
        address factory;
        address adminImplementation;
        address secondaryImplementation;
        address supplyToken;
        address borrowToken;
        uint8 supplyDecimals;
        uint8 borrowDecimals;
        uint vaultId;
        bytes32 liquiditySupplyExchangePriceSlot;
        bytes32 liquidityBorrowExchangePriceSlot;
        bytes32 liquidityUserSupplySlot;
        bytes32 liquidityUserBorrowSlot;
    }

    function constantsView() external view returns (ConstantViews memory);
}

interface IFluidPositionResolver {
    struct UserPosition {
        uint nftId;
        address owner;
        uint supply;
        uint borrow;
    }

   function getPositionsForNftIds(uint256[] memory nftIds_) external view returns (UserPosition[] memory positions_);
}