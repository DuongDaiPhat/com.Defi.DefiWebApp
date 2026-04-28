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

contract DefiVault is ERC20, ReentrancyGuard, Pausable, Ownable, IDefiVault {
    using SafeERC20 for IERC20;
    using Math for uint256;

    IERC20 private immutable _asset;

    uint256 public maxDepositAmount = type(uint256).max;
    uint256 public maxWithdrawAmount = type(uint256).max;

    mapping(address => uint256) private _lastDepositBlock;

    error ZeroAmount();
    error ZeroShares();
    error InsufficientShares(uint256 requested, uint256 available);
    error SameBlockWithdrawal();
    error SlippageExceeded(uint256 actual, uint256 minimum);

    constructor(IERC20 asset_) ERC20("DefiVault Share", "dvSKT") Ownable(msg.sender) {
        require(address(asset_) != address(0), "DefiVault: zero asset address");
        _asset = asset_;
    }

    function asset() public view override returns (address) {
        return address(_asset);
    }

    function totalAssets() public view override returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    function _convertToShares(uint256 assets, Math.Rounding rounding) internal view returns (uint256) {
        return assets.mulDiv(totalSupply() + 10**18, totalAssets() + 10**18, rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) internal view returns (uint256) {
        return shares.mulDiv(totalAssets() + 10**18, totalSupply() + 10**18, rounding);
    }

    function previewDeposit(uint256 assets) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    function previewWithdraw(uint256 shares) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }

    // ═══════════════════ CORE FUNCTIONS ═══════════════════

    function deposit(uint256 assets) public override nonReentrant whenNotPaused returns (uint256) {
        return _deposit(assets, 0);
    }

    function deposit(uint256 assets, uint256 minShares) public override nonReentrant whenNotPaused returns (uint256) {
        return _deposit(assets, minShares);
    }

    function _deposit(uint256 assets, uint256 minShares) internal returns (uint256) {
        if (assets == 0) revert ZeroAmount();
        require(assets <= maxDepositAmount, "DefiVault: exceeds max deposit");

        uint256 shares = previewDeposit(assets);
        require(shares > 0, "DefiVault: zero shares minted");
        if (shares < minShares) revert SlippageExceeded(shares, minShares);

        _lastDepositBlock[msg.sender] = block.number;

        _mint(msg.sender, shares);
        _asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposited(msg.sender, assets, shares);
        return shares;
    }

    function withdraw(uint256 shares) public override nonReentrant whenNotPaused returns (uint256) {
        return _withdraw(shares, 0);
    }

    function withdraw(uint256 shares, uint256 minAssets) public override nonReentrant whenNotPaused returns (uint256) {
        return _withdraw(shares, minAssets);
    }

    function _withdraw(uint256 shares, uint256 minAssets) internal returns (uint256) {
        if (shares == 0) revert ZeroShares();
        if (block.number <= _lastDepositBlock[msg.sender]) revert SameBlockWithdrawal();

        uint256 userShares = balanceOf(msg.sender);
        if (shares > userShares) revert InsufficientShares(shares, userShares);

        uint256 assets = previewWithdraw(shares);
        require(assets > 0, "DefiVault: zero assets returned");
        require(assets <= maxWithdrawAmount, "DefiVault: exceeds max withdraw");
        if (assets < minAssets) revert SlippageExceeded(assets, minAssets);

        _burn(msg.sender, shares);
        _asset.safeTransfer(msg.sender, assets);

        emit Withdrawn(msg.sender, assets, shares);
        return assets;
    }

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

    // ═══════════════════ ADMIN FUNCTIONS ═══════════════════

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

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

    // ═══════════════════ ERC4626 VIEW FUNCTIONS ═══════════════════

    function maxDeposit(address) public view override returns (uint256) {
        return paused() ? 0 : maxDepositAmount;
    }

    function maxMint(address) public view override returns (uint256) {
        return paused() ? 0 : _convertToShares(maxDepositAmount, Math.Rounding.Floor);
    }

    function maxWithdraw(address owner_) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 ownerAssets = _convertToAssets(balanceOf(owner_), Math.Rounding.Floor);
        return ownerAssets < maxWithdrawAmount ? ownerAssets : maxWithdrawAmount;
    }

    function maxRedeem(address owner_) public view override returns (uint256) {
        return paused() ? 0 : balanceOf(owner_);
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        return _convertToAssets(shares, Math.Rounding.Floor);
    }
}
