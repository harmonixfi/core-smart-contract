// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "../../interfaces/AggregatorV3Interface.sol";
import "../../interfaces/IPriceConsumerProxy.sol";
import "../../extensions/Gmx/Keys.sol";
import "../../interfaces/Aave/IAavePool.sol";
import "../../interfaces/Fluid/IFluidPositionReader.sol";
import "../../interfaces/Gmx/IGmxV2DataStore.sol";
import "../../interfaces/Gmx/IGmxV2PositionTypes.sol";
import "hardhat/console.sol";

contract DeltaNeutralNavReader is Initializable {
    address admin;
    address fluidVaultResolver;
    address fluidPositionResolver;
    address gmxDataStoreAddress;
    address aavePoolAddress;
    IPriceConsumerProxy priceConsumer;
    address wbtc;
    address usdc;
    address usdt;
    address wsteth;
    address weth;
    address eth;
    bytes32 private constant SIZE_IN_USD = keccak256(abi.encode("SIZE_IN_USD"));
    bytes32 public constant MARKET = keccak256(abi.encode("MARKET"));
    bytes32 public constant BORROWING_FACTOR =
        keccak256(abi.encode("BORROWING_FACTOR"));
    bytes32 public constant BORROWING_EXPONENT_FACTOR =
        keccak256(abi.encode("BORROWING_EXPONENT_FACTOR"));

    function initialize(
        address _admin,
        address _aavePoolAddress,
        address _fluidVaultResolver,
        address _fluidPositionResolver,
        address _gmxDataStoreAddress,
        address _priceConsumer
    ) public initializer {
        admin = _admin;
        aavePoolAddress = _aavePoolAddress;
        fluidVaultResolver = _fluidVaultResolver;
        fluidPositionResolver = _fluidPositionResolver;
        gmxDataStoreAddress = _gmxDataStoreAddress;
        priceConsumer = IPriceConsumerProxy(_priceConsumer);
        wbtc = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
        usdc = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
        usdt = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
        wsteth = 0x5979D7b546E38E414F7E9822514be443A4800529;
        weth = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
        eth = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    }

    function getAccountValue(address user) external view returns (uint256) {
        uint256 aaveAccountValue = _getAaveAccountValue(user);
        uint256 fluidAccountValue = _getFluidAccountValue(user);
        uint256 gmxAccountValue = _getGmxAccountValue(user);
        uint256 adminBalance = _getAdminBalance(user);

        return
            aaveAccountValue +
            fluidAccountValue +
            adminBalance +
            gmxAccountValue;
    }

    function _getAaveAccountValue(address user) private view returns (uint256) {
        IAavePool aavePool = IAavePool(aavePoolAddress);
        (uint256 totalCollateralBase, uint256 totalDebtBase, , , , ) = aavePool
            .getUserAccountData(user);

        uint256 supplyAmount = totalCollateralBase;
        uint256 borrowAmount = totalDebtBase;
        return
            ((supplyAmount - borrowAmount) *
                priceConsumer.getPriceOf(usdc, weth)) / 1e8;
    }

    function _getUserFluidVaultNfts(
        address resolver,
        address user
    ) private view returns (uint256[] memory) {
        return IFluidVaultResolver(resolver).positionsNftIdOfUser(user);
    }

    function _getFluidAccountValue(
        address user
    ) private view returns (uint256) {
        uint256[] memory nftIds = _getUserFluidVaultNfts(
            fluidVaultResolver,
            user
        );

        IFluidPositionResolver.UserPosition[]
            memory positions = IFluidPositionResolver(fluidPositionResolver)
                .getPositionsForNftIds(nftIds);

        uint256 supplyAmount = 0;
        uint256 borrowAmount = 0;
        address vaultAddress = address(0);
        for (uint256 i = 0; i < positions.length; i++) {
            vaultAddress = IFluidVaultResolver(fluidVaultResolver).vaultByNftId(
                    nftIds[i]
                );
            IFluidVault.ConstantViews memory constantViews = IFluidVault(
                vaultAddress
            ).constantsView();

            supplyAmount += isEthAddress(constantViews.supplyToken)
                ? positions[i].supply
                : ((positions[i].supply *
                    priceConsumer.getPriceOf(constantViews.supplyToken, weth)) /
                    10 ** constantViews.supplyDecimals);
            borrowAmount += ((positions[i].borrow *
                priceConsumer.getPriceOf(usdc, weth)) /
                10 ** ERC20(usdc).decimals());
        }

        return supplyAmount - borrowAmount;
    }

    function _getGmxAccountValue(address user) private view returns (uint256) {
        uint256 netValue = 0;
        IGmxV2DataStore dataStore = IGmxV2DataStore(gmxDataStoreAddress);
        IGmxV2PositionTypes.Position[] memory positions = _getAccountPositions(
            dataStore,
            user
        );

        for (uint256 i = 0; i < positions.length; i++) {
            netValue += positions[i].sizeInUsd;
        }

        return
            ((netValue / 1e24) * priceConsumer.getPriceOf(usdc, weth)) /
            (10 ** ERC20(usdc).decimals());
    }

    function isEthAddress(address token) private view returns (bool) {
        address[2] memory ethAddresses = [eth, weth];
        for (uint256 i = 0; i < ethAddresses.length; i++) {
            if (ethAddresses[i] == token) {
                return true;
            }
        }
        return false;
    }

    function _getAccountPositionCount(
        IGmxV2DataStore dataStore,
        address account
    ) internal view returns (uint256) {
        return dataStore.getBytes32Count(Keys.accountPositionListKey(account));
    }

    function _getAccountPositionKeys(
        IGmxV2DataStore dataStore,
        address account,
        uint256 start,
        uint256 end
    ) private view returns (bytes32[] memory) {
        return
            dataStore.getBytes32ValuesAt(
                Keys.accountPositionListKey(account),
                start,
                end
            );
    }

    function _getAccountPositionKeys(
        IGmxV2DataStore dataStore,
        address account
    ) private view returns (bytes32[] memory keys) {
        uint256 positionCount = _getAccountPositionCount(dataStore, account);

        return _getAccountPositionKeys(dataStore, account, 0, positionCount);
    }

    function _getAccountPositions(
        IGmxV2DataStore dataStore,
        address account
    ) private view returns (IGmxV2PositionTypes.Position[] memory positions) {
        bytes32[] memory keys = _getAccountPositionKeys(dataStore, account);
        positions = new IGmxV2PositionTypes.Position[](keys.length);
        uint256 keysLength = keys.length;
        for (uint256 i = 0; i < keysLength; ++i) {
            positions[i].sizeInUsd = dataStore.getUint(
                keccak256(abi.encode(keys[i], SIZE_IN_USD))
            );
            positions[i].borrowingFactor = dataStore.getUint(
                keccak256(abi.encode(keys[i], BORROWING_FACTOR))
            );
            positions[i].market = dataStore.getAddress(
                keccak256(abi.encode(keys[i], MARKET))
            );
            positions[i].borrowingExponent = dataStore.getUint(
                keccak256(
                    abi.encode(
                        BORROWING_EXPONENT_FACTOR,
                        positions[i].market,
                        false
                    )
                )
            );
            uint256 borrowingFactor = dataStore.getUint(
                keccak256(
                    abi.encode(BORROWING_FACTOR, positions[i].market, false)
                )
            );
        }
    }

    function _getAdminBalance(address user) private view returns (uint256) {
        uint256 wbtcToEthPrice = (priceConsumer.getPriceOf(wbtc, usdc) *
            priceConsumer.getPriceOf(usdc, weth)) /
            (10 ** ERC20(usdc).decimals());
        uint256 wstethToEthPrice = priceConsumer.getPriceOf(wsteth, weth);
        uint256 usdToEthPrice = priceConsumer.getPriceOf(usdc, weth);

        return
            (ERC20(wbtc).balanceOf(user) * wbtcToEthPrice) /
            (10 ** ERC20(wbtc).decimals()) +
            (ERC20(wsteth).balanceOf(user) * wstethToEthPrice) /
            (10 ** ERC20(wsteth).decimals()) +
            ((ERC20(usdc).balanceOf(user) + ERC20(usdt).balanceOf(user)) *
                usdToEthPrice) /
            (10 ** ERC20(usdc).decimals());
    }
}
