// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDefiVault
 * @dev Full ERC4626-compliant interface for the DefiVault contract.
 *
 * ERC4626 defines 4 entry-point functions with precise rounding semantics:
 *
 *  deposit(assets)  → user specifies assets in, vault computes shares out  [Round DOWN]
 *  mint(shares)     → user specifies shares out, vault computes assets in   [Round UP]
 *  redeem(shares)   → user specifies shares in, vault computes assets out   [Round DOWN]
 *  withdraw(assets) → user specifies assets out, vault computes shares in   [Round UP]
 *
 * All rounding always favors the VAULT (never the user).
 */
interface IDefiVault {

    // =============================================================
    //  EVENTS
    // =============================================================

    /// @dev Emitted on deposit() and mint()
    event Deposited(address indexed user, uint256 assets, uint256 shares);

    /// @dev Emitted on redeem() and withdraw()
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);

    event EmergencyWithdrawn(address indexed owner, uint256 amount);
    event MaxDepositUpdated(uint256 oldMax, uint256 newMax);
    event MaxWithdrawUpdated(uint256 oldMax, uint256 newMax);

    // =============================================================
    //  DEPOSIT FAMILY — user specifies ASSETS IN
    // =============================================================

    /**
     * @notice Deposit `assets` of underlying tokens and receive vault shares.
     * @param  assets Amount of underlying asset to deposit.
     * @return shares Amount of share tokens minted to caller.
     */
    function deposit(uint256 assets) external returns (uint256 shares);

    /**
     * @notice Deposit with slippage protection.
     * @param  assets    Amount of underlying asset to deposit.
     * @param  minShares Minimum shares to receive (reverts if actual < minShares).
     * @return shares    Amount of share tokens minted to caller.
     */
    function deposit(uint256 assets, uint256 minShares) external returns (uint256 shares);

    // =============================================================
    //  MINT FAMILY — user specifies SHARES OUT
    // =============================================================

    /**
     * @notice Mint exactly `shares` vault shares by depositing the required assets.
     * @param  shares Amount of share tokens the caller wants to receive.
     * @return assets Amount of underlying asset pulled from caller.
     */
    function mint(uint256 shares) external returns (uint256 assets);

    /**
     * @notice Mint with slippage protection.
     * @param  shares    Amount of share tokens the caller wants to receive.
     * @param  maxAssets Maximum assets caller is willing to pay (reverts if actual > maxAssets).
     * @return assets    Amount of underlying asset pulled from caller.
     */
    function mint(uint256 shares, uint256 maxAssets) external returns (uint256 assets);

    // =============================================================
    //  REDEEM FAMILY — user specifies SHARES IN
    // =============================================================

    /**
     * @notice Burn exactly `shares` and receive the proportional underlying assets.
     * @param  shares Amount of share tokens to burn.
     * @return assets Amount of underlying asset returned to caller.
     */
    function redeem(uint256 shares) external returns (uint256 assets);

    /**
     * @notice Redeem with slippage protection.
     * @param  shares    Amount of share tokens to burn.
     * @param  minAssets Minimum assets to receive (reverts if actual < minAssets).
     * @return assets    Amount of underlying asset returned to caller.
     */
    function redeem(uint256 shares, uint256 minAssets) external returns (uint256 assets);

    // =============================================================
    //  WITHDRAW FAMILY — user specifies ASSETS OUT
    // =============================================================

    /**
     * @notice Withdraw exactly `assets` of underlying tokens by burning the required shares.
     * @param  assets Amount of underlying asset to receive.
     * @return shares Amount of share tokens burned from caller.
     */
    function withdraw(uint256 assets) external returns (uint256 shares);

    /**
     * @notice Withdraw with slippage protection.
     * @param  assets     Amount of underlying asset to receive.
     * @param  maxShares  Maximum shares caller is willing to burn (reverts if actual > maxShares).
     * @return shares     Amount of share tokens burned from caller.
     */
    function withdraw(uint256 assets, uint256 maxShares) external returns (uint256 shares);

    // =============================================================
    //  PERMIT DEPOSIT
    // =============================================================

    /**
     * @notice Deposit using EIP-2612 permit (gasless approval in a single tx).
     */
    function depositWithPermit(
        uint256 assets,
        uint256 minShares,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external returns (uint256 shares);

    // =============================================================
    //  ERC4626 PREVIEW FUNCTIONS
    // =============================================================

    /// @notice Preview shares out for depositing `assets` (rounds DOWN).
    function previewDeposit(uint256 assets) external view returns (uint256 shares);

    /// @notice Preview assets in required to mint `shares` (rounds UP).
    function previewMint(uint256 shares) external view returns (uint256 assets);

    /// @notice Preview assets out for redeeming `shares` (rounds DOWN).
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    /// @notice Preview shares burned to withdraw exactly `assets` (rounds UP).
    function previewWithdraw(uint256 assets) external view returns (uint256 shares);

    // =============================================================
    //  ERC4626 MAX FUNCTIONS
    // =============================================================

    function maxDeposit(address receiver) external view returns (uint256);
    function maxMint(address receiver) external view returns (uint256);
    function maxWithdraw(address owner_) external view returns (uint256);
    function maxRedeem(address owner_) external view returns (uint256);

    // =============================================================
    //  ERC4626 CONVERSION FUNCTIONS
    // =============================================================

    /// @notice Convert assets to shares (rounds DOWN — informational only).
    function convertToShares(uint256 assets) external view returns (uint256);

    /// @notice Convert shares to assets (rounds DOWN — informational only).
    function convertToAssets(uint256 shares) external view returns (uint256);

    // =============================================================
    //  CORE VIEW
    // =============================================================

    function totalAssets() external view returns (uint256);
    function asset() external view returns (address);
}
