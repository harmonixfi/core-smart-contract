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
import "../../vaults/deltaNeutral/structs/DeltaNeutralStruct.sol";
import "../../extensions/RockOnyxAccessControl.sol";
import "../../lib/ShareMath.sol";
import "hardhat/console.sol";

contract SolvVault is ERC721, ERC721Enumerable, ReentrancyGuard, RockOnyxAccessControl {
    ISolv private SOLV;
    IERC20 private tokenSubscribe;
    IERC721Enumerable private tokenGOEFS;
    mapping(address => UserDepositSolv) public user;
    address private admin;
    VaultParams private vaultParams;
    VaultState internal vaultState;
    uint256 private networkCost;
    uint256 private initialPPS;
    mapping(address => DepositReceipt) private depositReceipts;
    mapping(address => Withdrawal) private withdrawals;

    //migration
    DepositReceiptArr[] depositReceiptArr;
    WithdrawalArr[] withdrawalArr;

    /************************************************
     *  EVENTS
     ***********************************************/
    event Deposited(address indexed account, address indexed tokenIn, uint256 amount, uint256 shares);

    constructor() ERC721("General Open-end Fund Share", "GOEFS"){
        
    }

    function initialize(
        address _admin,
        address _solvAddress, 
        address _tokenSubscibeAddress, 
        address _tokenGOEFS,
        uint8 _decimal,
        uint256 _minimumSupply,
        uint256 _cap,
        uint256 _networkCost,
        uint256 _initialPPS
        ) public {
        SOLV = ISolv(_solvAddress);
        tokenSubscribe = IERC20(_tokenSubscibeAddress);
        tokenGOEFS = IERC721Enumerable(_tokenGOEFS);
        vaultParams = VaultParams(_decimal, _tokenSubscibeAddress, _minimumSupply, _cap, 10, 1);
        vaultState = VaultState(0, 0, 0, 0, 0);
        networkCost = _networkCost;

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);

        initialPPS = _initialPPS;
    }

    function deposit(uint256 _amount) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(_amount >= vaultParams.minimumSupply, "MIN_AMOUNT");
        require(_totalValueLock() + _amount <= vaultParams.cap, "EXCEED_CAP");
        IERC20(tokenSubscribe).transferFrom(msg.sender, address(this), _amount);
        uint256 shares = _issueShares(_amount);
        DepositReceipt storage depositReceipt = depositReceipts[msg.sender];
        depositReceipt.shares += shares;
        depositReceipt.depositAmount += _amount;
        vaultState.pendingDepositAmount += _amount;
        vaultState.totalShares += shares;

        emit Deposited(msg.sender, address(tokenSubscribe), _amount, shares);
    }

    function subcribeToSolv(
        bytes32 _poolId,
        uint256 _amountSubscribe,
        uint256 _openFundShareId
    ) internal nonReentrant {
        require(_amountSubscribe > 0, "INVALID_SUBSCRIBE_AMOUNT");
        require(_poolId != 0, "INVALID_SUBSCRIBE_POOLID");
        IERC20(tokenSubscribe).approve(address(this), _amountSubscribe);
        IERC20(tokenSubscribe).transferFrom(msg.sender, address(this), _amountSubscribe);
        IERC20(tokenSubscribe).approve(address(SOLV), _amountSubscribe);
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

    /**
     * @notice get total value locked vault
     */
    function _totalValueLock() private view returns(uint256) {
        return vaultState.pendingDepositAmount + vaultState.withdrawPoolAmount;
    }

    /**
     * @notice get current price per share
     */
    function pricePerShare() external view returns(uint256) {
        return _getPricePerShare();
    }

    function _getPricePerShare() private view returns(uint256) {
        if (vaultState.totalShares == 0) return initialPPS;
        return (_totalValueLock() * 10 ** vaultParams.decimals) / vaultState.totalShares;
    }

    /**
     * @notice Mints the vault shares to the creditor
     * @param _amount is the amount to issue shares
     * shares = amount / pricePerShare
     */
    function _issueShares(uint256 _amount) private view returns (uint256) {
        return ShareMath.assetToShares(
            _amount,
            _getPricePerShare(),
            vaultParams.decimals
        );
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
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}