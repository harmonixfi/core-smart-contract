// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/Solv/ISolv.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "hardhat/console.sol";

contract SolvVault is ERC721, ERC721Enumerable, ReentrancyGuard {
    ISolv private SOLV;
    IERC20 private tokenSubscribe;
    IERC721Enumerable private tokenGOEFS;
    mapping(address => UserDepositSolv) public user;
    address private admin;

    constructor(address _solvAddress, address _tokenSubscibeAddress, address _tokenGOEFS) ERC721("General Open-end Fund Share", "GOEFS"){
        SOLV = ISolv(_solvAddress);
        tokenSubscribe = IERC20(_tokenSubscibeAddress);
        tokenGOEFS = IERC721Enumerable(_tokenGOEFS);
    }

    function deposit(
        bytes32 _poolId,
        uint256 _currentcyAmount,
        uint256 _openFundShareId
    ) external nonReentrant {
        require(_currentcyAmount > 0, "INVALID_SUBSCRIBE_AMOUNT");
        require(_poolId != 0, "INVALID_SUBSCRIBE_POOLID");
        IERC20(tokenSubscribe).approve(address(this), _currentcyAmount);
        IERC20(tokenSubscribe).transferFrom(msg.sender, address(this), _currentcyAmount);
        IERC20(tokenSubscribe).approve(address(SOLV), _currentcyAmount);
        subcribeToSolv(_poolId, _currentcyAmount, _openFundShareId);
    }

    function subcribeToSolv(
        bytes32 _poolId,
        uint256 _amountSubscribe,
        uint256 _openFundShareId
    ) internal nonReentrant {
        //deposit to vault
        user[msg.sender].owner = msg.sender;
        user[msg.sender].poolId = _poolId;
        user[msg.sender].currentcyAmount += _amountSubscribe;
        SOLV.subscribe(
            _poolId,
            _amountSubscribe,
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
        require(tokenGOEFS.ownerOf(_openFundShareId) == address(this), "INVALID_OWNER_OF_TOKEN");
        require(user[msg.sender].owner == msg.sender, "INVALID_OWNER");
        require(
            user[msg.sender].currentcyAmount > 0,
            "INVALID_CURRENTCY_AMOUNT_UNDER_ZERO"
        );
        user[msg.sender].currentcyAmount -= _redeemValue;
        tokenGOEFS.approve(address(SOLV), _openFundShareId);
        SOLV.requestRedeem(
            _poolId,
            _openFundShareId,
            _openFundRedemptionId,
            _redeemValue
        );
        console.log("NINVB => balance solv ", tokenSubscribe.balanceOf(address(this)));
    }

    function getCurrentSubscribeToken() public view returns(address) {
        return address(tokenSubscribe);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}