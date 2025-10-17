// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../lib/WithdrawStore.sol";
import "../../lib/VaultStore.sol";

contract FundContractReader is Initializable {
    FundStorage private fundStorage;

    function initialize(address _fundStorage) public initializer {
        fundStorage = FundStorage(_fundStorage);
    }

    function getVaultState(
        address _vault
    ) external view returns (VaultStore.VaultState memory) {
        return _getVaultState(_vault);
    }

    function getVaultSetting(
        address _vault
    ) external view returns (VaultStore.VaultSetting memory) {
        return _getVaultSetting(_vault);
    }

    /**
     * @notice Get the deployment timestamp of the vault
     * @param _vault Address of the vault
     * @return Timestamp when the vault was deployed
     */
    function getDeployedTime(address _vault) external view returns (uint256) {
        return _getVaultState(_vault).deployedTimestamp;
    }

    function getUserWithdrawShares(
        address _vault,
        address _user
    ) external view returns (uint256) {
        bytes32 withdrawKey = WithdrawStore.getWithdrawKey(_vault, _user);
        UserWithdraw.WithdrawData memory userWithdraw = WithdrawStore.get(
            fundStorage,
            withdrawKey
        );

        return userWithdraw.shares;
    }

    /**
     * @notice get withdraw pool amount of the vault
     */
    function getWithdrawPoolAmount(
        address _vault
    ) external view returns (uint256) {
        return _getVaultState(_vault).withdrawPoolAmount;
    }

    /**
     * @notice get current price per share
     */
    function pricePerShare(address _vault) external view returns (uint256) {
        return _getVaultState(_vault).pricePerShare;
    }

    function totalValueLocked(address _vault) external view returns (uint256) {
        return _getVaultState(_vault).nav;
    }

    /**
     * @notice get fee information
     */
    function getFeeInfo(
        address _vault
    ) external view returns (uint256 performanceFee, uint256 managementFee) {
        VaultStore.VaultSetting memory VaultSetting = _getVaultSetting(_vault);
        performanceFee = VaultSetting.performanceFeeRate;
        managementFee = VaultSetting.managementFeeRate;
    }

    /**
     * @notice get high watermark of the vault
     */
    function highWatermark(address _vault) external view returns (uint256) {
        return _getVaultState(_vault).highWatermark;
    }

    /**
     * @notice get last harvest management fee time of the vault
     */
    function lastHarvestManagementFeeTime(
        address _vault
    ) external view returns (uint256) {
        return _getVaultState(_vault).lastHarvestManagementFeeTime;
    }

    /**
     * @notice get last harvest performance fee time of the vault
     */
    function lastHarvestPerformanceFeeTime(
        address _vault
    ) external view returns (uint256) {
        return _getVaultState(_vault).lastHarvestPerformanceFeeTime;
    }

    /**
     * @notice get vault fees
     */
    function getManagementFeeAmount(
        address _vault
    ) external view returns (uint256, uint256) {
        return (
            _getManagementFeeAmount(_vault, block.timestamp),
            block.timestamp
        );
    }

    function getPerformanceFeeAmount(
        address _vault
    ) external view returns (uint256) {
        return _getPerformanceFeeAmount(_vault);
    }

    function _getManagementFeeAmount(
        address _vault,
        uint256 timestamp
    ) internal view returns (uint256) {
        VaultStore.VaultSetting memory VaultSetting = _getVaultSetting(_vault);
        VaultStore.VaultState memory VaultState = _getVaultState(_vault);

        uint256 perSecondRate = (VaultSetting.managementFeeRate * 1e12) /
            (365 * 86400) +
            1; // +1 mean round up second rate
        uint256 period = timestamp - VaultState.lastHarvestManagementFeeTime;
        return (VaultState.nav * perSecondRate * period) / 1e14;
    }

    function _getPerformanceFeeAmount(
        address _vault
    ) internal view returns (uint256) {
        VaultStore.VaultSetting memory vaultSetting = _getVaultSetting(_vault);
        VaultStore.VaultState memory vaultState = _getVaultState(_vault);
        uint256 currentPPS = vaultState.pricePerShare;
        uint256 hWatermark = vaultState.highWatermark;

        if(currentPPS <= hWatermark) {
            return 0;
        }
        
        uint256 gainPerShare = currentPPS - hWatermark;
        uint256 totalProfit = (gainPerShare * vaultState.nav) /
            (10 ** ERC20(_vault).decimals());

        uint256 feeAmount = _calculatePerformanceFee(vaultSetting, totalProfit);

        return feeAmount;
    }

    function _calculatePerformanceFee(
        VaultStore.VaultSetting memory vaultSetting,
        uint256 _profit
    ) private pure returns (uint256) {
        return (_profit * vaultSetting.performanceFeeRate) / 1e2;
    }

    /**
     * @notice get total value locked vault
     */
    function _getVaultState(
        address _vault
    ) private view returns (VaultStore.VaultState memory) {
        bytes32 vaultKey = VaultStore.getVaultKey(_vault);
        VaultStore.VaultState memory vaultState = VaultStore.getVaultState(
            fundStorage,
            vaultKey
        );

        return vaultState;
    }

    /**
     * @notice get total value locked vault
     */
    function _getVaultSetting(
        address _vault
    ) private view returns (VaultStore.VaultSetting memory) {
        bytes32 vaultKey = VaultStore.getVaultKey(_vault);
        VaultStore.VaultSetting memory vaultState = VaultStore.getVaultSetting(
            fundStorage,
            vaultKey
        );

        return vaultState;
    }
}
