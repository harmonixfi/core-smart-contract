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

        perpDex_Initialize(_perpDexAddress, _perpDexReceiver, _usdc, _perpDexConnector);

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _admin);
    }

    /**
     * @param _ptTokenAmount amount ptToken deposit == amount usdc
     */
    function depositToPendleHegdeVault(uint256 _ptTokenAmount, address _ptToken) external nonReentrant {
        require(paused == false, "VAULT_PAUSED");
        require(_ptTokenAmount > 0, "INVALID_AMOUNT_DEPOSIT");
        TransferHelper.safeTransferFrom(vaultParams.asset, msg.sender, address(this), _ptTokenAmount);
        depositReceipts[msg.sender].depositAmount += _ptTokenAmount;
        depositReceipts[msg.sender].ptToken = _ptToken;
        this.depositToVendor(30000);
    }
}