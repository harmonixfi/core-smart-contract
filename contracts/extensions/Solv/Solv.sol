// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "../../interfaces/Solv/ISolv.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "hardhat/console.sol";

contract Solv is ERC721, ERC721Enumerable, ReentrancyGuard {
    ISolv private SOLV;
    IERC20 private wbtc;
    IERC20 private weth;
    IERC721Enumerable private tokenGOEFS;
    mapping(address => UserDepositSolv) public user;

    constructor(address _solvAddress, address _wbtcAddress, address _wethAddress, address _tokenGOEFS) ERC721("General Open-end Fund Share", "GOEFS"){
        SOLV = ISolv(_solvAddress);
        wbtc = IERC20(_wbtcAddress);
        weth = IERC20(_wethAddress);
        tokenGOEFS = IERC721Enumerable(_tokenGOEFS);
    }

    function subscribe(
        bytes32 _poolId,
        uint256 _currentcyAmount,
        uint256 _openFundShareId,
        bool _isWbtc
    ) external payable nonReentrant {
        require(_currentcyAmount > 0, "INVALID_SUBSCRIBE_AMOUNT");
        require(_poolId != 0, "INVALID_SUBSCRIBE_POOLID");
        //deposit to vault
        if(_isWbtc) {
            IERC20(wbtc).transferFrom(msg.sender, address(this), _currentcyAmount);
            IERC20(wbtc).approve(address(SOLV), _currentcyAmount);
        } else {
            IERC20(weth).approve(address(SOLV), _currentcyAmount);
        }
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
    }

    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        uint256 tokenCount = tokenGOEFS.balanceOf(owner);
        uint256[] memory result = new uint256[](tokenCount);
        for (uint256 i = 0; i < tokenCount; i++) {
            uint256 tokenId = tokenGOEFS.tokenOfOwnerByIndex(owner, i);
            result[i] = tokenId;
        }
        return result;
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