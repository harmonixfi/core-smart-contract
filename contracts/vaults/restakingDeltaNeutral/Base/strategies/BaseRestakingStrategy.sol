// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../../../../extensions/TransferHelper.sol";
import "../../../../extensions/RockOnyxAccessControl.sol";
import "./../../Base/BaseSwapVault.sol";
import "../../structs/RestakingDeltaNeutralStruct.sol";
import "hardhat/console.sol";

abstract contract BaseRestakingStrategy is BaseSwapVault, RockOnyxAccessControl, ReentrancyGuardUpgradeable {
    uint64 internal constant ARBTRIUM_NETWORK = 42161;
    uint64 internal constant ETHEREUM_NETWORK = 1;
    IERC20 internal usdcToken;
    IERC20 internal ethToken;
    IERC20 internal restakingToken;
    EthRestakingState internal restakingState;
    uint64 internal network;

    // Events
    event Deposited(address indexed proxy, uint256 amount);
    event Withdrawn(address indexed proxy, uint256 amount);

    event PositionOpened(uint256 usdcAmount, uint256 ethAmount);
    event PositionClosed(uint256 ethAmount, uint256 usdcAmount);

    function ethRestaking_Initialize(
        address _restakingToken,
        address _usdcAddress,
        address _ethAddress,
        address _swapAddress,
        address[] memory _token0s,
        address[] memory _token1s,
        uint24[] memory _fees,
        uint64 _network
    ) internal virtual {
        usdcToken = IERC20(_usdcAddress);
        ethToken = IERC20(_ethAddress);
        restakingToken = IERC20(_restakingToken);
        network = _network;
        baseSwapVault_Initialize(_swapAddress, _token0s, _token1s, _fees);
    }

    // Function to handle deposits to the staking strategies and allocate points
    function depositToRestakingStrategy(uint256 amount) internal {
        require(amount > 0, "INVALID_AMOUNT");

        restakingState.unAllocatedBalance += amount;
        restakingState.totalBalance += amount;
    }

    function openPosition(uint256 usdcAmount, bytes calldata swapCallData) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);
        require(restakingState.unAllocatedBalance > usdcAmount, "INSUFICIENT_BALANCE");

        TransferHelper.safeApprove(address(usdcToken), address(getSwapAggregator()), usdcAmount);
        uint256 ethAmount = getSwapAggregator().swapTo(
            address(this),
            address(usdcToken),
            usdcAmount,
            address(ethToken), 
            swapCallData
        );

        restakingState.unAllocatedBalance -= usdcAmount;

        emit PositionOpened(usdcAmount, ethAmount);
    }

    function closePosition(uint256 ethAmount, bytes calldata swapCallData) external nonReentrant {
        _auth(ROCK_ONYX_OPTIONS_TRADER_ROLE);

        TransferHelper.safeApprove(address(ethToken), address(getSwapAggregator()), ethAmount);
        uint256 usdcAmount = getSwapAggregator().swapTo(
            address(this),
            address(ethToken),
            ethAmount,
            address(usdcToken),
            swapCallData
        );

        restakingState.unAllocatedBalance += usdcAmount;
        emit PositionClosed(ethAmount, usdcAmount);
    }

    function depositToRestakingProxy(uint256 ethAmount, bytes calldata swapCallData) external virtual nonReentrant {}
    
    function withdrawFromRestakingProxy(uint256 ethAmount, bytes calldata swapCallData) external virtual nonReentrant {}

    function syncRestakingBalance() internal virtual{
        uint256 ethAmount = ethToken.balanceOf(address(this)) + restakingToken.balanceOf(address(this)) * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
        restakingState.totalBalance = restakingState.unAllocatedBalance + ethAmount * swapProxy.getPriceOf(address(restakingToken), address(ethToken)) / 1e18;
    }

    function getTotalRestakingTvl() internal view returns (uint256) {
        return restakingState.totalBalance;
    }

    function acquireFundsFromRestakingStrategy(uint256 amount) internal returns (uint256){
        uint256 unAllocatedBalance = restakingState.unAllocatedBalance;
        require(amount <= unAllocatedBalance, "INVALID_ACQUIRE_AMOUNT");

        restakingState.unAllocatedBalance -= amount;
        restakingState.totalBalance -= amount;
        return amount;
    }

    /**
     * @dev Retrieves the unallocated balance in the Ethereum Stake & Lend strategy.
     * @return The unallocated balance in the Ethereum Stake & Lend strategy.
     */
    function getEthStakingState() external view returns (EthRestakingState memory) {
        _auth(ROCK_ONYX_ADMIN_ROLE);
        
        return restakingState;
    }
}
