// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../extensions/BaseAccessControlUpgradeable.sol";
import "../../extensions/TransferHelper.sol";
import "hardhat/console.sol";

contract BalanceContractMock is
    Initializable,
    ReentrancyGuardUpgradeable,
    BaseAccessControlUpgradeable
{
    function initialize(
        address _admin,
        address _operator,
        address _approver
    ) public initializer {
        _grantRole(Role.ADMIN, _admin);
        _grantRole(Role.OPERATOR, _operator);
        _grantRole(Role.ACTION_APPROVER, _approver);
    }

    function executeAction(
        address _target,
        uint256 _value,
        bytes calldata _data
    ) external payable nonReentrant returns (bytes memory) {
        // Execute the call
        (bool success, bytes memory result) = _target.call{value: _value}(
            _data
        );
        require(success, "Transaction failed");

        return result;
    }
}
