// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../interfaces/Solv/ISolv.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "hardhat/console.sol";

contract Solv is IERC721Receiver, ReentrancyGuard {
    ISolv private SOLV;
    bytes32 private poolId;
    uint256 private currentcyAmount;
    uint256 private openFundShareId;
    uint64 private expireTime;
    IERC20 private wbtc;

    mapping(address => UserDepositSolv) private user;

    constructor(address _solvAddress, address _wbtcAddress) {
        SOLV = ISolv(_solvAddress);
        wbtc = IERC20(_wbtcAddress);
    }

    function subscribe(
        bytes32 _poolId,
        uint256 _currentcyAmount,
        uint256 _openFundShareId
    ) external nonReentrant {
        console.log("current amount 1 ", _currentcyAmount);
        require(_currentcyAmount > 0, "INVALID_SUBSCRIBE_AMOUNT");
        //deposit to vault
        IERC20(wbtc).approve(address(this), _currentcyAmount);
        IERC20(wbtc).transferFrom(msg.sender, address(this), _currentcyAmount);
        IERC20(wbtc).approve(address(SOLV), _currentcyAmount);
        user[msg.sender].owner = msg.sender;
        user[msg.sender].poolId = _poolId;
        user[msg.sender].currentcyAmount += _currentcyAmount;
        console.log("current amount ", IERC20(wbtc).balanceOf(address(this)));
        SOLV.subscribe(
            0x3b2232fb5309e89e5ee6e2ca6066bcc28ee365045e9a565040bf8c846b87477e,
            _currentcyAmount,
            _openFundShareId,
            uint64(block.timestamp + 180)
        );
    }

    function requestRedeem(
        bytes32 _poolId,
        uint256 _openFundShareId,
        uint256 _openFundRedemptionId,
        uint256 _redeemValue
    ) external {
        require(user[msg.sender].openFundShareId[_openFundShareId] == msg.sender, "INVALID_OPEN_FUND_SHARE_ID");
        require(user[msg.sender].owner == msg.sender, "INVALID_OWNER");
        require(user[msg.sender].currentcyAmount > 0, "INVALID_CURRENTCY_AMOUNT_UNDER_ZERO");
        user[msg.sender].currentcyAmount -= _redeemValue;
        SOLV.requestRedeem(
            _poolId,
            _openFundShareId,
            _openFundRedemptionId,
            _redeemValue
        );
    }

    // Implement the ERC721Receiver interface to receive the NFT
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes memory data
    ) public override returns (bytes4) {
        user[msg.sender].openFundShareId[tokenId] = msg.sender;
        return this.onERC721Received.selector;
    }
}