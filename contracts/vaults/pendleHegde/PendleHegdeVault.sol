// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../restakingDeltaNeutral/Base/strategies/PerpDexStrategy.sol";
import "../../extensions/TransferHelper.sol";
import "../pendleHegde/structs/PendleStruct.sol";

contract PendleHegdeVault is Initializable, PerpDexStrategy {
    VaultParamsPendle internal vaultParams;
    VaultStatePendle internal vaultState;
    uint256 internal initialPPS;
    mapping(address => DepositReceiptPendle) internal depositReceipts;

    /************************************************
     *  EVENTS
     ***********************************************/

    event Deposit();

    event Withdrawn();

    function initialize(
        address _admin,
        address _usdc,
        uint8 _decimals,
        uint256 _minimunSupply,
        uint256 _cap,
        address _perpDexAddress,
        address _perpDexReceiver,
        address _perpDexConnector,
        uint256 _initialPPS
    ) public initializer {
        vaultParams = VaultParamsPendle(
            _decimals,
            _usdc,
            _minimunSupply,
            _cap,
            10,
            1
        );
        vaultState = VaultStatePendle(0, 0, 0, 0, block.timestamp);
        initialPPS = _initialPPS;
        paused = false;

        perpDex_Initialize(
            _perpDexAddress,
            _perpDexReceiver,
            _usdc,
            _perpDexConnector
        );

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _admin);
    }

    /**
     * @param _ptAddress address of PT token
     * @param _stcAddress address of stable coin(USDC)
     * @param _ptAmount amount of PT token
     * @param _stcAmount amount of stable coin(USDC)
     */
    function deposit(
        address _ptAddress,
        address _stcAddress,
        uint256 _ptAmount,
        uint256 _stcAmount
    ) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(_ptAmount > 0, "INVALID_AMOUNT_DEPOSIT_TOKEN_0");
        require(_stcAmount > 0, "INVALID_AMOUNT_DEPOSIT_TOKEN_1");
        // TransferHelper.safeTransferFrom(
        //     vaultParams.asset,
        //     msg.sender,
        //     address(this),
        //     _ptTokenAmount
        // );
        // depositReceipts[msg.sender].depositAmount += _ptTokenAmount;
        // depositReceipts[msg.sender].ptToken = _ptToken;
        this.depositToVendor(30000);
    }

    function estimateUsdcAmountToDeposit(
        address _ptAddress,
        uint256 _amount
    ) external nonReentrant {}

    function estimateWithdrawalTokenAmount() external nonReentrant {}

    function initateWithdrawal() external nonReentrant {}

    function completeWithdrawal() external nonReentrant {}

    function pricePerShare() external nonReentrant {}

    function totalValueLocked() external nonReentrant {}

    function balanceOf() external nonReentrant {}
}
