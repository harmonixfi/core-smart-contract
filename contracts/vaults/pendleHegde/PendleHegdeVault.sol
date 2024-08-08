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
     * @notice deposit to the Aevo
     */
    function deposit(
        address _token0Address,
        uint256 _token0Amount,
        address _token1Address,
        uint256 _token1Amount
    ) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(_token0Amount > 0, "INVALID_AMOUNT_DEPOSIT_TOKEN_0");
        require(_token1Amount > 0, "INVALID_AMOUNT_DEPOSIT_TOKEN_1");
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
}