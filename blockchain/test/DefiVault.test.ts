import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("DefiVault", function () {
  async function deployWithdrawFixture() {
    const [owner, user1, user2] = await ethers.getSigners();

    // Deploy underlying token
    const Token = await ethers.getContractFactory("Token");
    const token = await Token.deploy(owner.address);

    // Give some tokens to users
    const mintAmount = ethers.parseEther("1000");
    await token.mint(user1.address, mintAmount);
    await token.mint(user2.address, mintAmount);

    // Deploy DefiVault contract
    const tokenAddress = await token.getAddress();
    const DefiVaultFactory = await ethers.getContractFactory("DefiVault");
    const defiVault = await DefiVaultFactory.deploy(tokenAddress);
    const withdrawAddress = await defiVault.getAddress();

    return { defiVault, token, withdrawAddress, tokenAddress, owner, user1, user2 };
  }

  describe("Deployment", function () {
    it("Should set the correct underlying asset", async function () {
      const { defiVault, tokenAddress } = await loadFixture(deployWithdrawFixture);
      expect(await defiVault.asset()).to.equal(tokenAddress);
    });

    it("Should initialize with zero totalAssets and totalSupply", async function () {
      const { defiVault } = await loadFixture(deployWithdrawFixture);
      expect(await defiVault.totalAssets()).to.equal(0);
      expect(await defiVault.totalSupply()).to.equal(0);
    });

    it("Should have correct ERC20 metadata", async function () {
      const { defiVault } = await loadFixture(deployWithdrawFixture);
      expect(await defiVault.name()).to.equal("DefiVault Share");
      expect(await defiVault.symbol()).to.equal("dvSKT");
    });
  });

  describe("Deposit", function () {
    it("Should revert if depositing zero amount", async function () {
      const { defiVault, user1 } = await loadFixture(deployWithdrawFixture);
      // Try to deposit 0
      await expect(defiVault.connect(user1).deposit(0)).to.be.revertedWithCustomError(
        defiVault,
        "ZeroAmount"
      );
    });

    it("Should deposit and mint 1:1 shares on first interaction", async function () {
      const { defiVault, token, withdrawAddress, user1 } = await loadFixture(deployWithdrawFixture);
      const depositAmount = ethers.parseEther("100");

      console.log(`\n  --- DEMO: Basic Deposit ---`);
      console.log(`  User1 wants to deposit: 100 SKT`);

      await token.connect(user1).approve(withdrawAddress, depositAmount);

      await expect(defiVault.connect(user1).deposit(depositAmount))
        .to.emit(defiVault, "Deposited")
        .withArgs(user1.address, depositAmount, depositAmount); // 1:1 ratio

      const userShares = await defiVault.balanceOf(user1.address);
      const vaultAssets = await defiVault.totalAssets();
      
      console.log(`  [After] User1 Share Balance (dwSKT): ${ethers.formatEther(userShares)}`);
      console.log(`  [After] Vault Total Assets (SKT)   : ${ethers.formatEther(vaultAssets)}`);

      expect(userShares).to.equal(depositAmount);
      expect(vaultAssets).to.equal(depositAmount);
      expect(await defiVault.totalSupply()).to.equal(depositAmount);
    });

    it("Should accurately preview deposit amounts", async function () {
      const { defiVault } = await loadFixture(deployWithdrawFixture);
      const testAmount = ethers.parseEther("50");
      
      // When empty, 1:1 ratio
      expect(await defiVault.previewDeposit(testAmount)).to.equal(testAmount);
    });

    it("Should handle multiple deposits correctly", async function () {
      const { defiVault, token, withdrawAddress, user1, user2 } = await loadFixture(deployWithdrawFixture);
      const deposit1 = ethers.parseEther("100");
      const deposit2 = ethers.parseEther("50");

      console.log(`\n  --- DEMO: Multiple Deposits ---`);
      
      // User 1 deposits
      await token.connect(user1).approve(withdrawAddress, deposit1);
      await defiVault.connect(user1).deposit(deposit1);
      console.log(`  User1 deposits: 100 SKT -> Receives 100 dwSKT`);

      // User 2 deposits
      await token.connect(user2).approve(withdrawAddress, deposit2);
      await defiVault.connect(user2).deposit(deposit2);
      console.log(`  User2 deposits: 50 SKT -> Receives 50 dwSKT`);

      const totalAssets = await defiVault.totalAssets();
      const totalSupply = await defiVault.totalSupply();
      
      console.log(`  [Final] Vault Total Assets: ${ethers.formatEther(totalAssets)} SKT`);
      console.log(`  [Final] Vault Total Shares: ${ethers.formatEther(totalSupply)} dwSKT`);

      expect(totalAssets).to.equal(deposit1 + deposit2);
      expect(totalSupply).to.equal(deposit1 + deposit2);
      expect(await defiVault.balanceOf(user1.address)).to.equal(deposit1);
      expect(await defiVault.balanceOf(user2.address)).to.equal(deposit2);
    });
  });

  describe("Withdraw", function () {
    it("Should revert if withdrawing zero shares", async function () {
      const { defiVault, user1 } = await loadFixture(deployWithdrawFixture);
      // Try to withdraw 0
      await expect(defiVault.connect(user1).withdraw(0)).to.be.revertedWithCustomError(
        defiVault,
        "ZeroShares"
      );
    });

    it("Should revert if withdrawing more shares than owned", async function () {
      const { defiVault, token, withdrawAddress, user1 } = await loadFixture(deployWithdrawFixture);
      const depositAmount = ethers.parseEther("100");
      await token.connect(user1).approve(withdrawAddress, depositAmount);
      await defiVault.connect(user1).deposit(depositAmount);

      const excessShares = ethers.parseEther("200");
      await expect(defiVault.connect(user1).withdraw(excessShares))
        .to.be.revertedWithCustomError(defiVault, "InsufficientShares")
        .withArgs(excessShares, depositAmount);
    });

    it("Should burn shares and return underlying asset 1:1 initially", async function () {
      const { defiVault, token, withdrawAddress, user1 } = await loadFixture(deployWithdrawFixture);
      const amount = ethers.parseEther("100");

      console.log(`\n  --- DEMO: Basic Withdraw ---`);

      // Deposit
      await token.connect(user1).approve(withdrawAddress, amount);
      await defiVault.connect(user1).deposit(amount);

      // Check balance before withdraw
      const balanceBefore = await token.balanceOf(user1.address);
      const sharesBefore = await defiVault.balanceOf(user1.address);
      
      console.log(`  [Before Withdraw] User1 SKT Balance: ${ethers.formatEther(balanceBefore)}`);
      console.log(`  [Before Withdraw] User1 Share Balance: ${ethers.formatEther(sharesBefore)} dwSKT`);
      console.log(`  [Action] User1 requests to withdraw: 100 dwSKT (all shares)`);

      // Withdraw all
      await expect(defiVault.connect(user1).withdraw(amount))
        .to.emit(defiVault, "Withdrawn")
        .withArgs(user1.address, amount, amount); // 1:1 ratio

      const balanceAfter = await token.balanceOf(user1.address);
      const sharesAfter = await defiVault.balanceOf(user1.address);
      
      console.log(`  [After Withdraw] User1 SKT Balance: ${ethers.formatEther(balanceAfter)} (+${ethers.formatEther(amount)} SKT)`);
      console.log(`  [After Withdraw] User1 Share Balance: ${ethers.formatEther(sharesAfter)} dwSKT`);
      
      expect(balanceAfter - balanceBefore).to.equal(amount);
      
      expect(await defiVault.balanceOf(user1.address)).to.equal(0);
      expect(await defiVault.totalAssets()).to.equal(0);
      expect(await defiVault.totalSupply()).to.equal(0);
    });
  });

  describe("Yield Math", function () {
    it("Should return proportional assets after yield is injected", async function () {
      const { defiVault, token, withdrawAddress, owner, user1, user2 } = await loadFixture(deployWithdrawFixture);
      const amount = ethers.parseEther("100");

      console.log(`\n  --- DEMO: Yield Math (Staking/Farming Profit) ---`);

      // User1 deposits 100
      await token.connect(user1).approve(withdrawAddress, amount);
      await defiVault.connect(user1).deposit(amount);
      console.log(`  1. User1 deposits 100 SKT -> Receives 100 dwSKT (Ratio 1:1)`);

      // Inject yield directly into the contract (simulate farming profit)
      const yieldAmount = ethers.parseEther("20");
      await token.mint(withdrawAddress, yieldAmount);
      
      const vaultAssetsAfterYield = await defiVault.totalAssets();
      console.log(`  2. Market pumps/Yield injected: +20 SKT`);
      console.log(`     -> Vault Total Assets: ${ethers.formatEther(vaultAssetsAfterYield)} SKT`);
      console.log(`     -> Total Shares existing: 100 dwSKT`);
      console.log(`     -> (New Ratio: 1 dwSKT = 1.2 SKT)`);

      expect(vaultAssetsAfterYield).to.equal(amount + yieldAmount);

      // User2 deposits 120 asset -> Should receive 100 shares
      const user2Deposit = ethers.parseEther("120");
      await token.connect(user2).approve(withdrawAddress, user2Deposit);
      await defiVault.connect(user2).deposit(user2Deposit);

      const user2Shares = await defiVault.balanceOf(user2.address);
      console.log(`  3. User2 deposits 120 SKT at the new ratio`);
      console.log(`     -> User2 receives: ${ethers.formatEther(user2Shares)} dwSKT`);

      expect(user2Shares).to.equal(amount); // 100 shares

      // User1 withdraws 50 shares
      const withdrawShares = ethers.parseEther("50");
      
      // Expected assets = 50 * 240 / 200 = 60
      const expectedAssets = ethers.parseEther("60");
      
      console.log(`  4. User1 decides to withdraw HALF of their shares (50 dwSKT)`);

      const user1SktBefore = await token.balanceOf(user1.address);
      await expect(defiVault.connect(user1).withdraw(withdrawShares))
        .to.emit(defiVault, "Withdrawn")
        .withArgs(user1.address, expectedAssets, withdrawShares);

      const user1SktAfter = await token.balanceOf(user1.address);
      const returnedAssets = user1SktAfter - user1SktBefore;
      console.log(`     -> User1 receives: ${ethers.formatEther(returnedAssets)} SKT (Original base was 50 SKT)`);
      console.log(`     -> User1 Profit from withdrawn portion: +10 SKT`);
    });
  });
});
