// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

interface ITokenGOEFR {
    function claimTo(address to, uint256 tokenId, address currency, uint256 claimValue) external;
    function balanceOf(uint256 tokenId) external returns (uint256);
}