// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../interfaces/Solv/ISolv.sol";
import "../../interfaces/Solv/INavOracal.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "../../vaults/deltaNeutral/structs/DeltaNeutralStruct.sol";
import "../../extensions/RockOnyxAccessControl.sol";
import "../../lib/ShareMath.sol";
import "../../interfaces/Solv/SolvStruct.sol";
import "../../lib/FullMath.sol";
import "../../interfaces/Solv/ITokenGOEFR.sol";
import "../../extensions/TransferHelper.sol";
import "hardhat/console.sol";

contract SolvVault is ReentrancyGuardUpgradeable {
    ISolv private SOLV;
    INavOracal private NavOracal;
    IERC20 private wbtc;
    IERC721Enumerable private tokenGOEFS;
    IERC721Enumerable private tokenGOEFR;
    ITokenGOEFR private GOEFR;
    address private admin;
    VaultParams private vaultParams;
    VaultState internal vaultState;
    bytes32 public poolId;
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

    event WithDrawal(address indexed to, uint256 claimValue, address currentcy);

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
    ) public {
        SOLV = ISolv(_solvAddress);
        GOEFR = ITokenGOEFR(_tokenGOEFR);
        wbtc = IERC20(_wbtc);
        tokenGOEFS = IERC721Enumerable(_tokenGOEFS);
        tokenGOEFR = IERC721Enumerable(_tokenGOEFR);
        vaultParams = VaultParams(_decimal, _wbtc, _minimumSupply, _cap, 10, 1);
        vaultState = VaultState(0, 0, 0, 0, 0);
        poolId = _poolId;
    }

    /**
     * @notice deposit to the vault and subscribe to the Solv
     */
    function deposit(
        bytes32 _poolId,
        uint256 _amountSubscribe,
        uint256 _openFundShareId
    ) external nonReentrant {
        require(_amountSubscribe >= vaultParams.minimumSupply, "MIN_AMOUNT");
        require(
            this.totalValueLock() / 1e18 + _amountSubscribe <= vaultParams.cap,
            "EXCEED_CAP"
        );
        require(_amountSubscribe > 0, "INVALID_SUBSCRIBE_AMOUNT");
        IERC20(wbtc).transferFrom(msg.sender, address(this), _amountSubscribe);
        IERC20(wbtc).approve(address(SOLV), _amountSubscribe);
        uint256 userShares = SOLV.subscribe(
            _poolId,
            _amountSubscribe,
            _openFundShareId,
            uint64(block.timestamp + 180)
        );
        vaultState.totalShares += userShares;

        emit Deposited(msg.sender, address(wbtc), _amountSubscribe, userShares);
    }

    /**
     * @notice request redeem => burn token GOEFS => mint token GOEFR wait for claim
     */
    function requestRedeem(
        bytes32 _poolId,
        uint256 _openFundShareId,
        uint256 _openFundRedemptionId,
        uint256 _redeemValue
    ) external nonReentrant {
        require(
            tokenGOEFS.ownerOf(_openFundShareId) == address(this),
            "INVALID_OWNER_OF_TOKEN"
        );
        require(withdrawals[msg.sender].shares == 0, "INVALID_WITHDRAW_STATE");
        vaultState.totalShares -= _redeemValue;
        withdrawals[msg.sender].shares = _redeemValue;
        tokenGOEFS.approve(address(SOLV), _openFundShareId);
        SOLV.requestRedeem(
            _poolId,
            _openFundShareId,
            _openFundRedemptionId,
            _redeemValue
        );

        emit RequestRedeem(
            _poolId,
            msg.sender,
            _openFundShareId,
            _openFundRedemptionId,
            _redeemValue
        );

        //migration
        updateWithdrawalArr(withdrawals[msg.sender]);
        // end migration
    }

    /**
     * @notice use token GOEFR get from request redeem to claim
     */
    function redeem(
        uint256 _tokenId,
        uint256 _claimValue
    ) external nonReentrant {
        require(
            tokenGOEFR.ownerOf(_tokenId) == address(this),
            "INVALID_OWNER_OF_TOKEN"
        );
        require(_claimValue > 0, "INVALID_CLAIM_VALUE");
        require(withdrawals[msg.sender].shares >= _claimValue, "INVALID_SHARES");
        withdrawals[msg.sender].shares -= _claimValue;
        withdrawals[msg.sender].withdrawAmount += _claimValue;
        GOEFR.claimTo(
            address(this),
            _tokenId,
            address(wbtc),
            _claimValue
        );

        emit Claim(address(this), _tokenId, _claimValue, address(wbtc));

        // migration
        updateWithdrawalArr(withdrawals[msg.sender]);
        // end migration
    }

    /**
     *@notice withdrawal to the address user, only have amountWithdrawal can call this method
     */
    function withdrawal(uint256 _amountWithdrawal) external nonReentrant {
        require(_amountWithdrawal > 0 , "INVALID_AMOUNT_WITHDRAW");
        require(withdrawals[msg.sender].withdrawAmount >= _amountWithdrawal);
        withdrawals[msg.sender].withdrawAmount -= _amountWithdrawal;
        TransferHelper.safeTransferFrom(address(wbtc), address(this), msg.sender, _amountWithdrawal);

        emit WithDrawal(msg.sender, _amountWithdrawal, address(wbtc));
    }

    /**
     * @notice get total value locked vault => devide 1e26 = value real
     */
    function totalValueLock() external returns (uint256) {
        return (this.getPricePerShares() * vaultState.totalShares);
    }

    function getPricePerShares() external returns (uint256) {
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
            address navOracle, // address navOracle
            // uint64 valueDate
            ,
            ,

        ) = // bool permissionless
            // uint256 fundraisingAmount
            SOLV.poolInfos(_poolId);
        return navOracle;
    }

    function getCurrentSubscribeToken() public view returns (address) {
        return address(wbtc);
    }

    function tokensOfOwner(
        address tokenNFTAddress
    ) external view returns (uint256[] memory) {
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

    function getBalanceOfGOEFR(uint256 _tokenId) external returns (uint256) {
        return GOEFR.balanceOf(_tokenId);
    }

    function updateWithdrawalArr(Withdrawal memory withdrawal) internal {
        for (uint256 i = 0; i < withdrawalArr.length; i++) {
            if (withdrawalArr[i].owner == msg.sender) {
                withdrawalArr[i].withdrawal = withdrawal;
                return;
            }
        }

        withdrawalArr.push(WithdrawalArr(msg.sender, withdrawal));
    }

    /**
     * @notice get withdrawl shares of user
     */
    function getUserWithdrawlShares() external view returns (uint256) {
        return withdrawals[msg.sender].shares;
    }
}