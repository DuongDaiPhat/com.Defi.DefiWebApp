import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployDefiVaultFixture } from "./shared/DefiVault.fixture";

describe("DefiVault: Security & MEV", function () {
  
  describe("Access Control & Pausable", function () {
    it("Should allow owner to pause and unpause", async function () {
      const { defiVault, owner, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);
      
      await defiVault.connect(owner).pause();
      expect(await defiVault.paused()).to.be.true;

      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount);
      
      await expect(defiVault.connect(user1)["deposit(uint256)"](amount))
        .to.be.revertedWithCustomError(defiVault, "EnforcedPause");

      await defiVault.connect(owner).unpause();
      await expect(defiVault.connect(user1)["deposit(uint256)"](amount)).to.not.be.reverted;
    });

    it("Should allow owner to emergency withdraw when paused", async function () {
      const { defiVault, owner, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);
      
      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount);
      await defiVault.connect(user1)["deposit(uint256)"](amount);

      await expect(defiVault.connect(owner).emergencyWithdraw())
        .to.be.revertedWithCustomError(defiVault, "ExpectedPause");
      
      await defiVault.connect(owner).pause();
      
      const ownerBalBefore = await token.balanceOf(owner.address);
      await defiVault.connect(owner).emergencyWithdraw();
      const ownerBalAfter = await token.balanceOf(owner.address);

      expect(ownerBalAfter - ownerBalBefore).to.equal(amount);
    });

    it("Should enforce max deposit and withdraw caps", async function () {
      const { defiVault, owner, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);
      
      const maxDep = ethers.parseEther("50");
      await defiVault.connect(owner).setMaxDeposit(maxDep);
      
      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount);
      await expect(defiVault.connect(user1)["deposit(uint256)"](amount))
        .to.be.revertedWith("DefiVault: exceeds max deposit");

      await defiVault.connect(user1)["deposit(uint256)"](maxDep); // works

      const maxWith = ethers.parseEther("20");
      await defiVault.connect(owner).setMaxWithdraw(maxWith);
      
      await ethers.provider.send("evm_mine", []);

      const userShares = await defiVault.balanceOf(user1.address);
      // Attempt to redeem all shares (which translates to 50 assets > max 20)
      await expect(defiVault.connect(user1)["redeem(uint256)"](userShares))
        .to.be.revertedWith("DefiVault: exceeds max withdraw");
    });
  });

  describe("Transaction Safety & Anti-MEV", function () {
    it("Should revert if depositing and withdrawing in the same block", async function () {
      const { defiVault, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);
      
      // To simulate same block in hardhat, we need to disable automine
      await ethers.provider.send("evm_setAutomine", [false]);
      
      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount);
      
      const depositTx = await defiVault.connect(user1)["deposit(uint256)"](amount);
      const withdrawTx = await defiVault.connect(user1)["redeem(uint256)"](amount);

      // Mine block
      await ethers.provider.send("evm_mine", []);
      
      await depositTx.wait();
      
      let reverted = false;
      try {
          await withdrawTx.wait();
      } catch (e) {
          reverted = true;
      }
      expect(reverted).to.be.true;

      // Re-enable automine
      await ethers.provider.send("evm_setAutomine", [true]);
    });
    
    it("Should protect against inflation attack on first deposit", async function () {
        const { defiVault, token, vaultAddress, user1: attacker, user2: victim } = await loadFixture(deployDefiVaultFixture);
        
        // 1. Attacker deposits 1 wei to get 1 share
        await token.connect(attacker).approve(vaultAddress, 1n);
        await defiVault.connect(attacker)["deposit(uint256)"](1n);

        // 2. Attacker 'donates' 10,000 SKT to the vault
        const donation = ethers.parseEther("10000");
        await token.connect(attacker).transfer(vaultAddress, donation);

        // 3. Victim tries to deposit 5,000 SKT
        const victimDeposit = ethers.parseEther("5000");
        await token.connect(victim).approve(vaultAddress, victimDeposit);
        
        await defiVault.connect(victim)["deposit(uint256)"](victimDeposit);
        const victimShares1 = await defiVault.balanceOf(victim.address);
        
        // Due to virtual shares (offset 10**18), the victim gets proper shares, not 0
        expect(victimShares1).to.be.gt(0); 
    });
  });
});
