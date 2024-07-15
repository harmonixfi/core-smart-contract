// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../../interfaces/Solv/ISolv.sol";
import "../../interfaces/Solv/INavOracal.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "../../vaults/deltaNeutral/structs/DeltaNeutralStruct.sol";
import "../../extensions/RockOnyxAccessControl.sol";
import "../../lib/ShareMath.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "hardhat/console.sol";

contract SolvVault is
    ERC721,
    ERC721Enumerable,
    ReentrancyGuard,
    RockOnyxAccessControl
{
    ISolv private SOLV;
    INavOracal private NavOracal;
    IERC20 private tokenSubscribe;
    IERC721Enumerable private tokenGOEFS;
    address private admin;
    VaultParams private vaultParams;
    VaultState internal vaultState;
    bytes32 public poolId;
    mapping(address => UserDepositSolv) public user;
    mapping(address => DepositReceipt) private depositReceipts;
    mapping(address => Withdrawal) private withdrawals;

    //migration
    DepositReceiptArr[] depositReceiptArr;
    WithdrawalArr[] withdrawalArr;

    /************************************************
     *  EVENTS
     ***********************************************/
    event Deposited(
        address indexed account,
        address indexed tokenIn,
        uint256 amount,
        uint256 shares
    );

    constructor() ERC721("General Open-end Fund Share", "GOEFS") {}

    function initialize(
        address _admin,
        address _solvAddress,
        address _tokenSubscibeAddress,
        address _tokenGOEFS,
        bytes32 _poolId,
        uint8 _decimal,
        uint256 _minimumSupply,
        uint256 _cap
    ) public {
        SOLV = ISolv(_solvAddress);
        tokenSubscribe = IERC20(_tokenSubscibeAddress);
        tokenGOEFS = IERC721Enumerable(_tokenGOEFS);
        vaultParams = VaultParams(
            _decimal,
            _tokenSubscibeAddress,
            _minimumSupply,
            _cap,
            10,
            1
        );
        vaultState = VaultState(0, 0, 0, 0, 0);
        poolId = _poolId;

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
    }

    function deposit(
        bytes32 _poolId,
        uint256 _amountSubscribe,
        uint256 _openFundShareId
    ) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(_amountSubscribe >= vaultParams.minimumSupply, "MIN_AMOUNT");
        require(
            this.totalValueLock() + _amountSubscribe <= vaultParams.cap,
            "EXCEED_CAP"
        );
        require(_amountSubscribe > 0, "INVALID_SUBSCRIBE_AMOUNT");
        require(_poolId != 0, "INVALID_SUBSCRIBE_POOLID");
        IERC20(tokenSubscribe).transferFrom(
            msg.sender,
            address(this),
            _amountSubscribe
        );
        IERC20(tokenSubscribe).approve(address(this), _amountSubscribe);
        uint256 userShares = SOLV.subscribe(
            _poolId,
            _amountSubscribe,
            _openFundShareId,
            uint64(block.timestamp + 180)
        );
        vaultState.totalShares += userShares;
        user[msg.sender].owner = msg.sender;
        user[msg.sender].poolId = _poolId;
        user[msg.sender].currentcyAmount += _amountSubscribe;
        user[msg.sender].share += userShares;
        emit Deposited(
            msg.sender,
            address(tokenSubscribe),
            _amountSubscribe,
            userShares
        );
    }

    function requestRedeem(
        bytes32 _poolId,
        uint256 _openFundShareId,
        uint256 _openFundRedemptionId,
        uint256 _redeemValue
    ) external {
        require(
            tokenGOEFS.ownerOf(_openFundShareId) == address(this),
            "INVALID_OWNER_OF_TOKEN"
        );
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

    /**
     * @notice get total value locked vault
     */
    function totalValueLock() external returns (uint256) {
        return (this.getPricePerShares() * vaultState.totalShares) / 1e8;
    }

    function getPricePerShares() external returns (uint256) {
        address navOracalAddress = getNavOracleAddress(poolId);
        //init nav oracal
        NavOracal = INavOracal(navOracalAddress);
        (uint256 _nav, ) = //navTime
        NavOracal.getSubscribeNav(poolId, block.timestamp);
        return _nav;
    }

    function getNavOracleAddress(bytes32 _poolId) internal returns (address) {
        (
            ,
            ,
            ,
            ,
            ,
            ,
            // PoolSFTInfo memory poolSFTInfo
            // PoolFeeInfo memory poolFeeInfo
            // ManagerInfo memory managerInfo
            // SubscribeLimitInfo memory subscribeLimitInfo
            // address vault
            // address currency
            address navOracle, // address navOracle
            // uint64 valueDate
            // bool permissionless
            ,
            ,

        ) = // uint256 fundraisingAmount
            SOLV.poolInfos(_poolId);

        return navOracle;
    }

    function getCurrentSubscribeToken() public view returns (address) {
        return address(tokenSubscribe);
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}