// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDefiVault
 * @dev Interface for the DefiVault contract.
 */
interface IDefiVault {
    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);
    event EmergencyWithdrawn(address indexed owner, uint256 amount);
    event MaxDepositUpdated(uint256 oldMax, uint256 newMax);
    event MaxWithdrawUpdated(uint256 oldMax, uint256 newMax);

    function deposit(uint256 assets) external returns (uint256 shares);
    function withdraw(uint256 shares) external returns (uint256 assets);

    function deposit(uint256 assets, uint256 minShares) external returns (uint256 shares);
    function withdraw(uint256 shares, uint256 minAssets) external returns (uint256 assets);

    function depositWithPermit(
        uint256 assets,
        uint256 minShares,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external returns (uint256 shares);

    function totalAssets() external view returns (uint256);
    function asset() external view returns (address);
    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    function previewWithdraw(uint256 shares) external view returns (uint256 assets);

    function maxDeposit(address receiver) external view returns (uint256);
    function maxMint(address receiver) external view returns (uint256);
    function maxWithdraw(address owner_) external view returns (uint256);
    function maxRedeem(address owner_) external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
}
