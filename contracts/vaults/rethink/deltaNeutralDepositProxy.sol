// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../interfaces/Fluid/IFluidPositionReader.sol";
import "../../interfaces/Rethink/IFundContract.sol";
import "../../interfaces/IDeltaNeutralNavReader.sol";
import "../../interfaces/IWETH.sol";
import "../../extensions/TransferHelper.sol";
import "hardhat/console.sol";

contract DeltaNeutralDepositProxy is Initializable, ReentrancyGuardUpgradeable {
    address admin;
    address bearingToken;
    address fundContract;
    address wethAddress;
    address navReaderAddress;
    address safeWalletAddress;
    uint256 currentRound;
    mapping(uint256 => mapping(address => uint256)) depositReceipts;
    mapping(uint256 => address[]) public depositAddresses;
    mapping(uint256 => mapping(address => uint256)) withdraws;
    mapping(uint256 => address[]) public withdrawAddresses;
    mapping(address => uint256) public UserBalance;
    bool isNavUpdateProcessing;
    uint256[50] private ______gap;

    /************************************************
     *  EVENTS
     ***********************************************/
    event UserDeposited(address indexed account, uint256 amount);
    event RequestDeposit(uint256 amount);
    event DepositedToFundContract();
    event InitiateWithdrawal(
        address indexed account,
        uint256 amount,
        uint256 shares
    );
    event Withdrawn(address indexed account, uint256 amount, uint256 shares);

    function initialize(
        address _admin,
        address _wethAddress,
        address _bearingToken,
        address _safeWalletAddress,
        address _navReaderAddress
    ) public initializer {
        admin = _admin;
        wethAddress = _wethAddress;
        bearingToken = _bearingToken;
        fundContract = _bearingToken;
        safeWalletAddress = _safeWalletAddress;
        navReaderAddress = _navReaderAddress;
    }

    receive() external payable {}

    function depositNative() external payable nonReentrant {
        require(msg.value > 0, "INVALID_DEPOSIT_AMOUNT");

        IWETH(wethAddress).deposit{value: msg.value}();

        if (depositReceipts[currentRound][msg.sender] == 0)
            depositAddresses[currentRound].push(msg.sender);
        depositReceipts[currentRound][msg.sender] += msg.value;

        emit UserDeposited(msg.sender, msg.value);
    }

    function depositWeth(uint256 amount) external nonReentrant {
        require(amount > 0, "INVALID_DEPOSIT_AMOUNT");

        TransferHelper.safeTransferFrom(
            wethAddress,
            msg.sender,
            address(this),
            amount
        );

        if (depositReceipts[currentRound][msg.sender] == 0)
            depositAddresses[currentRound].push(msg.sender);
        depositReceipts[currentRound][msg.sender] += amount;

        emit UserDeposited(msg.sender, amount);
    }

    function requestDepositToFundContract() external nonReentrant {
        require(msg.sender == admin, "INVALID_ADMIN");
        require(isNavUpdateProcessing == false, "NAV_UPDATE_PROCESSING");
        isNavUpdateProcessing = true;
        TransferHelper.safeApprove(
            wethAddress,
            fundContract,
            IERC20(wethAddress).balanceOf(address(this))
        );

        uint256 depositAmount = _getRoundPendingDepositAmount(currentRound);
        bytes4 signature = bytes4(keccak256("requestDeposit(uint256)"));
        bytes memory encodedParameter = abi.encode(depositAmount);
        bytes memory encodedFunctionCall = abi.encodePacked(
            signature,
            encodedParameter
        );

        IFundContract(fundContract).fundFlowsCall(encodedFunctionCall);
        currentRound++;

        emit RequestDeposit(depositAmount);
    }

    function requestDepositToFundContract(uint256 eth_amount) external nonReentrant {
        require(msg.sender == admin, "INVALID_ADMIN");
        require(isNavUpdateProcessing == false, "NAV_UPDATE_PROCESSING");
        isNavUpdateProcessing = true;
        TransferHelper.safeApprove(
            wethAddress,
            fundContract,
            IERC20(wethAddress).balanceOf(address(this))
        );

        bytes4 signature = bytes4(keccak256("requestDeposit(uint256)"));
        bytes memory encodedParameter = abi.encode(eth_amount);
        bytes memory encodedFunctionCall = abi.encodePacked(
            signature,
            encodedParameter
        );

        IFundContract(fundContract).fundFlowsCall(encodedFunctionCall);
        // currentRound++;

        emit RequestDeposit(eth_amount);
    }

    function updateRound(uint256 _currentRound) external nonReentrant {
        require(msg.sender == admin, "INVALID_ADMIN");
        currentRound = _currentRound;
    }

    function depositToFundContract() external nonReentrant {
        require(msg.sender == admin, "INVALID_ADMIN");
        require(isNavUpdateProcessing == true, "INVALID_NAV_UPDATE_STATE");
        bytes memory signature = abi.encodeWithSelector(
            bytes4(keccak256("deposit()"))
        );

        // track prev yield bearing token
        uint256 prevBearingTokenBalance = IERC20(bearingToken).balanceOf(
            address(this)
        );
        console.log("prevBearingTokenBalance %s", prevBearingTokenBalance);

        IFundContract(fundContract).fundFlowsCall(signature);
        
        // track after
        uint256 afterBearingTokenBalance = IERC20(bearingToken).balanceOf(
            address(this)
        );
        console.log("afterBearingTokenBalance %s", afterBearingTokenBalance);

        uint256 receivedBearingTokenBance = afterBearingTokenBalance - prevBearingTokenBalance;
        console.log("receivedBearingTokenBance %s", receivedBearingTokenBance);

        _distributeBearingToken(receivedBearingTokenBance);
        isNavUpdateProcessing = false;

        emit DepositedToFundContract();
    }

    function totalValueLocked() external view returns (uint256) {
        return
            IERC20(wethAddress).balanceOf(address(this)) + 
            IFundContract(fundContract).totalNAV();
    }

    function getPendingDeposit(address user) external view returns (uint256) {
        return depositReceipts[currentRound][user];
    }

    function getRoundPendingDepositAmount(uint256 round) external view returns (uint256) {
        return _getRoundPendingDepositAmount(round);
    }

    function getCurrentRound() external view returns (uint256) {
        return currentRound;
    }

    function balanceOf(address user) external view returns (uint256) {
        return UserBalance[user];
    }

    function delegate(address delegatee) external nonReentrant {
        require(msg.sender == admin, "INVALID_ADMIN");
        IFundContract(fundContract).delegate(delegatee);
    }

    function delegates() external view returns (address) {
        return IFundContract(fundContract).delegates(address(this));
    }

    function pricePerShare() external view returns (uint256) {
        if(IFundContract(fundContract).totalSupply() == 0) 
            return 1;
        return
            (IFundContract(fundContract).totalNAV() * 10 ** ERC20(wethAddress).decimals()) / IFundContract(fundContract).totalSupply();
    }

    function _distributeBearingToken(uint256 receivedBearingTokenBance) private {
        require(receivedBearingTokenBance > 0, "NO_BEARING_TOKEN_TO_DISTRIBUTE");

        console.log("Starting to distribute bearing token for round %s", currentRound - 1);
        uint256 totalPendingAmount = _getRoundPendingDepositAmount(
            currentRound - 1
        );
        console.log("Total pending amount for round %s: %s", currentRound - 1, totalPendingAmount);

        address[] memory depositors = depositAddresses[currentRound - 1];
        console.log("Number of depositors for round %s: %s", currentRound - 1, depositors.length);

        for (uint256 i = 0; i < depositors.length; i++) {
            address depositor = depositors[i];
            uint256 depositAmount = depositReceipts[currentRound - 1][
                depositor
            ];
            console.log("Depositor %s has deposited %s for round %s", depositor, depositAmount, currentRound - 1);

            if (depositAmount > 0) {
                uint256 shareAmount = (receivedBearingTokenBance * depositAmount) /
                    totalPendingAmount;
                UserBalance[depositor] += shareAmount;
                console.log("Distributing %s bearing tokens to %s for round %s", shareAmount, depositor, currentRound - 1);
            }
        }
        console.log("Distribution of bearing tokens for round %s completed", currentRound - 1);
    }

    function _getRoundPendingDepositAmount(
        uint256 round
    ) private view returns (uint256) {
        uint256 totalAmount;
        address[] memory depositors = depositAddresses[round];
        for (uint256 i = 0; i < depositors.length; i++) {
            totalAmount += depositReceipts[round][depositors[i]];
        }

        return totalAmount;
    }

    function updateUserBalance(address[] memory users, uint256[] memory amounts) external nonReentrant {
        require(msg.sender == admin, "INVALID_ADMIN");
        require(users.length == amounts.length, "Invalid input");

        for (uint256 i = 0; i < users.length; i++) {
            UserBalance[users[i]] = amounts[i];
        }
    }

    function getWithdrawPoolAmount() external view returns (uint256) {
        return 0;
    }

    function emergencyShutdown(
        address receiver,
        address tokenAddress,
        uint256 amount
    ) external nonReentrant {
        require(msg.sender == admin, "INVALID_ADMIN");
        IERC20 token = IERC20(tokenAddress);
        require(amount > 0, "INVALID_AMOUNT");
        require(
            token.balanceOf(address(this)) >= amount,
            "INSUFFICIENT_BALANCE"
        );

        bool sent = token.transfer(receiver, amount);
        require(sent, "TOKEN_TRANSFER_FAILED");
    }
}