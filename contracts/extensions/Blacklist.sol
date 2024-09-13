// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./RockOnyxAccessControl.sol";

contract Blacklist is RockOnyxAccessControl, ReentrancyGuardUpgradeable {
    mapping(address => bool) internal blackList;

    //event
    event Blacklisted(address indexed wallet);
    event Whitelisted(address indexed wallet);

    function blackList_Initialize(address _admin) internal virtual {
        _grantRole(ROCK_ONYX_ADMIN_ROLE, _admin);
    }

    function addToBlacklist(address _wallet) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        require(!blackList[msg.sender], "Address is already in blacklisted");
        blackList[msg.sender] = true;
        emit Blacklisted(_wallet);
    }

    function removeFromBlacklist(address _wallet) external nonReentrant {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        require(blackList[msg.sender], "Address is not blacklisted");
        blackList[msg.sender] = false;
        emit Whitelisted(_wallet);
    }
}
