// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "../../extensions/BaseAccessControlUpgradeable.sol";
import "hardhat/console.sol";

contract BalanceContract is
    Initializable,
    ReentrancyGuardUpgradeable,
    BaseAccessControlUpgradeable
{
    mapping(address => bool) private allowedTargets;
    mapping(address => mapping(bytes4 => bool)) private allowedFunctions;
    mapping(address => mapping(bytes4 => mapping(uint256 => mapping(bytes32 => bool))))
        private allowedParams;
    mapping(address => mapping(bytes4 => mapping(uint256 => bool)))
        public hasRestrictedParams;

    /************************************************
     *  EVENTS
     ***********************************************/
    event AllowContractUpdated(address indexed target, bool status);
    event AllowFunctionUpdated(
        address indexed target,
        bytes4 indexed selector,
        bool status
    );
    event AllowParameterUpdated(
        address indexed target,
        bytes4 indexed selector,
        uint256 indexed paramIndex,
        bytes32 paramHash,
        bool status
    );

    function initialize(
        address _admin,
        address _operator,
        address _approver
    ) public initializer {
        _grantRole(Role.ADMIN, _admin);
        _grantRole(Role.OPERATOR, _operator);
        _grantRole(Role.ACTION_APPROVER, _approver);
    }

    receive() external payable {}

    function approveAction(
        uint8 _actionType, // 0 = Contract, 1 = Function, 2 = Parameter
        address _target,
        bytes4 _selector,
        uint256 _paramIndex,
        bytes32 _paramHash,
        bool _status
    ) external nonReentrant {
        _auth(Role.ACTION_APPROVER);

        if (_actionType == 0) {
            require(_target != address(0), "INVALID_CONTRACT_TARGET");
            allowedTargets[_target] = _status;
            emit AllowContractUpdated(_target, _status);
        } else if (_actionType == 1) {
            allowedFunctions[_target][_selector] = _status;
            emit AllowFunctionUpdated(_target, _selector, _status);
        } else if (_actionType == 2) {
            allowedParams[_target][_selector][_paramIndex][
                _paramHash
            ] = _status;

            hasRestrictedParams[_target][_selector][_paramIndex] = _status;
            emit AllowParameterUpdated(
                _target,
                _selector,
                _paramIndex,
                _paramHash,
                _status
            );
        } else {
            revert("INVALID_ACTION_TYPE");
        }
    }

    // Function to check if a function is allowed
    function isActionAllowed(
        address _target,
        bytes memory _data
    ) public view returns (bool) {
        if (allowedTargets[_target]) return true;

        bytes4 selector = _extractSelector(_data);
        if (allowedFunctions[_target][selector]) return true;
        if (_validateParameters(_target, selector, _data)) return true;

        return false;
    }

    // Function to execute a transaction
    function executeAction(
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external payable nonReentrant returns (bytes memory) {
        _auth(Role.OPERATOR);

        require(_target != address(0), "INVALID_TARGET");
        require(msg.value == _value, "INVALID_VALUE");
        require(isActionAllowed(_target, _data), "FUNCTION_NOT_WHITELISTED");

        // Execute the call
        (bool success, bytes memory result) = _target.call{value: _value}(
            _data
        );

        require(success, "Transaction failed");

        return result;
    }

    function executeBatchActions(
        address[] calldata _targets,
        uint256[] calldata _values,
        bytes[] calldata _data
    ) external payable nonReentrant returns (bool[] memory) {
        _auth(Role.OPERATOR);

        require(
            _targets.length == _values.length && _values.length == _data.length,
            "MISMATCHED_ARRAYS"
        );

        uint256 totalValue = _calculateTotalValue(_values);
        require(msg.value == totalValue, "INVALID_VALUE");

        bool[] memory results = new bool[](_targets.length);
        for (uint256 i = 0; i < _targets.length; i++) {
            require(
                isActionAllowed(_targets[i], _data[i]),
                string(
                    abi.encodePacked(
                        "FUNCTION_NOT_WHITELISTED_AT_INDEX_",
                        Strings.toString(i)
                    )
                )
            );

            (bool success, ) = _targets[i].call{value: _values[i]}(_data[i]);

            require(success, "Transaction failed");

            results[i] = success;
        }

        return results;
    }

    function _calculateTotalValue(
        uint256[] calldata _values
    ) private pure returns (uint256) {
        uint256 totalValue;
        for (uint256 i = 0; i < _values.length; i++) {
            totalValue += _values[i];
        }
        return totalValue;
    }

    function _validateParameters(
        address _target,
        bytes4 _selector,
        bytes memory _data
    ) private view returns (bool) {
        uint256 numParams = (_data.length - 4) / 32;
        bool hasRestrictions = false;

        for (uint256 i = 0; i < numParams; i++) {
            bytes32 paramHash = _extractParameter(_data, i);
            if (hasRestrictedParams[_target][_selector][i]) {
                hasRestrictions = true;
                if (!allowedParams[_target][_selector][i][paramHash]) {
                    return false;
                }
            }
        }

        return hasRestrictions;
    }

    function _extractParameter(
        bytes memory _data,
        uint256 _index
    ) private pure returns (bytes32) {
        require(
            _data.length >= 4 + (_index + 1) * 32,
            "INVALID_PARAMETER_INDEX"
        );
        bytes32 param;
        assembly {
            param := mload(add(add(_data, 36), mul(_index, 32))) // 32 (data offset) + 4 (selector)
        }
        return keccak256(abi.encode(param));
    }

    function _extractSelector(
        bytes memory _data
    ) private pure returns (bytes4) {
        require(_data.length >= 4, "INVALID_FUNCTION_CALL");
        bytes4 selector;
        assembly {
            selector := mload(add(_data, 32)) // Extracts the first 4 bytes
        }
        return selector;
    }

    function version() public pure returns (string memory) {
        return "1.0.0";
    }
}
