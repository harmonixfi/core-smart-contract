// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC4626Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../interfaces/IWETH.sol";
import "../../interfaces/IFundNavContract.sol";
import "../../extensions/BaseAccessControlUpgradeable.sol";
import "../../extensions/TransferHelper.sol";
import "../../lib/WithdrawStore.sol";
import "../../lib/VaultStore.sol";
import "../../lib/ShareMath.sol";
import "./fundStorage.sol";
import "../../interfaces/IBlacklist.sol";
import "hardhat/console.sol";

/**
 * @title FundContract
 * @dev A vault contract that implements ERC4626 standard for tokenized vaults with withdrawal mechanisms,
 * management fees, performance fees, and blacklist functionality.
 * @dev This contract is upgradeable using UUPS pattern and includes access control.
 */
contract FundContract is
    Initializable,
    ERC4626Upgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    BaseAccessControlUpgradeable
{
    enum CollectedFeeFrom {
        Withdraw,
        Harvest
    }
    enum CollectedFeeType {
        ManagementFee,
        PerformanceFee
    }

    FundStorage private fundStorage;
    address internal balanceContract;
    address private fundNavContract;
    mapping(address => uint256) public lockedShares;
    address private blacklist;

    /************************************************
     *  EVENTS
     ***********************************************/
    event Deposited(
        address indexed caller,
        address indexed user,
        uint256 amount,
        uint256 shares,
        uint256 fee
    );

    event WithdrawalInitiated(
        address indexed account,
        uint256 withdrawalAmount,
        uint256 shares
    );

    event Withdrawn(address indexed account, uint256 amount, uint256 shares);

    event CollectedFee(
        CollectedFeeFrom collectedFeeFrom, // 1 withdraw, 2 acquire fee
        CollectedFeeType collectedFeeType, // 1 management fee, 2 performance fee
        uint256 shares,
        uint256 pricePerShare,
        uint256 timestamp
    );

    /**
     * @notice Initializes the FundContract
     * @param _admin The admin address with administrative privileges
     * @param _asset The underlying asset token address
     * @param _fundStorage The fund storage contract address
     * @param _balanceContract The balance contract address for managing funds
     * @param _fundNavContract The fund NAV contract address for NAV calculations
     * @param _fundTokenName The name of the fund token
     * @param _fundTokenSymbol The symbol of the fund token
     */
    function initialize(
        address _admin,
        address _asset,
        address _fundStorage,
        address _balanceContract,
        address _fundNavContract,
        string calldata _fundTokenName,
        string calldata _fundTokenSymbol
    ) public initializer {
        __ERC20_init(_fundTokenName, _fundTokenSymbol);
        __ERC4626_init(IERC20(_asset));
        __AccessControl_init();
        __UUPSUpgradeable_init();

        fundStorage = FundStorage(_fundStorage);
        balanceContract = _balanceContract;
        fundNavContract = _fundNavContract;

        _grantRole(Role.ADMIN, _admin);
        _grantRole(Role.UPGRADER, msg.sender);
    }

    /**
     * @dev Only the contract owner can upgrade
     * @param newImplementation The address of the new implementation contract
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(Role.UPGRADER) {}

    /**
     * @notice Sets up the initial vault configuration
     * @param _minimumSupply The minimum supply required for the vault
     * @param _capacity The maximum capacity of the vault
     * @param _performanceFeeRate The performance fee rate (in basis points)
     * @param _managementFeeRate The management fee rate (in basis points)
     * @param _managementFeeReceiver The address to receive management fees
     * @param _performanceFeeReceiver The address to receive performance fees
     * @param _networkCost The network cost for operations
     */
    function setupVault(
        uint256 _minimumSupply,
        uint256 _capacity,
        uint256 _performanceFeeRate,
        uint256 _managementFeeRate,
        address _managementFeeReceiver,
        address _performanceFeeReceiver,
        uint256 _networkCost
    ) external nonReentrant {
        _auth(Role.ADMIN);

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.VaultSetting memory vaultSetting = VaultStore.VaultSetting(
            _minimumSupply,
            _capacity,
            _performanceFeeRate,
            _managementFeeRate,
            _managementFeeReceiver,
            _performanceFeeReceiver,
            _networkCost
        );
        VaultStore.setVaultSetting(fundStorage, vaultKey, vaultSetting);

        VaultStore.VaultState memory vaultState = VaultStore.VaultState(
            10 ** decimals(),
            0,
            block.timestamp,
            block.timestamp,
            0,
            block.timestamp,
            10 ** decimals(),
            0
        );
        VaultStore.setVaultState(fundStorage, vaultKey, vaultState);

        _mint(msg.sender, 10 ** 3);
    }

    /**
     * @notice Updates the vault configuration settings
     * @param _minimumSupply The new minimum supply requirement
     * @param _capacity The new maximum capacity
     * @param _performanceFeeRate The new performance fee rate
     * @param _managementFeeRate The new management fee rate
     * @param _managementFeeReceiver The new management fee receiver address
     * @param _performanceFeeReceiver The new performance fee receiver address
     * @param _networkCost The new network cost
     */
    function updateVaultSetting(
        uint256 _minimumSupply,
        uint256 _capacity,
        uint256 _performanceFeeRate,
        uint256 _managementFeeRate,
        address _managementFeeReceiver,
        address _performanceFeeReceiver,
        uint256 _networkCost
    ) external nonReentrant {
        _auth(Role.ADMIN);

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.VaultSetting memory vaultSetting = _getVaultSetting();
        vaultSetting.minimumSupply = _minimumSupply;
        vaultSetting.capacity = _capacity;
        vaultSetting.performanceFeeRate = _performanceFeeRate;
        vaultSetting.managementFeeRate = _managementFeeRate;
        vaultSetting.managementFeeReceiver = _managementFeeReceiver;
        vaultSetting.performanceFeeReceiver = _performanceFeeReceiver;
        vaultSetting.networkCost = _networkCost;
        VaultStore.setVaultSetting(fundStorage, vaultKey, vaultSetting);
    }

    /**
     * @notice Updates the vault state parameters
     * @param _highWatermark The new high watermark value
     * @param _deployedTimestamp The new deployed timestamp
     * @param _lastHarvestManagementFeeTime The new last harvest management fee time
     * @param _lastHarvestPerformanceFeeTime The new last harvest performance fee time
     * @param _pendingWithdrawAmount The new pending withdraw amount
     */
    function updateVaultState(
        uint256 _highWatermark,
        uint256 _deployedTimestamp,
        uint256 _lastHarvestManagementFeeTime,
        uint256 _lastHarvestPerformanceFeeTime,
        uint256 _pendingWithdrawAmount
    ) external nonReentrant {
        _auth(Role.ADMIN);

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.VaultState memory vaultState = _getVaultState();

        vaultState.highWatermark = _highWatermark;
        vaultState.deployedTimestamp = _deployedTimestamp;
        vaultState.lastHarvestManagementFeeTime = _lastHarvestManagementFeeTime;
        vaultState
            .lastHarvestPerformanceFeeTime = _lastHarvestPerformanceFeeTime;
        vaultState.pendingWithdrawAmount = _pendingWithdrawAmount;
        VaultStore.setVaultState(fundStorage, vaultKey, vaultState);
    }

    /**
     * @notice Receives Ether sent to the contract.
     * @dev Logs the received Ether amount and forwards it to the operator. Requires Ether to be sent, and ensures the transfer succeeds.
     */
    receive() external payable {}

    /**
     * @notice Returns the total assets in the vault
     * @return The total NAV (Net Asset Value) of the vault
     */
    function totalAssets() public view override returns (uint256) {
        return
            VaultStore.getNav(
                fundStorage,
                VaultStore.getVaultKey(address(this))
            );
    }

    /**
     * @notice Returns the current price per share
     * @return The price per share in the underlying asset
     */
    function pricePerShare() public view returns (uint256) {
        return _getPricePerShare();
    }

    /**
     * @notice Returns the decimals of the underlying asset
     * @return The number of decimals
     */
    function decimals() public view override returns (uint8) {
        return ERC20(asset()).decimals();
    }

    /**
     * @notice Converts assets to shares
     * @param assets The amount of assets to convert
     * @return The equivalent number of shares
     */
    function convertToShares(
        uint256 assets
    ) public view override returns (uint256) {
        return ShareMath.assetToShares(assets, _getPricePerShare(), decimals());
    }

    /**
     * @notice Converts shares to assets
     * @param shares The number of shares to convert
     * @return The equivalent amount of assets
     */
    function convertToAssets(
        uint256 shares
    ) public view override returns (uint256) {
        return ShareMath.sharesToAsset(shares, _getPricePerShare(), decimals());
    }

    /**
     * @dev Internal function to update balances with locked shares validation
     * @param from The address transferring from
     * @param to The address transferring to
     * @param amount The amount being transferred
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (from != address(0) && to != address(0)) {
            require(
                balanceOf(from) - lockedShares[from] >= amount,
                "INSUFFICIENT_SHARES"
            );
        }

        super._update(from, to, amount);
    }

    /**
     * @notice Deposits assets with slippage protection
     * @param _amount The amount of assets to deposit
     * @param _receiver The address to receive the shares
     * @param minSharesOut The minimum shares to receive
     * @return The number of shares minted
     */
    function depositWithSlippage(
        uint256 _amount,
        address _receiver,
        uint256 minSharesOut
    ) public nonReentrant returns (uint256) {
        require(_amount > 0, "INV_AMOUNT");

        TransferHelper.safeTransferFrom(
            asset(),
            msg.sender,
            address(this),
            _amount
        );

        uint256 shares = _deposit(_amount, _receiver, minSharesOut);

        TransferHelper.safeTransfer(asset(), balanceContract, _amount);

        return shares;
    }

    /**
     * @notice Preview the number of shares that would be received for a deposit
     * @param assets The amount of assets to deposit
     * @return The number of shares that would be minted
     */
    function previewDeposit(
        uint256 assets
    ) public view override returns (uint256) {
        return ShareMath.assetToShares(assets, _getPricePerShare(), decimals());
    }

    /**
     * @notice Deposits assets and mints shares
     * @param _amount The amount of assets to deposit
     * @param _receiver The address to receive the shares
     * @return The number of shares minted
     */
    function deposit(
        uint256 _amount,
        address _receiver
    ) public override nonReentrant returns (uint256) {
        require(_amount > 0, "INV_AMOUNT");

        TransferHelper.safeTransferFrom(
            asset(),
            msg.sender,
            address(this),
            _amount
        );

        uint256 shares = _deposit(_amount, _receiver, 0);

        TransferHelper.safeTransfer(asset(), balanceContract, _amount);

        return shares;
    }

    /**
     * @notice Preview the amount of assets needed to mint a specific number of shares
     * @param shares The number of shares to mint
     * @return The amount of assets needed
     */
    function previewMint(
        uint256 shares
    ) public view override returns (uint256) {
        return
            ShareMath.sharesToAssetUp(shares, _getPricePerShare(), decimals());
    }

    /**
     * @notice Mints shares by providing the exact amount of assets needed
     * @param _shares The number of shares to mint
     * @param _receiver The address to receive the shares
     * @return The number of shares minted
     */
    function mint(
        uint256 _shares,
        address _receiver
    ) public override nonReentrant returns (uint256) {
        require(_shares > 0, "INV_AMOUNT");

        uint256 assets = ShareMath.sharesToAssetUp(
            _shares,
            _getPricePerShare(),
            decimals()
        );
        TransferHelper.safeTransferFrom(
            asset(),
            msg.sender,
            address(this),
            assets
        );

        _deposit(assets, _receiver, 0);

        TransferHelper.safeTransfer(asset(), balanceContract, assets);

        return assets;
    }

    /**
     * @dev Internal function to handle deposits
     * @param _amount The amount of assets to deposit
     * @param _receiver The address to receive the shares
     * @param minSharesOut The minimum shares to receive
     * @return The number of shares minted
     */
    function _deposit(
        uint256 _amount,
        address _receiver,
        uint256 minSharesOut
    ) internal returns (uint256) {
        require(!paused, "VAULT_PAUSED");
        require(!_isBlackListUser(msg.sender), "BLACKLIST_USER");
        require(!_isBlackListUser(_receiver), "BLACKLIST_USER");

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.VaultSetting memory vaultSetting = _getVaultSetting();
        uint256 remainingCapacity = vaultSetting.capacity - totalAssets();
        require(_amount <= remainingCapacity, "INV_CAPACITY");
        require(
            remainingCapacity < vaultSetting.minimumSupply ||
                _amount >= vaultSetting.minimumSupply,
            "AMOUNT_BELOW_MINIMUM"
        );

        uint256 issueShares = convertToShares(_amount);

        require(issueShares >= minSharesOut, "INSUFFICIENT_SHARES_OUT");
        _mint(_receiver, issueShares);

        if (totalAssets() == 0) {
            // first deposit
            uint256 nowTimestamp = block.timestamp;
            VaultStore.setLastHarvestManagementFeeTime(
                fundStorage,
                vaultKey,
                nowTimestamp
            );
            VaultStore.setLastHarvestPerformanceFeeTime(
                fundStorage,
                vaultKey,
                nowTimestamp
            );
        }
        VaultStore.appendNav(fundStorage, vaultKey, _amount);

        emit Deposited(msg.sender, _receiver, _amount, issueShares, 0);

        return issueShares;
    }

    /**
     * @notice Checks if a user can complete their withdrawal
     * @param _user The address of the user
     * @return True if withdrawal can be completed, false otherwise
     */
    function canCompleteWithdraw(address _user) public view returns (bool) {
        UserWithdraw.WithdrawData memory userWithdraw = _getUserWithdraw(_user);
        return userWithdraw.isAcquired;
    }

    /**
     * @notice Initiates a withdrawal request
     * @param _shares The number of shares to withdraw
     * @param _minAssetsOut The minimum assets to receive
     */
    function initiateWithdrawal(
        uint256 _shares,
        uint256 _minAssetsOut
    ) external nonReentrant {
        require(!paused, "VAULT_PAUSED");
        require(
            balanceOf(msg.sender) - lockedShares[msg.sender] >= _shares,
            "INV_SHARES"
        );
        UserWithdraw.WithdrawData memory userWithdraw = _getUserWithdraw(
            msg.sender
        );
        require(userWithdraw.shares == 0, "INV_WD_STATE");

        uint256 withdrawAmount = convertToAssets(_shares);

        require(withdrawAmount >= _minAssetsOut, "INSUFFICIENT_ASSETS_OUT");

        _createUserWithdraw(msg.sender, userWithdraw, _shares, withdrawAmount);

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.appendPendingWithdrawAmount(
            fundStorage,
            vaultKey,
            withdrawAmount
        );

        emit WithdrawalInitiated(msg.sender, withdrawAmount, _shares);
    }

    /**
     * @notice Preview the number of shares needed to withdraw a specific amount of assets
     * @param assets The amount of assets to withdraw
     * @return The number of shares needed
     */
    function previewWithdraw(
        uint256 assets
    ) public view override returns (uint256) {
        UserWithdraw.WithdrawData memory userWithdraw = _getUserWithdraw(
            msg.sender
        );
        uint256 pps = userWithdraw.shares > 0
            ? userWithdraw.pricePerShare
            : _getPricePerShare();
        return ShareMath.assetToSharesUp(assets, pps, decimals());
    }

    /**
     * @notice Withdraws assets by burning shares
     * @param assets The amount of assets to withdraw
     * @param receiver The address to receive the assets
     * @param owner The owner of the shares
     * @return The amount of assets withdrawn
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256) {
        UserWithdraw.WithdrawData memory userWithdraw = _getUserWithdraw(owner);
        require(userWithdraw.shares > 0, "ZERO_USER_SHARES");
        uint256 shares = ShareMath.assetToSharesUp(
            assets,
            userWithdraw.pricePerShare,
            decimals()
        );

        _withdraw(shares, receiver, owner);

        return shares;
    }

    /**
     * @notice Preview the amount of assets that would be received for burning shares
     * @param shares The number of shares to burn
     * @return The amount of assets that would be received
     */
    function previewRedeem(
        uint256 shares
    ) public view override returns (uint256) {
        UserWithdraw.WithdrawData memory userWithdraw = _getUserWithdraw(
            msg.sender
        );
        uint256 pps = userWithdraw.shares > 0
            ? userWithdraw.pricePerShare
            : _getPricePerShare();
        return ShareMath.sharesToAsset(shares, pps, decimals());
    }

    /**
     * @notice Redeems shares for assets
     * @param shares The number of shares to redeem
     * @param receiver The address to receive the assets
     * @param owner The owner of the shares
     * @return The amount of assets received
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256) {
        return _withdraw(shares, receiver, owner);
    }

    /**
     * @notice Acquires assets to prepare funds for withdrawal
     * @param _amount The amount of assets to acquires
     * @param _users Array of user addresses
     * @param _fees Array of fees for each user
     */
    function acquireWithdrawalFunds(
        uint256 _amount,
        address[] calldata _users,
        uint256[] calldata _fees
    ) external nonReentrant {
        require(msg.sender == balanceContract, "BALANCE_CONTRACT");
        require(_users.length == _fees.length, "USERS_FEE_LENGTH");

        TransferHelper.safeTransferFrom(
            asset(),
            balanceContract,
            address(this),
            _amount
        );

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.appendWithdrawPoolAmount(fundStorage, vaultKey, _amount);
        VaultStore.deductPendingWithdrawAmount(fundStorage, vaultKey, _amount);
        if (_users.length > 0) _updateUserAcquired(_users);
    }

    /**
     * @notice Harvests management fees based on time elapsed
     */
    function harvestManagementFee() external nonReentrant {
        _auth(Role.ADMIN);

        VaultStore.VaultState memory vaultState = _getVaultState();
        require(
            block.timestamp > vaultState.lastHarvestManagementFeeTime,
            "INVALID_TIMESTAMP"
        );

        uint256 feeAmount = _calculateManagementFeeAmount(
            block.timestamp,
            vaultState.lastHarvestManagementFeeTime,
            vaultState.nav - vaultState.pendingWithdrawAmount
        );

        uint256 sharesToMint = (feeAmount * totalSupply()) /
            (totalAssets() - feeAmount);

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        address managementFeeReceiver = VaultStore.getManagementFeeReceiver(
            fundStorage,
            vaultKey
        );
        _mint(managementFeeReceiver, sharesToMint);

        VaultStore.setLastHarvestManagementFeeTime(
            fundStorage,
            vaultKey,
            block.timestamp
        );

        _updateNav();

        emit CollectedFee(
            CollectedFeeFrom.Harvest,
            CollectedFeeType.ManagementFee,
            sharesToMint,
            vaultState.pricePerShare,
            block.timestamp
        );
    }

    /**
     * @notice Harvests performance fees when NAV exceeds high watermark
     */
    function harvestPerformanceFee() external nonReentrant {
        _auth(Role.ADMIN);

        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.VaultState memory vaultState = _getVaultState();
        uint256 currentPPS = vaultState.pricePerShare;
        uint256 highWatermark = vaultState.highWatermark;

        require(currentPPS > highWatermark, "NO_NEW_HIGH");
        uint256 gainPerShare = currentPPS - highWatermark;
        uint256 totalProfit = (gainPerShare * totalSupply()) /
            (10 ** decimals());

        uint256 feeAmount = _calculatePerformanceFee(
            _getVaultSetting(),
            totalProfit
        );

        uint256 sharesToMint = (feeAmount * totalSupply()) /
            (totalAssets() - feeAmount);

        address performanceFeeReceiver = VaultStore.getPerformanceFeeReceiver(
            fundStorage,
            vaultKey
        );
        _mint(performanceFeeReceiver, sharesToMint);

        vaultState.highWatermark = currentPPS;
        vaultState.lastHarvestPerformanceFeeTime = block.timestamp;
        VaultStore.setVaultState(fundStorage, vaultKey, vaultState);

        _updateNav();

        emit CollectedFee(
            CollectedFeeFrom.Harvest,
            CollectedFeeType.PerformanceFee,
            sharesToMint,
            currentPPS,
            block.timestamp
        );
    }

    /**
     * @notice Sets the fund NAV reader contract address
     * @param _fundNavContract The address of the fund NAV contract
     */
    function setFundNavReader(address _fundNavContract) external nonReentrant {
        _auth(Role.ADMIN);

        fundNavContract = _fundNavContract;
    }

    /**
     * @notice Updates the NAV and price per share based on current state
     */
    function updateNav() external nonReentrant {
        _auth(Role.ADMIN);

        _updateNav();
    }

    function _updateNav() internal {
        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        uint256 withdrawPoolAmount = VaultStore.getWithdrawPoolAmount(
            fundStorage,
            vaultKey
        );

        uint256 nav = IFundNavContract(fundNavContract).getFundNavValue() +
            ERC20(asset()).balanceOf(balanceContract) +
            withdrawPoolAmount;

        VaultStore.setNav(fundStorage, vaultKey, nav);
        VaultStore.setPricePerShare(
            fundStorage,
            vaultKey,
            (nav * 10 ** decimals()) / totalSupply()
        );
    }

    /**
     * @notice Sets the locked shares for a specific user
     * @param user The address of the user
     * @param shares The number of shares to lock
     */
    function setLockedShares(
        address user,
        uint256 shares
    ) external nonReentrant {
        _auth(Role.ADMIN);

        lockedShares[user] = shares;
    }

    /**
     * @notice Gets the locked shares for a specific user
     * @param user The address of the user
     * @return The number of locked shares
     */
    function getLockedShares(address user) external view returns (uint256) {
        return lockedShares[user];
    }

    /**
     * @dev Internal function to handle withdrawals
     * @param _shares The number of shares to withdraw
     * @param _receiver The address to receive the assets
     * @param _owner The owner of the shares
     * @return The amount of assets withdrawn
     */
    function _withdraw(
        uint256 _shares,
        address _receiver,
        address _owner
    ) private returns (uint256) {
        require(!paused, "VAULT_PAUSED");
        require(msg.sender == _owner, "INV_OWNER");
        require(lockedShares[_owner] >= _shares, "INSUFFICIENT_LOCKED_SHARES");
        require(!_isBlackListUser(msg.sender), "BLACKLIST_USER");
        require(!_isBlackListUser(_receiver), "BLACKLIST_USER");

        UserWithdraw.WithdrawData memory userWithdraw = _getUserWithdraw(
            _owner
        );
        require(userWithdraw.shares > 0, "ZERO_USER_SHARES");
        require(userWithdraw.shares >= _shares, "INV_SHARES");
        require(canCompleteWithdraw(_owner), "INV_WITHDRAW_STATE");

        VaultStore.VaultSetting memory vaultSetting = _getVaultSetting();
        VaultStore.VaultState memory vaultState = _getVaultState();

        uint256 sharesWithdrawAmount = (_shares * userWithdraw.withdrawAmount) /
            userWithdraw.shares;

        require(
            vaultState.withdrawPoolAmount >= sharesWithdrawAmount,
            "EXCEED_WD_POOL_CAP"
        );

        lockedShares[_owner] -= _shares;
        _burn(msg.sender, _shares);

        uint256 networkCost = (sharesWithdrawAmount <=
            vaultSetting.networkCost ||
            userWithdraw.isCollectNetworkCost)
            ? 0
            : vaultSetting.networkCost;

        _updateUserWithdrawal(
            msg.sender,
            userWithdraw,
            _shares,
            sharesWithdrawAmount
        );

        TransferHelper.safeTransfer(
            asset(),
            _receiver,
            sharesWithdrawAmount - networkCost
        );

        if (networkCost > 0) {
            TransferHelper.safeTransfer(
                asset(),
                vaultSetting.managementFeeReceiver,
                networkCost
            );
        }

        _updateVaultState(vaultState, sharesWithdrawAmount);

        return sharesWithdrawAmount;
    }

    /**
     * @dev Internal function to get user withdrawal data
     * @param user The address of the user
     * @return The user's withdrawal data
     */
    function _getUserWithdraw(
        address user
    ) private view returns (UserWithdraw.WithdrawData memory) {
        bytes32 withdrawKey = WithdrawStore.getWithdrawKey(address(this), user);
        UserWithdraw.WithdrawData memory userWithdraw = WithdrawStore.get(
            fundStorage,
            withdrawKey
        );

        return userWithdraw;
    }

    /**
     * @notice Gets the withdrawal shares for a specific user
     * @param user The address of the user
     * @return The number of withdrawal shares
     */
    function getUserWithdrawlShares(
        address user
    ) external view returns (uint256) {
        return _getUserWithdraw(user).shares;
    }

    /**
     * @dev Internal function to update user acquired status
     * @param _users Array of user addresses to update
     */
    function _updateUserAcquired(address[] calldata _users) private {
        for (uint256 i = 0; i < _users.length; i++) {
            bytes32 withdrawKey = WithdrawStore.getWithdrawKey(
                address(this),
                _users[i]
            );

            WithdrawStore.setIsAcquired(fundStorage, withdrawKey, true);
        }
    }

    /**
     * @dev Internal function to update vault state after withdrawal
     * @param vaultState The current vault state
     * @param withdrawAmount The amount withdrawn
     */
    function _updateVaultState(
        VaultStore.VaultState memory vaultState,
        uint256 withdrawAmount
    ) internal {
        vaultState.withdrawPoolAmount -= withdrawAmount;
        vaultState.nav -= withdrawAmount;

        VaultStore.setVaultState(
            fundStorage,
            VaultStore.getVaultKey(address(this)),
            vaultState
        );
    }

    /**
     * @dev Internal function to create user withdrawal data
     * @param _user The address of the user
     * @param _userWithdraw The user's withdrawal data
     * @param _shares The number of shares to withdraw
     * @param _withdrawAmount The amount to withdraw
     */
    function _createUserWithdraw(
        address _user,
        UserWithdraw.WithdrawData memory _userWithdraw,
        uint256 _shares,
        uint256 _withdrawAmount
    ) internal {
        _userWithdraw.shares = _shares;
        _userWithdraw.pricePerShare = _getPricePerShare();
        _userWithdraw.withdrawAmount = _withdrawAmount;
        _userWithdraw.createdAt = block.timestamp;

        WithdrawStore.set(
            fundStorage,
            WithdrawStore.getWithdrawKey(address(this), _user),
            _userWithdraw
        );

        lockedShares[msg.sender] += _shares;
    }

    /**
     * @dev Internal function to update user withdrawal data
     * @param user The address of the user
     * @param userWithdraw The user's withdrawal data
     * @param _shares The number of shares being withdrawn
     * @param withdrawAmount The amount being withdrawn
     */
    function _updateUserWithdrawal(
        address user,
        UserWithdraw.WithdrawData memory userWithdraw,
        uint256 _shares,
        uint256 withdrawAmount
    ) internal {
        userWithdraw.withdrawAmount -= withdrawAmount;
        userWithdraw.shares = ShareMath.zeroIfTiny(
            userWithdraw.shares - _shares
        );
        userWithdraw.isAcquired = userWithdraw.shares == 0 ? false : true;
        userWithdraw.isCollectNetworkCost = userWithdraw.shares == 0
            ? false
            : true;
        WithdrawStore.set(
            fundStorage,
            WithdrawStore.getWithdrawKey(address(this), user),
            userWithdraw
        );
    }

    /**
     * @dev Internal function to get vault state
     * @return The current vault state
     */
    function _getVaultState()
        private
        view
        returns (VaultStore.VaultState memory)
    {
        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.VaultState memory vaultState = VaultStore.getVaultState(
            fundStorage,
            vaultKey
        );

        return vaultState;
    }

    /**
     * @notice Gets the vault configuration settings
     * @return The vault setting configuration
     */
    function _getVaultSetting()
        private
        view
        returns (VaultStore.VaultSetting memory)
    {
        bytes32 vaultKey = VaultStore.getVaultKey(address(this));
        VaultStore.VaultSetting memory vaultSetting = VaultStore
            .getVaultSetting(fundStorage, vaultKey);

        return vaultSetting;
    }

    /**
     * @dev Internal function to calculate performance fee
     * @param vaultSetting The vault setting configuration
     * @param _profit The profit amount
     * @return The calculated performance fee
     */
    function _calculatePerformanceFee(
        VaultStore.VaultSetting memory vaultSetting,
        uint256 _profit
    ) private pure returns (uint256) {
        return (_profit * vaultSetting.performanceFeeRate) / 1e2;
    }

    /**
     * @dev Internal function to calculate management fee amount
     * @param toTimestamp The end timestamp
     * @param fromTimestamp The start timestamp
     * @param nav The NAV amount
     * @return The calculated management fee amount
     */
    function _calculateManagementFeeAmount(
        uint256 toTimestamp,
        uint256 fromTimestamp,
        uint256 nav
    ) private view returns (uint256) {
        uint256 managementFeeRate = VaultStore.getManagementFeeRate(
            fundStorage,
            VaultStore.getVaultKey(address(this))
        );

        uint256 perSecondRate = (managementFeeRate * 1e12) / (365 * 86400);
        uint256 period = toTimestamp - fromTimestamp;
        return (nav * perSecondRate * period) / 1e14;
    }

    /**
     * @dev Internal function to get current price per share
     * @return The current price per share
     */
    function _getPricePerShare() private view returns (uint256) {
        return
            VaultStore.getPricePerShare(
                fundStorage,
                VaultStore.getVaultKey(address(this))
            );
    }

    /**
     * @notice Sets the blacklist contract address
     * @param _blackList The address of the blacklist contract
     */
    function setBlackListContract(address _blackList) external {
        _auth(Role.ADMIN);
        blacklist = _blackList;
    }

    /**
     * @dev Internal function to check if a user is blacklisted
     * @param user The address of the user to check
     * @return True if user is blacklisted, false otherwise
     */
    function _isBlackListUser(address user) internal view returns (bool) {
        if (blacklist == address(0)) return false;

        IBlacklist blacklistContract = IBlacklist(blacklist);
        return blacklistContract.isWalletInBlacklist(user);
    }
}
