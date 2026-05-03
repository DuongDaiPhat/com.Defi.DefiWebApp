// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../interfaces/IDefiVault.sol";

contract MockVault is ERC20, IDefiVault {
    using SafeERC20 for IERC20;
    using Math for uint256;

    IERC20 private immutable _asset;
    uint256 public redeemLossBps;
    uint256 public constant BASIS_POINTS = 10_000;

    constructor(IERC20 asset_) ERC20("Mock Vault Share", "mVS") {
        _asset = asset_;
    }

    function setRedeemLossBps(uint256 lossBps) external {
        require(lossBps <= BASIS_POINTS, "MockVault: invalid loss");
        redeemLossBps = lossBps;
    }

    function asset() external view returns (address) {
        return address(_asset);
    }

    function totalAssets() public view returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    function deposit(uint256 assets) external returns (uint256 shares) {
        return deposit(assets, 0);
    }

    function deposit(uint256 assets, uint256 minShares) public returns (uint256 shares) {
        require(assets > 0, "MockVault: zero assets");
        shares = previewDeposit(assets);
        require(shares >= minShares, "MockVault: slippage");
        require(shares > 0, "MockVault: zero shares");

        _mint(msg.sender, shares);
        _asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposited(msg.sender, assets, shares);
    }

    function mint(uint256 shares) external returns (uint256 assets) {
        return mint(shares, type(uint256).max);
    }

    function mint(uint256 shares, uint256 maxAssets) public returns (uint256 assets) {
        require(shares > 0, "MockVault: zero shares");
        assets = previewMint(shares);
        require(assets <= maxAssets, "MockVault: excessive input");

        _mint(msg.sender, shares);
        _asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposited(msg.sender, assets, shares);
    }

    function redeem(uint256 shares) external returns (uint256 assets) {
        return redeem(shares, 0);
    }

    function redeem(uint256 shares, uint256 minAssets) public returns (uint256 assets) {
        require(shares > 0, "MockVault: zero shares");
        require(shares <= balanceOf(msg.sender), "MockVault: insufficient shares");

        assets = previewRedeem(shares);
        require(assets >= minAssets, "MockVault: slippage");

        _burn(msg.sender, shares);
        if (assets > 0) {
            _asset.safeTransfer(msg.sender, assets);
        }

        emit Withdrawn(msg.sender, assets, shares);
    }

    function withdraw(uint256 assets) external returns (uint256 shares) {
        return withdraw(assets, type(uint256).max);
    }

    function withdraw(uint256 assets, uint256 maxShares) public returns (uint256 shares) {
        require(assets > 0, "MockVault: zero assets");
        shares = previewWithdraw(assets);
        require(shares <= maxShares, "MockVault: excessive input");
        require(shares <= balanceOf(msg.sender), "MockVault: insufficient shares");

        _burn(msg.sender, shares);
        _asset.safeTransfer(msg.sender, assets);

        emit Withdrawn(msg.sender, assets, shares);
    }

    function depositWithPermit(
        uint256,
        uint256,
        uint256,
        uint8,
        bytes32,
        bytes32
    ) external pure returns (uint256) {
        revert("MockVault: permit unsupported");
    }

    function previewDeposit(uint256 assets) public view returns (uint256 shares) {
        uint256 supply = totalSupply();
        uint256 assetsBefore = totalAssets();
        return supply == 0 || assetsBefore == 0
            ? assets
            : assets.mulDiv(supply, assetsBefore, Math.Rounding.Floor);
    }

    function previewMint(uint256 shares) public view returns (uint256 assets) {
        uint256 supply = totalSupply();
        uint256 assetsBefore = totalAssets();
        return supply == 0 || assetsBefore == 0
            ? shares
            : shares.mulDiv(assetsBefore, supply, Math.Rounding.Ceil);
    }

    function previewRedeem(uint256 shares) public view returns (uint256 assets) {
        uint256 supply = totalSupply();
        if (supply == 0) return 0;

        assets = shares.mulDiv(totalAssets(), supply, Math.Rounding.Floor);
        if (redeemLossBps > 0) {
            assets = assets.mulDiv(BASIS_POINTS - redeemLossBps, BASIS_POINTS, Math.Rounding.Floor);
        }
    }

    function previewWithdraw(uint256 assets) public view returns (uint256 shares) {
        uint256 supply = totalSupply();
        uint256 assetsBefore = totalAssets();
        return supply == 0 || assetsBefore == 0
            ? assets
            : assets.mulDiv(supply, assetsBefore, Math.Rounding.Ceil);
    }

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner_) external view returns (uint256) {
        return previewRedeem(balanceOf(owner_));
    }

    function maxRedeem(address owner_) external view returns (uint256) {
        return balanceOf(owner_);
    }

    function convertToShares(uint256 assets) external view returns (uint256) {
        return previewDeposit(assets);
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return previewRedeem(shares);
    }
}
