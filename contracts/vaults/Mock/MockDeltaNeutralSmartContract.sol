// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../lib/ShareMath.sol";

contract MockDeltaNeutralSmartContract is ReentrancyGuardUpgradeable {
    using ShareMath for uint256;

    uint256 internal initialPPS;

    struct DepositReceipt {
        uint256 shares;
        uint256 depositAmount;
    }

    struct Withdrawal {
        uint256 shares;
        uint256 withdrawAmount;
        uint256 pps;
    }

    struct VaultParams {
        uint8 decimals;
        address asset;
        uint256 minimumSupply;
        uint256 cap;
    }

    struct VaultState {
        uint256 totalShares;
        uint256 pendingDepositAmount;
        uint256 withdrawPoolAmount;
    }

    mapping(address => DepositReceipt) internal depositReceipts;
    mapping(address => Withdrawal) internal withdrawals;

    VaultParams internal vaultParams;
    VaultState internal vaultState;

    event Deposited(
        address indexed account,
        address indexed tokenIn,
        uint256 amount,
        uint256 shares
    );
    event RequestFunds(
        address indexed account,
        uint256 withdrawalAmount,
        uint256 shares
    );
    event Withdrawn(address indexed account, uint256 amount, uint256 shares);

    function initialize() external initializer {}

    receive() external payable {}

    /**
     * @notice Mints the vault shares for depositor
     * @param amount is the amount of `asset` deposited
     */
    function deposit(uint256 amount, address tokenIn) external nonReentrant {
        uint256 shares = amount;
        emit Deposited(msg.sender, tokenIn, amount, shares);
    }

    /**
     * @notice Initiates a withdrawal that can be processed once the round completes
     * @param shares is the number of shares to withdraw
     */
    function initiateWithdrawal(uint256 shares) external nonReentrant {
        emit RequestFunds(msg.sender, shares, shares);
    }

    /**
     * @notice Completes a scheduled withdrawal from a past round. Uses finalized pps for the round
     * @param shares is the number of shares to withdraw
     */
    function completeWithdrawal(uint256 shares) external nonReentrant {
        emit Withdrawn(msg.sender, shares, withdrawals[msg.sender].shares);
    }
}
