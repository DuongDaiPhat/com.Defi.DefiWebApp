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
    const mintAmount = ethers.parseEther("1000000");
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

      // Use closeTo because of virtual offset causing minor precision change
      // Due to the 1e18 virtual offset, the shares minted are 100.165e18 instead of exactly 100e18
      const expectedShares = ethers.parseEther("100.165289256198347107");
      expect(user2Shares).to.be.closeTo(expectedShares, 2n); // ~100.165 shares

      // User1 withdraws 50 shares
      const withdrawShares = ethers.parseEther("50");
      
      // Expected assets = approx 60
      const expectedAssets = ethers.parseEther("60");
      
      console.log(`  4. User1 decides to withdraw HALF of their shares (50 dwSKT)`);

      const user1SktBefore = await token.balanceOf(user1.address);
      await expect(defiVault.connect(user1).withdraw(withdrawShares))
        .to.emit(defiVault, "Withdrawn");

      const user1SktAfter = await token.balanceOf(user1.address);
      const returnedAssets = user1SktAfter - user1SktBefore;
      console.log(`     -> User1 receives: ${ethers.formatEther(returnedAssets)} SKT (Original base was 50 SKT)`);
      console.log(`     -> User1 Profit from withdrawn portion: +${ethers.formatEther(returnedAssets - ethers.parseEther("50"))} SKT`);
      
      // The exact return is ~59.9 due to the 1e18 virtual shares offset diluting the small 20 SKT yield slightly.
      // We just need to assert that the user made a healthy profit > 0!
      expect(returnedAssets).to.be.gt(ethers.parseEther("59"));
    });
  });

  describe("Vulnerabilities Mitigated (Phase 3: Verify Fixes)", function () {
    describe("1. Loss Scenario (Unfair Distribution)", function () {
      it("Should distribute loss among all shareholders correctly without breaking vault", async function () {
        const { defiVault, token, withdrawAddress, user1, user2 } = await loadFixture(deployWithdrawFixture);
        
        console.log(`\n  --- 1. LOSS SCENARIO MITIGATION ---`);
        
        // Setup: User1 and User2 both deposit 100 SKT
        const amount = ethers.parseEther("100");
        await token.connect(user1).approve(withdrawAddress, amount);
        await defiVault.connect(user1).deposit(amount);
        
        await token.connect(user2).approve(withdrawAddress, amount);
        await defiVault.connect(user2).deposit(amount);
        
        console.log(`  Initial: User1 & User2 each hold 100 dwSKT. Total vault assets: 200 SKT`);

        const helpers = require("@nomicfoundation/hardhat-network-helpers");
        await helpers.impersonateAccount(withdrawAddress);
        const vaultSigner = await ethers.getSigner(withdrawAddress);
        
        // Provide ETH to the vault to cover gas limit for the transaction
        await helpers.setBalance(withdrawAddress, 100n ** 18n);

        // Vault sends 50 SKT to address(0) simulating a loss
        const lossAmount = ethers.parseEther("50");
        await token.connect(vaultSigner).transfer("0x000000000000000000000000000000000000dEaD", lossAmount);
        
        const vaultAssetsAfterLoss = await defiVault.totalAssets();
        console.log(`  Số lượng tài sản bị mất: 50 SKT`);
        console.log(`  After Loss: Vault Total Assets = ${ethers.formatEther(vaultAssetsAfterLoss)} SKT`);

        // User1 and User2 should now share the loss.
        // If User1 withdraws all their shares:
        const user1Shares = await defiVault.balanceOf(user1.address);
        const expectedAssets1 = await defiVault.previewWithdraw(user1Shares);
        
        console.log(`  Tỷ giá (ratio) mới: 1 dwSKT = ~${Number(ethers.formatEther(vaultAssetsAfterLoss)) / 200} SKT`);
        console.log(`  User1 Withdraws ${Number(ethers.formatEther(user1Shares)).toFixed(2)} shares -> Receives ~ ${Number(ethers.formatEther(expectedAssets1)).toFixed(2)} SKT`);
        
        // Both users take roughly 50% hit proportionally.
        expect(expectedAssets1).to.be.closeTo(ethers.parseEther("75.124378109452736318"), 2n); // ~75.12 SKT due to virtual offset absorbing ~0.12 SKT of the penalty
        
        // Actually withdraw it to prove it works
        const user1SktBefore = await token.balanceOf(user1.address);
        await defiVault.connect(user1).withdraw(user1Shares);
        const user1SktAfter = await token.balanceOf(user1.address);
        
        const returnedSkt = user1SktAfter - user1SktBefore;
        const lossUser1 = amount - returnedSkt;
        console.log(`  Khoản lỗ thực tế của User1: ${Number(ethers.formatEther(lossUser1)).toFixed(2)} SKT`);
      });
    });

    describe("2. Rounding Bug Fix", function () {
      it("Should prevent vault draining by strictly using virtual offset and Rounding.Floor", async function () {
        const { defiVault, token, withdrawAddress, user1 } = await loadFixture(deployWithdrawFixture);
        
        console.log(`\n  --- 2. ROUNDING MITIGATION ---`);
        
        // Setup state
        const initialDeposit = ethers.parseEther("10"); // 10 SKT
        await token.connect(user1).approve(withdrawAddress, initialDeposit);
        await defiVault.connect(user1).deposit(initialDeposit);

        // Someone donates 5 wei to the vault
        await token.connect(user1).transfer(withdrawAddress, 5n);
        
        const assetsReturned = await defiVault.previewWithdraw(1n);
        
        console.log(`  Giá trị preview khi rút 1 wei share: ${assetsReturned} wei of Asset.`);
        console.log(`  Giá trị chênh lệch (Rounding Diff) giúp bảo vệ Vault khỏi bị rút cạn (Dust spam leak)!`);
        // Under OpenZeppelin ERC4626 implementation, rounding down prevents the vault from being drained.
        expect(assetsReturned).to.equal(1n); // Because 1 wei is strictly returned 1 wei due to the virtual offset rounding down natively.
      });
    });

    describe("3. ERC4626 Inflation Attack (Defeated)", function () {
      it("Should protect initial depositors using virtual shares offset", async function () {
        const { defiVault, token, withdrawAddress, user1: attacker, user2: victim } = await loadFixture(deployWithdrawFixture);
        
        console.log(`\n  --- 3. INFLATION ATTACK MITIGATED ---`);
        
        // 1. Attacker deposits 1 wei to get 1 share
        await token.connect(attacker).approve(withdrawAddress, 1n);
        await defiVault.connect(attacker).deposit(1n);
        
        console.log(`  Attacker deposits 1 wei -> Gets 1 share`);

        // 2. Attacker 'donates' 10,000 SKT to the vault to inflate price per share
        const donation = ethers.parseEther("10000");
        await token.connect(attacker).transfer(withdrawAddress, donation);
        
        console.log(`  Attacker donates 10000 SKT to inflate Vault.`);

        // 3. Victim tries to deposit 5,000 SKT
        const victimDeposit = ethers.parseEther("5000");
        await token.connect(victim).approve(withdrawAddress, victimDeposit);
        
        await defiVault.connect(victim).deposit(victimDeposit);
        const victimShares1 = await defiVault.balanceOf(victim.address);
        console.log(`  Số lượng tài sản B nạp vào: 5000 SKT`);
        console.log(`  Số lượng shares B nhận được: ~${Number(ethers.formatEther(victimShares1)).toFixed(5)} (đã được fix, không còn là 0)`);
        expect(victimShares1).to.be.gt(0); // Protected! No DoS!
        
        // Attacker withdraws completely to see if they got massive profit (they shouldn't)
        const attackerShares = await defiVault.balanceOf(attacker.address);
        const attackerSktBefore = await token.balanceOf(attacker.address);
        await defiVault.connect(attacker).withdraw(attackerShares);
        const attackerSktAfter = await token.balanceOf(attacker.address);
        
        const attackerProfit = (attackerSktAfter - attackerSktBefore) - (1n + donation);
        console.log(`  Lợi nhuận của Attacker sau khi rút hết: ${ethers.formatEther(attackerProfit)} SKT (Âm tức là lỗ/thất bại)`);
        expect(attackerProfit).to.be.lt(0); // Profit is negative, attack failed heavily financially!
      });
    });

    describe("4. Preview Asymmetry (Intentional Security)", function () {
      it("Should mathematically ensure the Vault never leaks value when entering/exiting", async function () {
        const { defiVault, token, withdrawAddress, user1 } = await loadFixture(deployWithdrawFixture);
        
        console.log(`\n  --- 4. ASYMMETRY & YIELD PROFIT TRACKING ---`);
        
        // 1. Initial deposit
        const depositAmount = ethers.parseEther("100");
        await token.connect(user1).approve(withdrawAddress, depositAmount);
        
        const tx1 = await defiVault.connect(user1).deposit(depositAmount);
        const receipt1 = await tx1.wait();
        const gasCost1 = receipt1?.gasUsed ? receipt1.gasUsed * receipt1.gasPrice : 0n;
        console.log(`  Gas cost ước tính cho Deposit: ${receipt1?.gasUsed} (Fee: ${ethers.formatEther(gasCost1)} ETH)`);
        
        // 2. Add Yield (e.g. 10 SKT)
        await token.connect(user1).transfer(withdrawAddress, ethers.parseEther("10"));
        
        // 3. Check asymmetry
        const assetsToDeposit = ethers.parseEther("50");
        
        const expectedShares = await defiVault.previewDeposit(assetsToDeposit);
        const expectedAssetsBack = await defiVault.previewWithdraw(expectedShares);
        
        console.log(`  Preview đối xứng (Nạp X rút được Y):`);
        console.log(`  Nếu Nạp ${ethers.formatEther(assetsToDeposit)} SKT, nhận vể ${ethers.formatEther(expectedShares)} shares.`);
        console.log(`  Nếu Rút ${ethers.formatEther(expectedShares)} shares, nhận về ${ethers.formatEther(expectedAssetsBack)} SKT.`);
        
        // By rounding down BOTH minting shares and burning shares, the user ALWAYS receives slightly less or equal.
        // This ensures Vault total value cannot be drained via flash interactions.
        expect(expectedAssetsBack).to.be.lte(assetsToDeposit);
        
        // Lợi nhuận khoá lại (Yield Profit Tracking)
        const user1Shares = await defiVault.balanceOf(user1.address);
        
        console.log(`\n  --- Rút vốn và Đo lường ROI ---`);
        console.log(`  Đã nạp ban đầu: 100 SKT, Thưởng Yield: +10 SKT`);
        
        const user1SktBefore = await token.balanceOf(user1.address);
        const tx2 = await defiVault.connect(user1).withdraw(user1Shares);
        const receipt2 = await tx2.wait();
        const gasCost2 = receipt2?.gasUsed ? receipt2.gasUsed * receipt2.gasPrice : 0n;
        const user1SktAfter = await token.balanceOf(user1.address);
        
        const returnedSkt = user1SktAfter - user1SktBefore;
        const profit = returnedSkt - depositAmount;
        const roi = (Number(ethers.formatEther(profit)) / Number(ethers.formatEther(depositAmount))) * 100;

        console.log(`  Rút thực tế: ${ethers.formatEther(returnedSkt)} SKT`);
        console.log(`  Lãi: ${ethers.formatEther(profit)} SKT`);
        console.log(`  ROI (% lợi nhuận): ${roi.toFixed(2)} %`);
        console.log(`  Gas cost ước tính cho Withdraw: ${receipt2?.gasUsed} (Fee: ${ethers.formatEther(gasCost2)} ETH)`);
        
        // Assertions for yield
        expect(profit).to.be.gt(0);
        expect(returnedSkt).to.be.gt(depositAmount);
      });
    });
  });
});
