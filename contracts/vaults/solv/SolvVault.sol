// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../../interfaces/Solv/ISolv.sol";
import "../../interfaces/Solv/INavOracal.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "../../extensions/RockOnyxAccessControl.sol";
import "../../lib/ShareMath.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "../../lib/FullMath.sol";
import "../../interfaces/Solv/ITokenGOEFR.sol";
import "../../extensions/TransferHelper.sol";
import "./structs/SolvStruct.sol";
import "../../extensions/Utils.sol";
import "hardhat/console.sol";

contract SolvVault is
    Initializable,
    RockOnyxAccessControl,
    ReentrancyGuardUpgradeable
{
    ISolv private SOLV;
    INavOracal private NavOracal;
    address private tokenGOEFS;
    address private tokenGOEFR;
    ITokenGOEFR private GOEFR;
    VaultParams private vaultParams;
    VaultState internal vaultState;
    bytes32 public poolId;
    mapping(address => DepositReceipt) private depositReceipts;
    mapping(address => Withdrawal) private withdrawals;

    /************************************************
     *  EVENTS
     ***********************************************/
    event Deposit(
        address indexed user,
        address indexed asset,
        uint256 amount,
        uint256 shares
    );

    event RequestRedeem(
        bytes32 indexed poolId,
        address indexed owner,
        uint256 indexed openFundShareId,
        uint256 openFundRedemptionId,
        uint256 redeemValue
    );

    event Claim(
        address indexed to,
        uint256 indexed tokenId,
        uint256 claimValue,
        address currency
    );

    event RequestFunds(address user, address asset, uint256 shares);
    event Withdrawn(
        address user,
        address asset,
        uint256 amount,
        uint256 shares
    );

    function initialize(
        address _admin,
        address _solvAddress,
        address _wbtc,
        address _tokenGOEFS,
        address _tokenGOEFR,
        bytes32 _poolId,
        uint8 _decimal,
        uint256 _minimumSupply,
        uint256 _cap
    ) public initializer {
        SOLV = ISolv(_solvAddress);
        GOEFR = ITokenGOEFR(_tokenGOEFR);
        tokenGOEFS = _tokenGOEFS;
        tokenGOEFR = _tokenGOEFR;
        vaultParams = VaultParams(_decimal, _wbtc, _minimumSupply, _cap);
        vaultState = VaultState(0);
        poolId = _poolId;
        paused = false;

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _admin);
    }

    /**
     * @notice deposit to the vault and subscribe to the Solv
     */
    function deposit(uint256 _amount) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(_amount >= vaultParams.minimumSupply, "MIN_AMOUNT");
        require(
            this.totalValueLocked() + _amount <= vaultParams.cap,
            "EXCEED_CAP"
        );

        TransferHelper.safeTransferFrom(
            vaultParams.asset,
            msg.sender,
            address(this),
            _amount
        );
        TransferHelper.safeApprove(vaultParams.asset, address(SOLV), _amount);

        uint256 shares = SOLV.subscribe(
            poolId,
            _amount,
            depositReceipts[msg.sender].tokenIdSubscribe,
            uint64(block.timestamp + 180)
        );

        depositReceipts[msg.sender].tokenIdSubscribe = this.getLatestToken(
            tokenGOEFS
        );
        depositReceipts[msg.sender].depositAmount += _amount;
        depositReceipts[msg.sender].shares += shares;
        vaultState.totalShares += shares;

        emit Deposit(msg.sender, vaultParams.asset, _amount, shares);
    }

    /**
     * @notice Initiates a withdrawal that can be processed once the round completes
     * @param shares is the number of shares to withdraw
     */
    function initiateWithdrawal(uint256 shares) external nonReentrant {
        DepositReceipt storage depositReceipt = depositReceipts[msg.sender];
        require(depositReceipt.shares >= shares, "INVALID_SHARES");
        require(withdrawals[msg.sender].shares == 0, "INVALID_WD_STATE");

        depositReceipt.depositAmount -= ((depositReceipt.depositAmount *
            shares) / depositReceipt.shares);
        depositReceipt.shares -= shares;
        withdrawals[msg.sender].shares = shares;
        
        requestRedeem(shares);

        emit RequestFunds(msg.sender, vaultParams.asset, shares);
    }

    /**
     * @notice request redeem => burn token GOEFS => mint token GOEFR wait for claim
     */
    function requestRedeem(uint256 shares) internal {
        uint256 openFundShareId = depositReceipts[msg.sender].tokenIdSubscribe;
        uint256 openFundRedemptionId = depositReceipts[msg.sender]
            .tokenIdRedeem;
        
        IERC721Enumerable(tokenGOEFS).approve(address(SOLV), openFundShareId);

        SOLV.requestRedeem(
            poolId,
            openFundShareId,
            openFundRedemptionId,
            shares
        );

        //if shares of user = 0 then token subscribe was burn
        if (depositReceipts[msg.sender].shares == 0) {
            depositReceipts[msg.sender].tokenIdSubscribe = 0;
        }

        //if token id redeem != 0 then set new value
        depositReceipts[msg.sender].tokenIdRedeem = openFundRedemptionId == 0
            ? this.getLatestToken(tokenGOEFR)
            : openFundRedemptionId;

        emit RequestRedeem(
            poolId,
            msg.sender,
            openFundShareId,
            openFundRedemptionId,
            shares
        );
    }

    /**
     * @notice use token GOEFR get from request redeem to claim
     */
    function redeem(uint256 shares) internal {
        uint256 openFundRedemptionId = depositReceipts[msg.sender].tokenIdRedeem;
        require(openFundRedemptionId != 0, "INVALID_REDEMPTION_ID");

        IERC721Enumerable(tokenGOEFR).approve(
            address(GOEFR),
            openFundRedemptionId
        );

        GOEFR.claimTo(
            address(this),
            openFundRedemptionId,
            vaultParams.asset,
            shares
        );

        //if shares of user = 0 then token redeem was burn
        if (depositReceipts[msg.sender].shares == 0) {
            depositReceipts[msg.sender].tokenIdRedeem = 0;
        }

        emit Claim(
            address(this),
            openFundRedemptionId,
            shares,
            vaultParams.asset
        );
    }

    /**
     *@notice withdrawal to the address user, only have amountWithdrawal can call this method
     */
    function completeWithdrawal(uint256 shares) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(shares > 0, "INVALID_AMOUNT_WITHDRAW");
        require(withdrawals[msg.sender].shares >= shares, "INVALID_SHARES");

        uint256 balanceBeforeWithdrawal = IERC20(vaultParams.asset).balanceOf(address(this));
        redeem(shares);
        uint256 balanceAfterWithdrawal = IERC20(vaultParams.asset).balanceOf(address(this));
        
        uint256 withdrawAmount = balanceAfterWithdrawal - balanceBeforeWithdrawal;
        withdrawals[msg.sender].shares -= shares;
        vaultState.totalShares -= shares;

        TransferHelper.safeTransfer(
            vaultParams.asset,
            msg.sender,
            withdrawAmount
        );

        emit Withdrawn(
            msg.sender,
            vaultParams.asset,
            withdrawAmount,
            shares
        );
    }

    /**
     * @notice get total shares of vault
     */
    function totalShares() external view returns (uint256) {
        return vaultState.totalShares;
    }

    /**
     * @notice get number shares of user
     */
    function balanceOf(address owner) external view returns (uint256) {
        return depositReceipts[owner].shares;
    }

    /**
     * @notice get latest token by address
     */
    function getLatestToken(address _token) external view returns (uint256) {
        uint256[] memory arrToken = tokensOfOwner(address(_token));
        uint256 latestToken = arrToken[arrToken.length - 1];
        return latestToken;
    }

    /**
     * @notice get total value locked vault => devide 1e26 = value real
     */
    function totalValueLocked() external returns (uint256) {
        return (this.pricePerShare() * vaultState.totalShares);
    }

    function pricePerShare() external returns (uint256) {
        address navOracalAddress = getNavOracleAddress(poolId);
        //init nav oracal
        NavOracal = INavOracal(navOracalAddress);
        (
            uint256 _nav, //navTime

        ) = NavOracal.getSubscribeNav(poolId, block.timestamp);
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
            address navOracle, // address navOracle // bool permissionless // uint64 valueDate
            ,
            ,

        ) = // uint256 fundraisingAmount
            SOLV.poolInfos(_poolId);
        return navOracle;
    }

    function tokensOfOwner(
        address tokenNFTAddress
    ) internal view returns (uint256[] memory) {
        uint256 tokenCount = IERC721Enumerable(tokenNFTAddress).balanceOf(
            address(this)
        );
        uint256[] memory result = new uint256[](tokenCount);
        for (uint256 i = 0; i < tokenCount; i++) {
            uint256 tokenId = IERC721Enumerable(tokenNFTAddress)
                .tokenOfOwnerByIndex(address(this), i);
            result[i] = tokenId;
        }
        return result;
    }

    /**
     * @notice get withdrawl shares of user
     */
    function getUserWithdrawlShares() external view returns (uint256) {
        return withdrawals[msg.sender].shares;
    }

    function getDepositReceipt() external view returns (DepositReceipt memory) {
        return (depositReceipts[msg.sender]);
    }

    function emergencyShutdown(
        address receiver,
        address tokenAddress,
        uint256 amount
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        TransferHelper.safeTransfer(
            vaultParams.asset,
            receiver,
            amount
        );
    }
}
