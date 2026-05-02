import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployDefiVaultFixture } from "./shared/DefiVault.fixture";

describe("DefiVault: Core Operations", function () {
  describe("Deployment", function () {
    it("Should set the correct underlying asset", async function () {
      const { defiVault, tokenAddress } = await loadFixture(deployDefiVaultFixture);
      expect(await defiVault.asset()).to.equal(tokenAddress);
    });

    it("Should initialize with zero totalAssets and totalSupply", async function () {
      const { defiVault } = await loadFixture(deployDefiVaultFixture);
      expect(await defiVault.totalAssets()).to.equal(0);
      expect(await defiVault.totalSupply()).to.equal(0);
    });

    it("Should have correct ERC20 metadata", async function () {
      const { defiVault } = await loadFixture(deployDefiVaultFixture);
      expect(await defiVault.name()).to.equal("DefiVault Share");
      expect(await defiVault.symbol()).to.equal("dvSKT");
    });
  });

  describe("Deposit (Assets In -> Shares Out)", function () {
    it("Should revert if depositing zero amount", async function () {
      const { defiVault, user1 } = await loadFixture(deployDefiVaultFixture);
      await expect(defiVault.connect(user1)["deposit(uint256)"](0)).to.be.revertedWithCustomError(
        defiVault,
        "ZeroAmount"
      );
    });

    it("Should deposit and mint 1:1 shares on first interaction", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const depositAmount = ethers.parseEther("100");

      await token.connect(user1).approve(vaultAddress, depositAmount);

      await expect(defiVault.connect(user1)["deposit(uint256)"](depositAmount))
        .to.emit(defiVault, "Deposited")
        .withArgs(user1.address, depositAmount, depositAmount); // 1:1 ratio

      const userShares = await defiVault.balanceOf(user1.address);
      const vaultAssets = await defiVault.totalAssets();

      expect(userShares).to.equal(depositAmount);
      expect(vaultAssets).to.equal(depositAmount);
      expect(await defiVault.totalSupply()).to.equal(depositAmount);
    });

    it("Should handle multiple deposits correctly", async function () {
      const { defiVault, token, vaultAddress, user1, user2 } = await loadFixture(deployDefiVaultFixture);
      const deposit1 = ethers.parseEther("100");
      const deposit2 = ethers.parseEther("50");

      await token.connect(user1).approve(vaultAddress, deposit1);
      await defiVault.connect(user1)["deposit(uint256)"](deposit1);

      await token.connect(user2).approve(vaultAddress, deposit2);
      await defiVault.connect(user2)["deposit(uint256)"](deposit2);

      const totalAssets = await defiVault.totalAssets();
      const totalSupply = await defiVault.totalSupply();

      expect(totalAssets).to.equal(deposit1 + deposit2);
      expect(totalSupply).to.equal(deposit1 + deposit2);
      expect(await defiVault.balanceOf(user1.address)).to.equal(deposit1);
      expect(await defiVault.balanceOf(user2.address)).to.equal(deposit2);
    });
  });

  describe("Redeem (Shares In -> Assets Out)", function () {
    it("Should revert if redeeming zero shares", async function () {
      const { defiVault, user1 } = await loadFixture(deployDefiVaultFixture);
      await expect(defiVault.connect(user1)["redeem(uint256)"](0)).to.be.revertedWithCustomError(
        defiVault,
        "ZeroShares"
      );
    });

    it("Should revert if redeeming more shares than owned", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const depositAmount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, depositAmount);
      await defiVault.connect(user1)["deposit(uint256)"](depositAmount);

      const excessShares = ethers.parseEther("200");
      await expect(defiVault.connect(user1)["redeem(uint256)"](excessShares))
        .to.be.revertedWithCustomError(defiVault, "InsufficientShares")
        .withArgs(excessShares, depositAmount);
    });

    it("Should burn shares and return underlying asset 1:1 initially", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const amount = ethers.parseEther("100");

      await token.connect(user1).approve(vaultAddress, amount);
      await defiVault.connect(user1)["deposit(uint256)"](amount);

      const balanceBefore = await token.balanceOf(user1.address);
      
      // We must avoid same block withdrawal error from security feature
      await ethers.provider.send("evm_mine", []);

      await expect(defiVault.connect(user1)["redeem(uint256)"](amount))
        .to.emit(defiVault, "Withdrawn")
        .withArgs(user1.address, amount, amount); 

      const balanceAfter = await token.balanceOf(user1.address);
      
      expect(balanceAfter - balanceBefore).to.equal(amount);
      expect(await defiVault.balanceOf(user1.address)).to.equal(0);
      expect(await defiVault.totalAssets()).to.equal(0);
      expect(await defiVault.totalSupply()).to.equal(0);
    });
    
    it("Should return proportional assets after yield is injected", async function () {
      const { defiVault, token, vaultAddress, user1, user2 } = await loadFixture(deployDefiVaultFixture);
      const amount = ethers.parseEther("100");

      await token.connect(user1).approve(vaultAddress, amount);
      await defiVault.connect(user1)["deposit(uint256)"](amount);

      // Inject yield directly into the contract
      const yieldAmount = ethers.parseEther("20");
      
      // Transfer to vaultAddress to simulate yield
      await token.connect(user2).transfer(vaultAddress, yieldAmount);
      
      const vaultAssetsAfterYield = await defiVault.totalAssets();
      expect(vaultAssetsAfterYield).to.equal(amount + yieldAmount);

      await ethers.provider.send("evm_mine", []);

      const user1Shares = await defiVault.balanceOf(user1.address);
      const balanceBefore = await token.balanceOf(user1.address);
      
      const expectedAssets = await defiVault.previewRedeem(user1Shares);

      await defiVault.connect(user1)["redeem(uint256)"](user1Shares);
      const balanceAfter = await token.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(expectedAssets);
      // It should be close to 120 SKT (minus a tiny amount absorbed by virtual shares)
      expect(expectedAssets).to.be.closeTo(amount + yieldAmount, ethers.parseEther("0.2"));
    });
  });
});
