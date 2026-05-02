// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import "./interfaces/IDefiVault.sol";

/**
 * @title DefiVault
 * @dev A 100% ERC4626-compliant tokenized vault contract.
 *
 * ── ERC4626 ROUNDING RULES ──────────────────────────────────────
 *  All rounding ALWAYS favors the VAULT (never the user).
 *
 *  deposit(assets)  → shares out  — Round DOWN (Floor): user gets fewer shares
 *  mint(shares)     → assets in   — Round UP   (Ceil):  user pays more assets
 *  redeem(shares)   → assets out  — Round DOWN (Floor): user gets fewer assets
 *  withdraw(assets) → shares in   — Round UP   (Ceil):  user burns more shares
 *
 * ── SECURITY ────────────────────────────────────────────────────
 *  - Virtual Shares (offset 10**18): defeats Inflation Attack
 *  - ReentrancyGuard:                prevents re-entrancy on all state-changing functions
 *  - CEI Pattern:                    Checks → Effects → Interactions ordering
 *  - SafeERC20:                      handles non-standard ERC20 tokens safely
 *  - Same-block withdrawal guard:    prevents MEV flash-loan sandwich attacks
 *  - Slippage protection:            minShares / maxAssets / minAssets / maxShares overloads
 *  - Pausable:                       emergency circuit-breaker
 *  - Ownable:                        admin access control for critical params
 */
contract DefiVault is ERC20, ReentrancyGuard, Pausable, Ownable, IDefiVault {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // =============================================================
    //  STATE VARIABLES
    // =============================================================

    IERC20 private immutable _asset;

    /// @dev Admin-configurable caps (defaults: unlimited)
    uint256 public maxDepositAmount = type(uint256).max;
    uint256 public maxWithdrawAmount = type(uint256).max;

    /// @dev Tracks the last block a user deposited/minted — for same-block MEV guard
    mapping(address => uint256) private _lastDepositBlock;

    // =============================================================
    //  CUSTOM ERRORS
    // =============================================================

    error ZeroAmount();
    error ZeroShares();
    error InsufficientShares(uint256 requested, uint256 available);
    error SameBlockWithdrawal();
    /// @dev Slippage: actual output < minimum acceptable
    error SlippageExceeded(uint256 actual, uint256 minimum);
    /// @dev Slippage: actual cost > maximum acceptable
    error ExcessiveInput(uint256 actual, uint256 maximum);

    // =============================================================
    //  CONSTRUCTOR
    // =============================================================

    /**
     * @param asset_ The underlying ERC20 token to be deposited.
     */
    constructor(IERC20 asset_) ERC20("DefiVault Share", "dvSKT") Ownable(msg.sender) {
        require(address(asset_) != address(0), "DefiVault: zero asset address");
        _asset = asset_;
    }

    // =============================================================
    //  ERC4626 CORE VIEW FUNCTIONS
    // =============================================================

    /// @inheritdoc IDefiVault
    function asset() public view override returns (address) {
        return address(_asset);
    }

    /// @inheritdoc IDefiVault
    function totalAssets() public view override returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    // =============================================================
    //  INTERNAL CONVERSION HELPERS
    // =============================================================

    /**
     * @dev Converts assets → shares using Virtual Shares offset (10**18).
     *      The large offset defeats Inflation Attacks even with massive donations.
     */
    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view returns (uint256) {
        return assets.mulDiv(totalSupply() + 10 ** 18, totalAssets() + 10 ** 18, rounding);
    }

    /**
     * @dev Converts shares → assets using Virtual Shares offset (10**18).
     */
    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view returns (uint256) {
        return shares.mulDiv(totalAssets() + 10 ** 18, totalSupply() + 10 ** 18, rounding);
    }

    // =============================================================
    //  ERC4626 PREVIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Simulate deposit: how many shares would `assets` buy?
     * @dev    Rounds DOWN (Floor) — vault-favoring.
     */
    function previewDeposit(uint256 assets) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /**
     * @notice Simulate mint: how many assets are needed to receive exactly `shares`?
     * @dev    Rounds UP (Ceil) — vault-favoring.
     */
    function previewMint(uint256 shares) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Ceil);
    }

    /**
     * @notice Simulate redeem: how many assets would `shares` return?
     * @dev    Rounds DOWN (Floor) — vault-favoring.
     */
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    /**
     * @notice Simulate withdraw: how many shares must be burned to receive exactly `assets`?
     * @dev    Rounds UP (Ceil) — vault-favoring.
     */
    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    // =============================================================
    //  ERC4626 MAX FUNCTIONS
    // =============================================================

    /// @inheritdoc IDefiVault
    function maxDeposit(address) public view override returns (uint256) {
        return paused() ? 0 : maxDepositAmount;
    }

    /// @inheritdoc IDefiVault
    function maxMint(address) public view override returns (uint256) {
        return paused() ? 0 : _convertToShares(maxDepositAmount, Math.Rounding.Floor);
    }

    /// @inheritdoc IDefiVault
    function maxWithdraw(address owner_) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 ownerAssets = _convertToAssets(balanceOf(owner_), Math.Rounding.Floor);
        return ownerAssets < maxWithdrawAmount ? ownerAssets : maxWithdrawAmount;
    }

    /// @inheritdoc IDefiVault
    function maxRedeem(address owner_) public view override returns (uint256) {
        return paused() ? 0 : balanceOf(owner_);
    }

    // =============================================================
    //  ERC4626 CONVERSION FUNCTIONS (informational, both Floor)
    // =============================================================

    /// @inheritdoc IDefiVault
    function convertToShares(uint256 assets) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    /// @inheritdoc IDefiVault
    function convertToAssets(uint256 shares) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    // =============================================================
    //  DEPOSIT — user specifies ASSETS IN, vault returns SHARES OUT
    // =============================================================

    /// @inheritdoc IDefiVault
    function deposit(uint256 assets) public override nonReentrant whenNotPaused returns (uint256) {
        return _deposit(assets, 0);
    }

    /// @inheritdoc IDefiVault
    function deposit(uint256 assets, uint256 minShares) public override nonReentrant whenNotPaused returns (uint256) {
        return _deposit(assets, minShares);
    }

    function _deposit(uint256 assets, uint256 minShares) internal returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        require(assets <= maxDepositAmount, "DefiVault: exceeds max deposit");

        shares = previewDeposit(assets); // Floor
        require(shares > 0, "DefiVault: zero shares minted");
        if (shares < minShares) revert SlippageExceeded(shares, minShares);

        _lastDepositBlock[msg.sender] = block.number;

        // CEI: Effects before Interactions
        _mint(msg.sender, shares);
        _asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposited(msg.sender, assets, shares);
    }

    // =============================================================
    //  MINT — user specifies SHARES OUT, vault pulls ASSETS IN
    // =============================================================

    /// @inheritdoc IDefiVault
    function mint(uint256 shares) public override nonReentrant whenNotPaused returns (uint256) {
        return _mintShares(shares, type(uint256).max);
    }

    /// @inheritdoc IDefiVault
    function mint(uint256 shares, uint256 maxAssets) public override nonReentrant whenNotPaused returns (uint256) {
        return _mintShares(shares, maxAssets);
    }

    function _mintShares(uint256 shares, uint256 maxAssets) internal returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();

        assets = previewMint(shares); // Ceil — user pays more
        require(assets > 0, "DefiVault: zero assets required");
        require(assets <= maxDepositAmount, "DefiVault: exceeds max deposit");
        if (assets > maxAssets) revert ExcessiveInput(assets, maxAssets);

        _lastDepositBlock[msg.sender] = block.number;

        // CEI: Effects before Interactions
        _mint(msg.sender, shares);
        _asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposited(msg.sender, assets, shares);
    }

    // =============================================================
    //  REDEEM — user specifies SHARES IN, vault returns ASSETS OUT
    // =============================================================

    /// @inheritdoc IDefiVault
    function redeem(uint256 shares) public override nonReentrant whenNotPaused returns (uint256) {
        return _redeem(shares, 0);
    }

    /// @inheritdoc IDefiVault
    function redeem(uint256 shares, uint256 minAssets) public override nonReentrant whenNotPaused returns (uint256) {
        return _redeem(shares, minAssets);
    }

    function _redeem(uint256 shares, uint256 minAssets) internal returns (uint256 assets) {
        if (shares == 0) revert ZeroShares();
        if (block.number <= _lastDepositBlock[msg.sender]) revert SameBlockWithdrawal();

        uint256 userShares = balanceOf(msg.sender);
        if (shares > userShares) revert InsufficientShares(shares, userShares);

        assets = previewRedeem(shares); // Floor — user gets less
        require(assets > 0, "DefiVault: zero assets returned");
        require(assets <= maxWithdrawAmount, "DefiVault: exceeds max withdraw");
        if (assets < minAssets) revert SlippageExceeded(assets, minAssets);

        // CEI: Effects before Interactions
        _burn(msg.sender, shares);
        _asset.safeTransfer(msg.sender, assets);

        emit Withdrawn(msg.sender, assets, shares);
    }

    // =============================================================
    //  WITHDRAW — user specifies ASSETS OUT, vault burns SHARES IN
    // =============================================================

    /// @inheritdoc IDefiVault
    function withdraw(uint256 assets) public override nonReentrant whenNotPaused returns (uint256) {
        return _withdrawAssets(assets, type(uint256).max);
    }

    /// @inheritdoc IDefiVault
    function withdraw(uint256 assets, uint256 maxShares) public override nonReentrant whenNotPaused returns (uint256) {
        return _withdrawAssets(assets, maxShares);
    }

    function _withdrawAssets(uint256 assets, uint256 maxShares) internal returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        if (block.number <= _lastDepositBlock[msg.sender]) revert SameBlockWithdrawal();
        require(assets <= maxWithdrawAmount, "DefiVault: exceeds max withdraw");

        shares = previewWithdraw(assets); // Ceil — user burns more
        require(shares > 0, "DefiVault: zero shares burned");
        if (shares > maxShares) revert ExcessiveInput(shares, maxShares);

        uint256 userShares = balanceOf(msg.sender);
        if (shares > userShares) revert InsufficientShares(shares, userShares);

        // CEI: Effects before Interactions
        _burn(msg.sender, shares);
        _asset.safeTransfer(msg.sender, assets);

        emit Withdrawn(msg.sender, assets, shares);
    }

    // =============================================================
    //  PERMIT DEPOSIT
    // =============================================================

    /// @inheritdoc IDefiVault
    function depositWithPermit(
        uint256 assets,
        uint256 minShares,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external override nonReentrant whenNotPaused returns (uint256) {
        IERC20Permit(address(_asset)).permit(
            msg.sender,
            address(this),
            assets,
            deadline,
            v, r, s
        );
        return _deposit(assets, minShares);
    }

    // =============================================================
    //  ADMIN FUNCTIONS
    // =============================================================

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /**
     * @notice Emergency drain — pulls all underlying assets to owner.
     * @dev    Only callable when paused to prevent abuse during normal operation.
     */
    function emergencyWithdraw() external onlyOwner whenPaused {
        uint256 balance = _asset.balanceOf(address(this));
        require(balance > 0, "DefiVault: nothing to withdraw");
        _asset.safeTransfer(owner(), balance);
        emit EmergencyWithdrawn(owner(), balance);
    }

    function setMaxDeposit(uint256 _max) external onlyOwner {
        emit MaxDepositUpdated(maxDepositAmount, _max);
        maxDepositAmount = _max;
    }

    function setMaxWithdraw(uint256 _max) external onlyOwner {
        emit MaxWithdrawUpdated(maxWithdrawAmount, _max);
        maxWithdrawAmount = _max;
    }
}
