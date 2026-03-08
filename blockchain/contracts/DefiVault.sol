// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IDefiVault.sol";

/**
 * @title DefiVault
 * @dev A decentralized ERC4626-inspired vault/withdraw contract.
 *      Users deposit an underlying asset to receive vault shares.
 *      Users burn shares to withdraw the underlying asset.
 */
contract DefiVault is ERC20, ReentrancyGuard, IDefiVault {
    using SafeERC20 for IERC20;

    IERC20 private immutable _asset;

    // Custom errors for gas optimization
    error ZeroAmount();
    error ZeroShares();
    error InsufficientShares(uint256 requested, uint256 available);

    /**
     * @param asset_ The underlying ERC20 token to be deposited.
     */
    constructor(IERC20 asset_) ERC20("DefiVault Share", "dvSKT") {
        require(address(asset_) != address(0), "DefiVault: zero asset address");
        _asset = asset_;
    }

    /**
     * @notice See {IDefiVault-asset}.
     */
    function asset() public view override returns (address) {
        return address(_asset);
    }

    /**
     * @notice See {IDefiVault-totalAssets}.
     * @dev Returns the total amount of the underlying asset managed by this contract.
     */
    function totalAssets() public view override returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    /**
     * @notice See {IDefiVault-deposit}.
     * @dev Mints shares to the user proportional to the deposited assets.
     */
    function deposit(uint256 assets) public override nonReentrant returns (uint256) {
        if (assets == 0) revert ZeroAmount();

        uint256 shares = previewDeposit(assets);
        require(shares > 0, "DefiVault: zero shares minted");

        // EFFECTS: mint shares internally before interacting with external token
        _mint(msg.sender, shares);

        // INTERACTIONS: pull underlying assets from user
        _asset.safeTransferFrom(msg.sender, address(this), assets);

        emit Deposited(msg.sender, assets, shares);
        return shares;
    }

    /**
     * @notice See {IDefiVault-withdraw}.
     * @dev Burns user's shares and returns the proportional underlying asset.
     */
    function withdraw(uint256 shares) public override nonReentrant returns (uint256) {
        if (shares == 0) revert ZeroShares();

        uint256 userShares = balanceOf(msg.sender);
        if (shares > userShares) revert InsufficientShares(shares, userShares);

        uint256 assets = previewWithdraw(shares);
        require(assets > 0, "DefiVault: zero assets returned");

        // EFFECTS: burn shares internally before interacting with external token
        _burn(msg.sender, shares);

        // INTERACTIONS: push underlying assets back to user
        _asset.safeTransfer(msg.sender, assets);

        emit Withdrawn(msg.sender, assets, shares);
        return assets;
    }

    /**
     * @notice See {IDefiVault-previewDeposit}.
     * @dev Simulates the amount of shares that would be minted for a given amount of assets.
     */
    function previewDeposit(uint256 assets) public view override returns (uint256) {
        uint256 sharesTotal = totalSupply();
        if (sharesTotal == 0) {
            // Initial 1:1 ratio
            return assets;
        }

        // Proportional math: shares = (assets * totalShares) / totalAssets
        return (assets * sharesTotal) / totalAssets();
    }

    /**
     * @notice See {IDefiVault-previewWithdraw}.
     * @dev Simulates the amount of assets that would be returned for a given amount of shares.
     */
    function previewWithdraw(uint256 shares) public view override returns (uint256) {
        uint256 sharesTotal = totalSupply();
        if (sharesTotal == 0) return 0;

        // Proportional math: assets = (shares * totalAssets) / totalShares
        return (shares * totalAssets()) / sharesTotal;
    }
}
