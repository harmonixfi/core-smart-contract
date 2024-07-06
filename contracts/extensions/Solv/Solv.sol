// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../interfaces/Solv/ISolv.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "hardhat/console.sol";

contract Solv is IERC721Receiver, ERC165, ReentrancyGuard {
    ISolv private SOLV;
    IERC20 private wbtc;
    mapping(address => UserDepositSolv) public user;

    constructor(address _solvAddress, address _wbtcAddress) {
        SOLV = ISolv(_solvAddress);
        wbtc = IERC20(_wbtcAddress);
    }

    function subscribe(
        bytes32 _poolId,
        uint256 _currentcyAmount,
        uint256 _openFundShareId
    ) external nonReentrant {
        require(_currentcyAmount > 0, "INVALID_SUBSCRIBE_AMOUNT");
        //deposit to vault
        IERC20(wbtc).transferFrom(msg.sender, address(this), _currentcyAmount);
        IERC20(wbtc).approve(address(SOLV), _currentcyAmount);
        user[msg.sender].owner = msg.sender;
        user[msg.sender].poolId = _poolId;
        user[msg.sender].currentcyAmount += _currentcyAmount;
        SOLV.subscribe(
            _poolId,
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
        require(
            user[msg.sender].openFundShareId[_openFundShareId] == msg.sender,
            "INVALID_OPEN_FUND_SHARE_ID"
        );
        require(user[msg.sender].owner == msg.sender, "INVALID_OWNER");
        require(
            user[msg.sender].currentcyAmount > 0,
            "INVALID_CURRENTCY_AMOUNT_UNDER_ZERO"
        );
        user[msg.sender].currentcyAmount -= _redeemValue;
        SOLV.requestRedeem(
            _poolId,
            _openFundShareId,
            _openFundRedemptionId,
            _redeemValue
        );
    }

    // Implement the `onERC721Received` function
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        console.log("NINVB => tokenId ", tokenId);
        return this.onERC721Received.selector;
    }

    // Override supportsInterface to include IERC721Receiver
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165) returns (bool) {
        console.log("NINVB => vao day");
        return interfaceId == type(IERC721Receiver).interfaceId || super.supportsInterface(interfaceId);
    }
}