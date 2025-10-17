// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../../interfaces/IPyth.sol";
import "../../extensions/TransferHelper.sol";
import "./fundContract.sol";

contract ZapFundContract is FundContract {
    IPyth private pyth;
    mapping(address => bytes32) private priceFeedIds;

    /**
     * @notice Sets up the Pyth oracle contract address for price feeds
     * @param _pyth The address of the Pyth oracle contract
     */
    function setUpPyth(address _pyth) external {
        _auth(Role.ADMIN);

        pyth = IPyth(_pyth);
    }

    /**
     * @notice Adds price feeds for supported tokens
     * @param tokens The array of token addresses
     * @param feedIds The array of Pyth price feed IDs
     */

    function addPriceFeeds(
        address[] calldata tokens,
        bytes32[] calldata feedIds
    ) external {
        _auth(Role.ADMIN);

        require(tokens.length == feedIds.length, "INV_LENGTH_MISMATCH");
        for (uint i = 0; i < tokens.length; i++) {
            priceFeedIds[tokens[i]] = feedIds[i];
        }
    }

    /**
     * @notice Deposits assets with slippage protection
     * @param _receiver The address to receive the shares
     * @param _minSharesOut The minimum shares to receive
     * @return The number of shares minted
     */
    function zapDepositWithSlippage(
        address _tokenIn,
        uint256 _tokenInAmount,
        address _receiver,
        uint256 _minSharesOut
    ) public nonReentrant returns (uint256) {
        require(_tokenInAmount > 0, "INV_AMOUNT");
        require(priceFeedIds[_tokenIn] != bytes32(0), "TOKEN_UNSUPPORTED");

        TransferHelper.safeTransferFrom(
            _tokenIn,
            msg.sender,
            address(this),
            _tokenInAmount
        );

        uint256 assetEquivalent = _convertTokenToAsset(
            _tokenIn,
            _tokenInAmount
        );

        uint256 shares = _deposit(assetEquivalent, _receiver, _minSharesOut);

        TransferHelper.safeTransfer(_tokenIn, balanceContract, _tokenInAmount);

        return shares;
    }

    /**
     * @notice Reviews the number of shares that would be received for a deposit
     * @param _tokenIn The address of the token to deposit
     * @param _tokenInAmount The amount of token to deposit
     * @return The number of shares that would be received
     */
    function reviewZapDeposit(
        address _tokenIn,
        uint256 _tokenInAmount
    ) public view returns (uint256) {
        require(priceFeedIds[_tokenIn] != bytes32(0), "TOKEN_UNSUPPORTED");

        uint256 assetEquivalent = _convertTokenToAsset(
            _tokenIn,
            _tokenInAmount
        );

        return previewDeposit(assetEquivalent);
    }

    /**
     * @notice Converts a token amount to an asset amount
     * @param _tokenIn The address of the token to convert
     * @param _tokenInAmount The amount of token to convert
     * @return The amount of asset that would be received
     */
    function _convertTokenToAsset(
        address _tokenIn,
        uint256 _tokenInAmount
    ) private view returns (uint256) {
        Price memory tokenInPrice = pyth.getPriceUnsafe(priceFeedIds[_tokenIn]);
        uint256 tokenInPriceValueDecimals = ShareMath.toDecimals(
            uint256(int256(tokenInPrice.price)),
            tokenInPrice.expo
        );

        Price memory assetPrice = pyth.getPriceUnsafe(priceFeedIds[asset()]);
        uint256 assetPriceValueDecimals = ShareMath.toDecimals(
            uint256(int256(assetPrice.price)),
            assetPrice.expo
        );

        return
            (_tokenInAmount *
                (10 ** decimals()) *
                uint256(int256(tokenInPriceValueDecimals))) /
            (10 ** ERC20(_tokenIn).decimals() *
                uint256(int256(assetPriceValueDecimals)));
    }
}
