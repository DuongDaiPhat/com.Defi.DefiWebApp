import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployDefiVaultFixture } from "./shared/DefiVault.fixture";

describe("DefiVault: ERC4626 Full Compliance", function () {
  
  describe("Mint (Shares Out -> Assets In)", function () {
    it("Should revert if minting zero shares", async function () {
      const { defiVault, user1 } = await loadFixture(deployDefiVaultFixture);
      await expect(defiVault.connect(user1)["mint(uint256)"](0)).to.be.revertedWithCustomError(
        defiVault,
        "ZeroShares"
      );
    });

    it("Should mint exact shares and pull correct assets 1:1 on empty vault", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const mintShares = ethers.parseEther("100");

      await token.connect(user1).approve(vaultAddress, mintShares);

      await expect(defiVault.connect(user1)["mint(uint256)"](mintShares))
        .to.emit(defiVault, "Deposited")
        .withArgs(user1.address, mintShares, mintShares);

      expect(await defiVault.balanceOf(user1.address)).to.equal(mintShares);
      expect(await defiVault.totalAssets()).to.equal(mintShares);
    });

    it("Should revert if maxAssets slippage exceeded", async function () {
      const { defiVault, token, vaultAddress, user1, user2 } = await loadFixture(deployDefiVaultFixture);
      
      // Setup initial vault state
      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));
      
      // Add yield to change ratio
      await token.connect(user1).transfer(vaultAddress, ethers.parseEther("50")); // Vault now has 150 assets, 100 shares. 1 share = 1.5 assets

      const mintShares = ethers.parseEther("10"); // Needs ~15 assets
      const maxAssets = ethers.parseEther("12"); // Slippage set too low

      await token.connect(user2).approve(vaultAddress, ethers.parseEther("50"));
      
      await expect(defiVault.connect(user2)["mint(uint256,uint256)"](mintShares, maxAssets))
        .to.be.revertedWithCustomError(defiVault, "ExcessiveInput");
    });
  });

  describe("Withdraw (Assets Out -> Shares In)", function () {
    it("Should revert if withdrawing zero assets", async function () {
      const { defiVault, user1 } = await loadFixture(deployDefiVaultFixture);
      await expect(defiVault.connect(user1)["withdraw(uint256)"](0)).to.be.revertedWithCustomError(
        defiVault,
        "ZeroAmount"
      );
    });

    it("Should withdraw exact assets and burn correct shares", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const depositAmount = ethers.parseEther("100");

      await token.connect(user1).approve(vaultAddress, depositAmount);
      await defiVault.connect(user1)["deposit(uint256)"](depositAmount);

      await ethers.provider.send("evm_mine", []);

      const withdrawAssets = ethers.parseEther("50");
      await expect(defiVault.connect(user1)["withdraw(uint256)"](withdrawAssets))
        .to.emit(defiVault, "Withdrawn")
        .withArgs(user1.address, withdrawAssets, withdrawAssets);

      expect(await defiVault.balanceOf(user1.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should revert if maxShares slippage exceeded", async function () {
      const { defiVault, token, vaultAddress, user1, user2 } = await loadFixture(deployDefiVaultFixture);
      
      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));
      
      // Simulate loss to change ratio. 100 shares, but only 50 assets. 1 asset = 2 shares.
      // Easiest way to simulate loss is vault transfers asset to burn address.
      const helpers = require("@nomicfoundation/hardhat-network-helpers");
      await helpers.impersonateAccount(vaultAddress);
      const vaultSigner = await ethers.getSigner(vaultAddress);
      await helpers.setBalance(vaultAddress, 10n ** 18n); // give ETH for gas
      await token.connect(vaultSigner).transfer("0x000000000000000000000000000000000000dEaD", ethers.parseEther("50"));
      
      // User tries to withdraw 10 assets. Should cost ~20 shares.
      const withdrawAssets = ethers.parseEther("10");
      const maxShares = ethers.parseEther("15"); // Slippage too low

      await ethers.provider.send("evm_mine", []);

      await expect(defiVault.connect(user1)["withdraw(uint256,uint256)"](withdrawAssets, maxShares))
        .to.be.revertedWithCustomError(defiVault, "ExcessiveInput");
    });
  });

  describe("ERC4626 Rounding Rules & Previews", function () {
    it("Should adhere to rounding rules (Floor for Deposit/Redeem, Ceil for Mint/Withdraw)", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      
      await token.connect(user1).approve(vaultAddress, ethers.parseEther("10"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("10"));
      
      // Add a tiny odd amount to make ratio uneven
      await token.connect(user1).transfer(vaultAddress, 3n);
      
      // Floor rounding for deposit (user gets less shares)
      const depositShares = await defiVault.previewDeposit(100n);
      // Ceil rounding for mint (user pays more assets)
      const mintAssets = await defiVault.previewMint(depositShares);
      
      expect(mintAssets).to.be.gte(100n);
      
      // Floor rounding for redeem (user gets less assets)
      const redeemAssets = await defiVault.previewRedeem(100n);
      // Ceil rounding for withdraw (user burns more shares)
      const withdrawShares = await defiVault.previewWithdraw(redeemAssets);
      
      expect(withdrawShares).to.be.gte(100n);
    });
  });
});
