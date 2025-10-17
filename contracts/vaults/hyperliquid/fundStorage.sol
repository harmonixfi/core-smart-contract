// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../../extensions/BaseAccessControlUpgradeable.sol";
import "hardhat/console.sol";

// @title DataStore
// @dev DataStore for all general state values
contract FundStorage is Initializable, BaseAccessControlUpgradeable {
    // store for uint values
    mapping(bytes32 => uint8) public uint8Values;
    // store for uint values
    mapping(bytes32 => uint256) public uint256Values;
    // store for address values
    mapping(bytes32 => address) public addressValues;
    // store for bool values
    mapping(bytes32 => bool) public boolValues;
    
    function initialize(address _admin) public initializer {
        _grantRole(Role.ADMIN, _admin);
    }

    /**
     * @dev Only allows addresses with the CONTROLLER role to call the function.
     */
    modifier onlyController() {
        _auth(Role.CONTROLLER);
        _;
    }

// @dev get the uint value for the given key
    // @param key the key of the value
    // @return the uint value for the key
    function getUint8(bytes32 key) external view returns (uint8) {
        return uint8Values[key];
    }

    // @dev set the uint value for the given key
    // @param key the key of the value
    // @param value the value to set
    // @return the uint value for the key
    function setUint8(
        bytes32 key,
        uint8 value
    ) external onlyController returns (uint8) {
        uint8Values[key] = value;
        return value;
    }

    function removeUint8(bytes32 key) external onlyController {
        delete uint8Values[key];
    }

    // @dev get the uint value for the given key
    // @param key the key of the value
    // @return the uint value for the key
    function getUint256(bytes32 key) external view returns (uint256) {
        return uint256Values[key];
    }

    // @dev set the uint value for the given key
    // @param key the key of the value
    // @param value the value to set
    // @return the uint value for the key
    function setUint256(
        bytes32 key,
        uint256 value
    ) external onlyController returns (uint256) {
        uint256Values[key] = value;
        return value;
    }

    // @dev delete the uint value for the given key
    // @param key the key of the value
    function removeUint256(bytes32 key) external onlyController {
        delete uint256Values[key];
    }

    // @dev get the address value for the given key
    // @param key the key of the value
    // @return the address value for the key
    function getAddress(bytes32 key) external view returns (address) {
        return addressValues[key];
    }

    // @dev set the address value for the given key
    // @param key the key of the value
    // @param value the value to set
    // @return the address value for the key
    function setAddress(
        bytes32 key,
        address value
    ) external onlyController returns (address) {
        addressValues[key] = value;
        return value;
    }

    // @dev delete the address value for the given key
    // @param key the key of the value
    function removeAddress(bytes32 key) external onlyController {
        delete addressValues[key];
    }

    // @dev get the bool value for the given key
    // @param key the key of the value
    // @return the bool value for the key
    function getBool(bytes32 key) external view returns (bool) {
        return boolValues[key];
    }

    // @dev set the bool value for the given key
    // @param key the key of the value
    // @param value the value to set
    // @return the bool value for the key
    function setBool(
        bytes32 key,
        bool value
    ) external onlyController returns (bool) {
        boolValues[key] = value;
        return value;
    }

    // @dev delete the bool value for the given key
    // @param key the key of the value
    function removeBool(bytes32 key) external onlyController {
        delete boolValues[key];
    }
}
