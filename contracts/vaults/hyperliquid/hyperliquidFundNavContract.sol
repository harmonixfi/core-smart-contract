// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../../interfaces/IFundNavContract.sol";
import "../../extensions/BaseAccessControlUpgradeable.sol";
import "hardhat/console.sol";

contract HyperliquidFundNavContract is IFundNavContract, Initializable, BaseAccessControlUpgradeable {
    address admin;

    function initialize(address _admin) public initializer {
        _grantRole(Role.ADMIN, _admin);
    }

    function getFundNavValue() external view returns (uint256) {
        return 1000;
    }
}
