// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../interfaces/IHarmonixVault.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../extensions/RockOnyxAccessControl.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract PoolFactory is Initializable, RockOnyxAccessControl, ReentrancyGuardUpgradeable {
    address public admin;
    mapping(address => bool) public registeredVaults;
    address[] public vaultList;

    event VaultRegistered(address indexed vault);
    event VaultRemoved(address indexed vault);

    function initialize() public initializer {
        _grantRole(ROCK_ONYX_ADMIN_ROLE, msg.sender);
        accessControl_Initialize();
    }

    function registerVault(address vault) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        require(vault != address(0), "Invalid vault address");
        require(!registeredVaults[vault], "Vault already registered");

        registeredVaults[vault] = true;
        vaultList.push(vault);

        emit VaultRegistered(vault);
    }

    function removeVault(address vault) external nonReentrant {
        require(registeredVaults[vault], "Vault not registered");

        registeredVaults[vault] = false;

        for (uint256 i = 0; i < vaultList.length; i++) {
            if (vaultList[i] == vault) {
                vaultList[i] = vaultList[vaultList.length - 1];
                vaultList.pop();
                break;
            }
        }

        emit VaultRemoved(vault);
    }

    function getVaultsTVL() external view returns (uint256) {
        uint256 totalTVL = 0;

        for (uint256 i = 0; i < vaultList.length; i++) {
            if (registeredVaults[vaultList[i]]) {
                IHarmonixVault vault = IHarmonixVault(vaultList[i]);
                totalTVL += vault.totalValueLocked();
            }
        }

        return totalTVL;
    }
}
