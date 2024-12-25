// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@pendle/core-v2/contracts/interfaces/IPAllActionV3.sol";
import "@pendle/core-v2/contracts/interfaces/IPMarket.sol";
import "../../lib/ShareMath.sol";
import "../restakingDeltaNeutral/Base/strategies/PerpDexStrategy.sol";
import "../../extensions/TransferHelper.sol";
import "../../interfaces/Pendle/IPyYtLpOracle.sol";
import "../../interfaces/ISwapAggregator.sol";
import "../../interfaces/Pendle/StructGen.sol";
import "../pendleHedge/structs/PendleStruct.sol";
import "../../extensions/Blacklist.sol";
import "./IPendleHedgeVault.sol";
import "hardhat/console.sol";

contract PendleHedgeVault is
    Initializable,
    PerpDexStrategy,
    StructGen,
    Blacklist
{
    IPyYtLpOracle private pyYtLpOracle;
    ISwapAggregator private swapProxy;
    IPMarket private market;
    IPAllActionV3 private router;
    VaultParamsPendle internal vaultParams;
    VaultStatePendle internal vaultState;
    uint256 internal initialPPS;
    mapping(address => DepositReceiptPendle) internal depositReceipts;
    mapping(address => WithdrawPendle) internal withdrawals;
    uint256 internal networkCost;
    address private zeroAddress;
    address private wethAddress;
    uint256 private totalPendleBalance;
    uint256[50] private ______gap;

    /************************************************
     *  EVENTS
     ***********************************************/

    event Deposit(
        address indexed account,
        uint256 ptAmount,
        uint256 ethAmount,
        uint256 scAmount,
        uint256 totalAmount,
        uint256 shares
    );

    event FeeRatesUpdated(uint256 performanceFee, uint256 managementFee);

    event Withdrawn(
        address indexed account,
        uint256 ptAmount,
        uint256 scAmount,
        uint256 shares,
        uint256 totalAmount
    );

    event RequestFunds(
        address indexed account,
        uint256 ptAmount,
        uint256 ethAmount,
        uint256 scAmount,
        uint256 totalAmount,
        uint256 shares
    );

    function initialize(
        address _admin,
        address _pyYtLpOracle,
        address _iPAllActionV3,
        address _market,
        address _swapProxy,
        address _scAddress,
        address _uaAddress,
        address _ptAddress,
        address _ethAddress,
        uint8 _ptDecimals,
        uint256 _minimunSupply,
        uint256 _cap,
        uint256 _networkCost,
        address _perpDexReceiver,
        uint256 _initialPPS,
        address _oldPtAddress
    ) public initializer {
        pyYtLpOracle = IPyYtLpOracle(_pyYtLpOracle);
        router = IPAllActionV3(_iPAllActionV3);
        market = IPMarket(_market);
        swapProxy = ISwapAggregator(_swapProxy);
        wethAddress = _ethAddress;
        networkCost = _networkCost;
        vaultParams = VaultParamsPendle(
            _ptAddress,
            _ptDecimals,
            _scAddress,
            ERC20(_scAddress).decimals(),
            _uaAddress,
            ERC20(_uaAddress).decimals(),
            _minimunSupply,
            _cap,
            10,
            1
        );
        vaultState = VaultStatePendle(
            _oldPtAddress,
            _initialPPS,
            0,
            0,
            0,
            0,
            0,
            block.timestamp
        );
        initialPPS = _initialPPS;
        paused = false;

        perpDex_Initialize(
            zeroAddress,
            _perpDexReceiver,
            _scAddress,
            zeroAddress
        );

        defaultApprox = ApproxParams(0, type(uint256).max, 0, 256, 1e14);

        blackList_Initialize(_admin);

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _perpDexReceiver);
    }

    function estimateScAmountFromPtAmount(
        uint256 _ptAmount
    ) external view returns (uint256) {
        require(_ptAmount > 0, "INVALID_AMOUNT");
        return _ethAmountToScAmount(_ptAmount);
    }

    /**
     * @param _ptAddress address of PT token
     * @param _scAddress address of stable coin(USDC)
     * @param _ptAmount amount of PT token
     * @param _scAmount amount of stable coin(USDC)
     */
    function deposit(
        address _ptAddress,
        address _scAddress,
        uint256 _ptAmount,
        uint256 _scAmount,
        bytes calldata swapCallData
    ) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(block.timestamp < market.expiry(), "INVALID_MATURITY_DATE");
        require(_ptAddress == vaultParams.ptAddress, "INVALID_PT_ADDRESS");
        require(_ptAmount >= vaultParams.minimumSupply, "INVALID_PT_AMOUNT");
        require(
            withdrawals[msg.sender].shares == 0,
            "INVALID_WITHDRAW_PROCESSING"
        );

        TransferHelper.safeTransferFrom(
            vaultParams.ptAddress,
            msg.sender,
            address(this),
            _ptAmount
        );

        TransferHelper.safeTransferFrom(
            vaultParams.scAddress,
            msg.sender,
            address(this),
            _scAmount
        );

        if (_scAddress != vaultParams.scAddress) {
            TransferHelper.safeApprove(
                _scAddress,
                address(swapProxy),
                _scAmount
            );
            _scAmount = swapProxy.swapTo(
                address(this),
                address(_scAddress),
                _scAmount,
                address(vaultParams.scAddress),
                swapCallData
            );
        }

        uint256 minScAmount = (99 * _ethAmountToScAmount(_ptAmount)) / 1e2;
        require(_scAmount >= minScAmount, "INVALID_SC_AMOUNT");

        _internalDeposit(_ptAmount, _scAmount);
    }

    function _internalDeposit(uint256 _ptAmount, uint256 _scAmount) private {
        uint256 totalAmount = _scAmount + _ethAmountToScAmount(_ptAmount);
        uint256 issueShares = _issueShares(totalAmount);

        vaultState.totalPtAmount += _ptAmount;
        vaultState.totalShares += issueShares;
        depositReceipts[msg.sender].shares += issueShares;
        depositReceipts[msg.sender].depositPtAmount += _ptAmount;
        depositReceipts[msg.sender].depositScAmount += _scAmount;
        depositReceipts[msg.sender].depositAmount += totalAmount;

        emit Deposit(
            msg.sender,
            _ptAmount,
            _ptAmount,
            _scAmount,
            totalAmount,
            issueShares
        );

        depositToPerpDexStrategy(_scAmount);
        _syncPendleBalance();
    }

    function initiateForceWithdrawal() external nonReentrant {
        require(!blackList[msg.sender], "USER_BLACKLIST");
        require(paused == false, "VAULT_PAUSED");
        require(block.timestamp < market.expiry(), "INVALID_MATURITY_DATE");
        require(
            depositReceipts[msg.sender].shares > 0,
            "INVALID_DEPOSIT_SHARES"
        );
        require(withdrawals[msg.sender].shares == 0, "INVALID_SHARES");
        WithdrawPendle storage withdrawal = withdrawals[msg.sender];
        withdrawal.isForceWithdraw = true;

        _internalInitiateWithdrawal(withdrawal);
    }

    function initiateWithdrawal() external nonReentrant {
        require(!blackList[msg.sender], "USER_BLACKLIST");
        require(paused == false, "VAULT_PAUSED");
        require(block.timestamp >= market.expiry(), "INVALID_MATURITY_DATE");
        require(
            depositReceipts[msg.sender].shares > 0,
            "INVALID_DEPOSIT_SHARES"
        );
        require(withdrawals[msg.sender].shares == 0, "INVALID_SHARES");
        WithdrawPendle storage withdrawal = withdrawals[msg.sender];
        withdrawal.isForceWithdraw = false;

        _internalInitiateWithdrawal(withdrawal);
    }

    function _internalInitiateWithdrawal(
        WithdrawPendle storage withdrawal
    ) private {
        DepositReceiptPendle storage depositReceipt = depositReceipts[
            msg.sender
        ];

        uint256 pps = _getPricePerShare();
        uint256 totalShareAmount = (depositReceipt.shares * pps) /
            (10 ** vaultParams.scDecimals);
        uint256 totalProfit = totalShareAmount <= depositReceipt.depositAmount
            ? 0
            : (totalShareAmount - depositReceipt.depositAmount);
        uint256 performanceFee = totalProfit > 0
            ? (totalProfit * vaultParams.performanceFeeRate) / 1e2
            : 0;

        withdrawal.shares = depositReceipt.shares;
        withdrawal.performanceFee = performanceFee;
        withdrawal.ptWithdrawAmount = depositReceipt.depositPtAmount;
        withdrawal.scWithdrawAmount =
            totalShareAmount -
            _ethAmountToScAmount(depositReceipt.depositPtAmount);

        depositReceipts[msg.sender] = DepositReceiptPendle(0, 0, 0, 0);

        emit RequestFunds(
            msg.sender,
            withdrawal.ptWithdrawAmount,
            withdrawal.ptWithdrawAmount,
            withdrawal.scWithdrawAmount,
            totalShareAmount,
            withdrawal.shares
        );
    }

    function completeWithdrawal() external nonReentrant {
        require(!blackList[msg.sender], "USER_BLACKLIST");
        require(withdrawals[msg.sender].shares > 0, "INVALID_SHARES");

        WithdrawPendle memory withdrawal = WithdrawPendle(
            withdrawals[msg.sender].shares,
            withdrawals[msg.sender].performanceFee,
            withdrawals[msg.sender].ptWithdrawAmount,
            withdrawals[msg.sender].scWithdrawAmount,
            withdrawals[msg.sender].isForceWithdraw
        );

        uint256 totalAmount = _ethAmountToScAmount(withdrawal.ptWithdrawAmount) + withdrawal.scWithdrawAmount;

        _internalCompleteWithdrawal(withdrawals[msg.sender]);

        emit Withdrawn(
            msg.sender,
            withdrawal.ptWithdrawAmount,
            withdrawal.scWithdrawAmount,
            withdrawal.shares,
            totalAmount
        );
    }

    function _internalCompleteWithdrawal(
        WithdrawPendle storage withdrawal
    ) private {
        uint256 feeAmount = withdrawal.performanceFee + networkCost;
        uint256 ptWithdrawAmount = withdrawal.ptWithdrawAmount;
        uint256 withdrawAmountAfterFee = withdrawal.scWithdrawAmount -
            feeAmount;

        console.log("feeAmount ", feeAmount);
        console.log("withdrawAmountAfterFee ", withdrawAmountAfterFee);
        console.log("scWithdrawPoolAmount ", vaultState.scWithdrawPoolAmount);
        require(
            vaultState.scWithdrawPoolAmount >= withdrawAmountAfterFee,
            "EXCEED_WD_POOL_CAP"
        );

        vaultState.scWithdrawPoolAmount -= withdrawAmountAfterFee;
        feeAmount = vaultState.scWithdrawPoolAmount < feeAmount
            ? vaultState.scWithdrawPoolAmount
            : feeAmount;

        vaultState.totalFeePoolAmount += feeAmount;
        vaultState.scWithdrawPoolAmount -= feeAmount;
        vaultState.totalShares -= withdrawal.shares;
        withdrawal.scWithdrawAmount = 0;
        withdrawal.shares = 0;

        vaultState.ptWithdrawPoolAmount -= ptWithdrawAmount;
        withdrawal.ptWithdrawAmount = 0;

        TransferHelper.safeTransfer(
            vaultParams.ptAddress,
            msg.sender,
            ptWithdrawAmount
        );

        TransferHelper.safeTransfer(
            vaultParams.scAddress,
            msg.sender,
            withdrawAmountAfterFee
        );

        _syncPendleBalance();
    }

    /**
     * @notice get vault fees
     */
    function getManagementFee() external view returns (uint256, uint256) {
        return (_getManagementFee(block.timestamp), block.timestamp);
    }

    function _getManagementFee(
        uint256 timestamp
    ) private view returns (uint256) {
        uint256 perSecondRate = (vaultParams.managementFeeRate * 1e12) /
            (365 * 86400) +
            1; // +1 mean round up second rate
        uint256 period = timestamp - vaultState.lastUpdateManagementFeeDate;
        return
            ((_totalValueLocked() - vaultState.scWithdrawPoolAmount) *
                perSecondRate *
                period) / 1e14;
    }

    function acquireManagementFee(uint256 timestamp) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        require(
            timestamp < block.timestamp &&
                timestamp >= vaultState.lastUpdateManagementFeeDate,
            "INVALID_TIMESTAMP"
        );

        uint256 feeAmount = _getManagementFee(timestamp);
        require(feeAmount <= _totalValueLocked(), "INVALID_ACQUIRE_AMOUNT");

        feeAmount = _acquireFunds(0, feeAmount);
        vaultState.totalFeePoolAmount += feeAmount;
        vaultState.lastUpdateManagementFeeDate = block.timestamp;
    }

    function acquireWithdrawalFunds(
        uint256 ptAmount,
        uint256 scAmount
    ) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        _acquireFunds(ptAmount, scAmount);
    }

    /**
     * @notice acquire asset, prepare funds for withdrawal
     */
    function _acquireFunds(
        uint256 ptAmount,
        uint256 scAmount
    ) private returns (uint256) {
        vaultState.totalPtAmount -= ptAmount;
        vaultState.ptWithdrawPoolAmount += ptAmount;
        _syncPendleBalance();

        scAmount = acquireFundsFromPerpDex(scAmount);
        vaultState.scWithdrawPoolAmount += scAmount;

        return scAmount;
    }

    /**
     * @notice claimFee to claim vault fee.
     */
    function claimFee(address receiver, uint256 amount) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        amount = amount < vaultState.totalFeePoolAmount
            ? amount
            : vaultState.totalFeePoolAmount;
        vaultState.totalFeePoolAmount -= amount;
        TransferHelper.safeTransfer(vaultParams.scAddress, receiver, amount);
    }

    function maturityDate() external view returns (uint256) {
        return market.expiry();
    }

    function pricePerShare() external view returns (uint256) {
        return _getPricePerShare();
    }

    function totalValueLocked() external view returns (uint256) {
        return _totalValueLocked();
    }

    function balanceOf(address owner) external view returns (uint256) {
        return depositReceipts[owner].shares;
    }

    /**
     * @notice Allows admin to update the performance and management fee rates
     * @param _performanceFeeRate The new performance fee rate (in percentage)
     * @param _managementFeeRate The new management fee rate (in percentage)
     */
    function setFeeRates(
        uint256 _performanceFeeRate,
        uint256 _managementFeeRate
    ) external {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        require(_performanceFeeRate <= 100, "INVALI_RATE");
        require(_managementFeeRate <= 100, "INVALID_RATE");
        vaultParams.performanceFeeRate = _performanceFeeRate;
        vaultParams.managementFeeRate = _managementFeeRate;
        emit FeeRatesUpdated(_performanceFeeRate, _managementFeeRate);
    }

    function updateNetworkCost(uint256 _networkCost) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        networkCost = _networkCost;
    }

    function _calculatePps() private {
        if (vaultState.totalShares == 0) vaultState.pps = initialPPS;

        vaultState.pps =
            (_totalValueLocked() * 10 ** vaultParams.scDecimals) /
            vaultState.totalShares;
    }

    /**
     * @notice Mints the vault shares to the creditor
     * @param amount is the amount to issue shares
     * shares = amount / pricePerShare
     */
    function _issueShares(uint256 amount) private view returns (uint256) {
        return
            ShareMath.assetToShares(
                amount,
                _getPricePerShare(),
                vaultParams.scDecimals
            );
    }

    function _getPricePerShare() private view returns (uint256) {
        return vaultState.pps;
    }

    function _totalValueLocked() private view returns (uint256) {
        return
            vaultState.scWithdrawPoolAmount +
            _ethAmountToScAmount(vaultState.ptWithdrawPoolAmount) +
            totalPendleBalance +
            getTotalPerpDexTvl();
    }

    function _ptAmountToScAmount(
        uint256 _amount
    ) private view returns (uint256) {
        if (_amount == 0) return 0;

        uint256 ethAmount = _ptAmountToEthAmount(_amount);
        return _ethAmountToScAmount(ethAmount);
    }

    function _ethAmountToScAmount(
        uint256 _amount
    ) private view returns (uint256) {
        if (_amount == 0) return 0;

        uint256 ethRate = swapProxy.getPriceOf(
            wethAddress,
            vaultParams.scAddress
        );
        return (_amount * ethRate) / (10 ** ERC20(wethAddress).decimals());
    }

    function _ptAmountToEthAmount(
        uint256 _amount
    ) private view returns (uint256) {
        if (_amount == 0) return 0;

        uint256 ptUaRate = _getPtToAssetRate(address(market));
        uint256 uaEthRate = swapProxy.getPriceOf(
            vaultParams.uaAddress,
            wethAddress
        );
        uint256 ptEthRate = (ptUaRate * uaEthRate) /
            (10 ** vaultParams.uaDecimals);

        return (_amount * ptEthRate) / (10 ** vaultParams.ptDecimals);
    }

    function _getPtToAssetRate(
        address _marketAddress
    ) private view returns (uint256) {
        require(_marketAddress != address(0), "INVALID_MARKET_ADDRESS");
        return pyYtLpOracle.getPtToAssetRate(_marketAddress, 180);
    }

    function allocatedRatio() external view returns (uint256, uint256) {
        return _allocatedRatio();
    }

    function _allocatedRatio() private view returns (uint256, uint256) {
        if (_totalValueLocked() == 0) {
            return (5000, 5000);
        }

        uint256 tvl = totalPendleBalance + getTotalPerpDexTvl();
        return (
            (totalPendleBalance * 1e4) / tvl,
            (getTotalPerpDexTvl() * 1e4) / tvl
        );
    }

    function syncBalance(uint256 perpDexbalance) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        _syncPendleBalance();
        syncPerpDexBalance(perpDexbalance);
        _calculatePps();
    }

    function _syncPendleBalance() private {
        totalPendleBalance = _ethAmountToScAmount(vaultState.totalPtAmount);
    }

    function getUserState()
        external
        view
        returns (uint256 ptTokenAmount, uint256 scTokenAmount)
    {
        ptTokenAmount = depositReceipts[msg.sender].depositPtAmount;

        uint256 tvlUser = (depositReceipts[msg.sender].shares *
            _getPricePerShare()) / 10 ** vaultParams.scDecimals;
        scTokenAmount = tvlUser - _ethAmountToScAmount(ptTokenAmount);
    }

    function getUserDepositReciept() external view returns (DepositReceiptPendle memory) {
        return depositReceipts[msg.sender];
    }

    function getUserWithdraw() external view returns (WithdrawPendle memory) {
        if (withdrawals[msg.sender].shares == 0)
            return WithdrawPendle(0, 0, 0, 0, false);

        WithdrawPendle memory withdrawal = WithdrawPendle(
            withdrawals[msg.sender].shares,
            withdrawals[msg.sender].performanceFee,
            withdrawals[msg.sender].ptWithdrawAmount,
            withdrawals[msg.sender].scWithdrawAmount - networkCost,
            withdrawals[msg.sender].isForceWithdraw
        );

        return withdrawal;
    }

    /**
     * @notice get withdraw pool amount of the vault
     */
    function getWithdrawPoolAmount() external view returns (uint256, uint256) {
        return (
            vaultState.scWithdrawPoolAmount,
            vaultState.ptWithdrawPoolAmount
        );
    }

    function getVaultState() external view returns (VaultStatePendle memory) {
        _auth(ROCK_ONYX_ADMIN_ROLE);

        return vaultState;
    }
}
