// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDefiVault
 * @dev Interface for the DefiVault contract.
 *      Exposes core deposit (mint) and withdraw (burn) logic.
 */
interface IDefiVault {
    // =============================================================
    // EVENTS
    // =============================================================
    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);

    // =============================================================
    // CORE FUNCTIONS
    // =============================================================

    /**
     * @notice Deposit underlying tokens and mint shares.
     * @param assets Amount of underlying asset to deposit.
     * @return shares Amount of share tokens minted to user.
     */
    function deposit(uint256 assets) external returns (uint256 shares);

    /**
     * @notice Burn share tokens and withdraw proportional underlying assets.
     * @param shares Amount of share tokens to burn.
     * @return assets Amount of underlying asset returned to user.
     */
    function withdraw(uint256 shares) external returns (uint256 assets);

    // =============================================================
    // VIEW FUNCTIONS
    // =============================================================

    function totalAssets() external view returns (uint256);
    function asset() external view returns (address);
    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    function previewWithdraw(uint256 shares) external view returns (uint256 assets);
}
