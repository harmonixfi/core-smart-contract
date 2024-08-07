// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./structs/PendleStruct.sol";
import "../../extensions/RockOnyxAccessControl.sol";

contract PendleHegdeVault is Initializable, RockOnyxAccessControl {
    VaultParams internal vaultParams;
    VaultState internal vaultState;
    uint256 internal initialPPS;

    function initialize(
        address _admin,
        address _ptToken,
        address _usdc,
        uint8 _decimals,
        uint256 _minimunSupply,
        uint256 _cap,
        uint256 _initialPPS
    ) public initializer {
        vaultParams = VaultParams(
            _decimals,
            _usdc,
            _ptToken,
            _minimunSupply,
            _cap,
            10,
            1
        );
        vaultState = VaultState(0, 0, 0, 0, block.timestamp);
        initialPPS = _initialPPS;

        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
        _grantRole(ROCK_ONYX_OPTIONS_TRADER_ROLE, _admin);
    }
}
