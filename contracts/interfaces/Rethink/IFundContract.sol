// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IFundContract {
     struct Settings {
		uint256 depositFee;
		uint256 withdrawFee;
		uint256 performanceFee;
		uint256 managementFee;
		uint256 performaceHurdleRateBps;
		address baseToken;
		address safe; //TODO: needs to be set after safe creation
		bool isExternalGovTokenInUse;
		bool isWhitelistedDeposits;
		address[] allowedDepositAddrs;
		address[] allowedManagers;
		address governanceToken;
		address fundAddress;//TODO: this may not be needed if delegatecall has balance refs to callee addr
		address governor;
		string fundName;
		string fundSymbol;
		address[4] feeCollectors;
	}
     
     function fundFlowsCall(bytes calldata flowCall) external;
     function executeNAVUpdate(address navExecutor) external;
	 function delegate(address delegatee) external;
	 function delegates(address owner) external view returns (address);
     function getFundSettings() external view returns (Settings memory);
	 function totalNAV() external view returns (uint256);
	 function totalSupply() external view returns (uint256);
}