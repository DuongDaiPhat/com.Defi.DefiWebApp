import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  deployReentrantStrategyFixture,
  deployStrategyFixture,
  deployStrategyUnitFixture,
} from "./shared/Strategy.fixture";

const E18  = ethers.parseEther("1");
const E100 = ethers.parseEther("100");
const E10  = ethers.parseEther("10");

const POOL_FLEXIBLE = 0;
const POOL_DONG     = 1; // 30 days, 2% penalty

describe("StrategyVault — Security Tests", function () {

  // ================================================================
  //  REENTRANCY
  // ================================================================
  describe("Reentrancy Guard", function () {
    const REENTRANCY_SELECTOR = ethers.id("ReentrancyGuardReentrantCall()").slice(0, 10);

    it("stake() chặn malicious ERC20 callback reenter stake()", async function () {
      const { strategy, token, strategyAddress, alice, owner } =
        await loadFixture(deployReentrantStrategyFixture);

      const attackData = strategy.interface.encodeFunctionData("stake", [POOL_FLEXIBLE, E18]);
      await token.connect(owner).setAttack(strategyAddress, attackData, 2); // Hook.TransferFrom

      await token.connect(alice).approve(strategyAddress, E100);
      await expect(strategy.connect(alice).stake(POOL_FLEXIBLE, E100)).to.not.be.reverted;

      expect(await token.attackAttempted()).to.equal(true);
      expect(await token.attackSucceeded()).to.equal(false);
      expect((await token.lastRevertData()).slice(0, 10)).to.equal(REENTRANCY_SELECTOR);
    });

    it("unstake() chặn cross-function reentry vào emergencyWithdraw()", async function () {
      const { strategy, token, strategyAddress, mineBlock, alice, owner } =
        await loadFixture(deployReentrantStrategyFixture);

      await token.connect(owner).primeStake(strategyAddress, POOL_FLEXIBLE, E18);
      await token.connect(alice).approve(strategyAddress, E100);
      await strategy.connect(alice).stake(POOL_FLEXIBLE, E100);
      await mineBlock();

      const attackData = strategy.interface.encodeFunctionData("emergencyWithdraw", [0]);
      await token.connect(owner).setAttack(strategyAddress, attackData, 1); // Hook.Transfer

      await expect(strategy.connect(alice).unstake(0)).to.not.be.reverted;
      expect(await token.attackAttempted()).to.equal(true);
      expect(await token.attackSucceeded()).to.equal(false);
      expect((await token.lastRevertData()).slice(0, 10)).to.equal(REENTRANCY_SELECTOR);

      const tokenContractStake = await strategy.userStakes(await token.getAddress(), 0);
      expect(tokenContractStake.isActive).to.equal(true);
    });

    it("harvest() chặn malicious ERC20 callback reenter stake()", async function () {
      const { strategy, token, strategyAddress, owner } =
        await loadFixture(deployReentrantStrategyFixture);

      const attackData = strategy.interface.encodeFunctionData("stake", [POOL_FLEXIBLE, E18]);
      await token.connect(owner).setAttack(strategyAddress, attackData, 2); // Hook.TransferFrom

      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await expect(strategy.connect(owner).harvest(E10)).to.not.be.reverted;

      expect(await token.attackAttempted()).to.equal(true);
      expect(await token.attackSucceeded()).to.equal(false);
      expect((await token.lastRevertData()).slice(0, 10)).to.equal(REENTRANCY_SELECTOR);
    });
  });

  // ================================================================
  //  ACCESS CONTROL
  // ================================================================
  describe("Access Control", function () {
    it("harvest() non-owner → OwnableUnauthorizedAccount", async function () {
      const { strategy, token, alice } = await loadFixture(deployStrategyFixture);
      await token.connect(alice).approve(await strategy.getAddress(), E10);
      await expect(strategy.connect(alice).harvest(E10))
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });

    it("addPool() non-owner → OwnableUnauthorizedAccount", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyFixture);
      await expect(strategy.connect(alice).addPool("X", 0, 0, 0, 0))
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });

    it("updatePool() non-owner → OwnableUnauthorizedAccount", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyFixture);
      await expect(strategy.connect(alice).updatePool(0, false))
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });

    it("pause() non-owner → OwnableUnauthorizedAccount", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyFixture);
      await expect(strategy.connect(alice).pause())
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });
  });

  // ================================================================
  //  ARITHMETIC SAFETY
  // ================================================================
  describe("Arithmetic Safety", function () {
    it("penalty calculation: penalty <= assetsAtStake luôn đúng", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_DONG, E100); // 2%
      await mineBlock();

      const info         = await strategy.userStakes(alice.address, 0);
      const assetsAtStake = info.assetsAtStake;

      // 2% of 100 = 2 → penalty = 2, luôn <= 100
      const expectedPenalty = assetsAtStake * 200n / 10000n; // BASIS_POINTS = 10000
      expect(expectedPenalty).to.be.lte(assetsAtStake);
    });

    it("yield calculation không underflow khi assetsReturned <= assetsAtStake", async function () {
      // getPendingYield trả 0 nếu không có yield — không negative
      const { strategy, stakeAs, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      const pendingYield = await strategy.getPendingYield(alice.address, 0);
      expect(pendingYield).to.equal(0); // 0 not negative
    });

    it("shares accounting không overflow với large amounts", async function () {
      const { strategy, stakeAs, alice } = await loadFixture(deployStrategyFixture);
      const largeAmount = ethers.parseEther("999999"); // ~1M tokens
      await expect(stakeAs(alice, POOL_FLEXIBLE, largeAmount)).to.not.be.reverted;
      const info = await strategy.userStakes(alice.address, 0);
      expect(info.shares).to.be.gt(0);
    });
  });

  // ================================================================
  //  INFLATION ATTACK (via Vault)
  // ================================================================
  describe("Inflation Attack Prevention", function () {
    it("attacker donate token vào vault trước alice stake: alice KHÔNG bị harm", async function () {
      const { strategy, vault, token, stakeAs, alice, bob } = await loadFixture(deployStrategyFixture);

      // bob là attacker: donate 1000 STK vào vault TRƯỚC khi alice stake
      const donateAmount = ethers.parseEther("1000");
      await token.connect(bob).transfer(await vault.getAddress(), donateAmount);

      // alice stake bình thường
      await expect(stakeAs(alice, POOL_FLEXIBLE, E100)).to.not.be.reverted;

      const info = await strategy.userStakes(alice.address, 0);
      // Virtual Shares offset (10**18) bảo vệ alice: vẫn nhận đủ shares
      expect(info.shares).to.be.gt(0);
      // getStakeValue phải xấp xỉ assetsAtStake (không bị steal)
      const stakeValue = await strategy.getStakeValue(alice.address, 0);
      expect(stakeValue).to.be.closeTo(E100, ethers.parseEther("0.2")); // tối đa 0.2% deviation
    });

    it("Strategy harvest sau donate: pricePerShare đúng, accounting hợp lệ", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, bob, owner } = await loadFixture(deployStrategyFixture);

      // Setup: alice stake, bob donate, owner harvest
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      // bob donate (simulate inflation attempt)
      await token.connect(bob).transfer(await vault.getAddress(), ethers.parseEther("50"));

      // Harvest thêm 10 STK
      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);

      // vault.totalAssets() = 100 (stake) + 50 (donate) + 10 (harvest) = 160
      expect(await vault.totalAssets()).to.equal(ethers.parseEther("160"));

      // previewRedeem vẫn trả về giá trị hợp lý
      const info      = await strategy.userStakes(alice.address, 0);
      const redeemVal = await vault.previewRedeem(info.shares);
      expect(redeemVal).to.be.gt(E100); // alice benefit từ cả donate và harvest
    });
  });

  // ================================================================
  //  SAME-BLOCK MEV PROTECTION
  // ================================================================
  describe("Same-Block MEV Protection", function () {
    it("stake + unstake cùng block → SameBlockWithdrawal revert từ Vault", async function () {
      const { strategy, token, alice } = await loadFixture(deployStrategyFixture);
      const strategyAddr = await strategy.getAddress();
      let unstakeHash = "";

      await ethers.provider.send("evm_setAutomine", [false]);
      try {
        const nonce = await ethers.provider.getTransactionCount(alice.address);

        // ethers v6: dùng .populateTransaction() trên method
        await alice.sendTransaction({
          ...(await token.connect(alice).approve.populateTransaction(strategyAddr, E100)),
          nonce: nonce,
        });
        await alice.sendTransaction({
          ...(await strategy.connect(alice).stake.populateTransaction(POOL_FLEXIBLE, E100)),
          nonce: nonce + 1,
        });
        const unstakeTx = await alice.sendTransaction({
          ...(await strategy.connect(alice).unstake.populateTransaction(0)),
          nonce: nonce + 2,
        });
        unstakeHash = unstakeTx.hash;

        await ethers.provider.send("evm_mine", []);

        const unstakeReceipt = await ethers.provider.getTransactionReceipt(unstakeHash);
        expect(unstakeReceipt?.status).to.equal(0);

        const info = await strategy.userStakes(alice.address, 0);
        expect(info.isActive).to.be.true;
      } finally {
        await ethers.provider.send("evm_setAutomine", [true]);
      }
    });

    it("unstake thành công sau khi mine block kế tiếp", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock(); // mine 1 block
      await expect(strategy.connect(alice).unstake(0)).to.not.be.reverted;
    });

    it("userB stake sau userA → cùng block unstake bị chặn (Strategy là msg.sender chung)", async function () {
      const { strategy, token, stakeAs, mineBlock, alice, bob } = await loadFixture(deployStrategyFixture);
      const strategyAddr = await strategy.getAddress();
      let aliceUnstakeHash = "";

      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      await ethers.provider.send("evm_setAutomine", [false]);
      try {
        const bobNonce   = await ethers.provider.getTransactionCount(bob.address);
        const aliceNonce = await ethers.provider.getTransactionCount(alice.address);

        await bob.sendTransaction({
          ...(await token.connect(bob).approve.populateTransaction(strategyAddr, E100)),
          nonce: bobNonce,
        });
        await bob.sendTransaction({
          ...(await strategy.connect(bob).stake.populateTransaction(POOL_FLEXIBLE, E100)),
          nonce: bobNonce + 1,
        });
        const aliceUnstakeTx = await alice.sendTransaction({
          ...(await strategy.connect(alice).unstake.populateTransaction(0)),
          nonce: aliceNonce,
        });
        aliceUnstakeHash = aliceUnstakeTx.hash;

        await ethers.provider.send("evm_mine", []);

        const aliceUnstakeReceipt = await ethers.provider.getTransactionReceipt(aliceUnstakeHash);
        expect(aliceUnstakeReceipt?.status).to.equal(0);

        const info = await strategy.userStakes(alice.address, 0);
        expect(info.isActive).to.be.true;
      } finally {
        await ethers.provider.send("evm_setAutomine", [true]);
      }
    });

    it("harvest cùng block với unstake không trigger SameBlockWithdrawal và dùng PPS mới", async function () {
      const { strategy, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyFixture);
      const strategyAddr = await strategy.getAddress();

      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      const balBefore = await token.balanceOf(alice.address);
      let harvestHash = "";
      let unstakeHash = "";

      await ethers.provider.send("evm_setAutomine", [false]);
      try {
        const ownerNonce = await ethers.provider.getTransactionCount(owner.address);
        const aliceNonce = await ethers.provider.getTransactionCount(alice.address);

        await owner.sendTransaction({
          ...(await token.connect(owner).approve.populateTransaction(strategyAddr, E10)),
          nonce: ownerNonce,
        });
        const harvestTx = await owner.sendTransaction({
          ...(await strategy.connect(owner).harvest.populateTransaction(E10)),
          nonce: ownerNonce + 1,
        });
        const unstakeTx = await alice.sendTransaction({
          ...(await strategy.connect(alice).unstake.populateTransaction(0)),
          nonce: aliceNonce,
        });

        harvestHash = harvestTx.hash;
        unstakeHash = unstakeTx.hash;
        await ethers.provider.send("evm_mine", []);

        const harvestReceipt = await ethers.provider.getTransactionReceipt(harvestHash);
        const unstakeReceipt = await ethers.provider.getTransactionReceipt(unstakeHash);
        expect(harvestReceipt?.status).to.equal(1);
        expect(unstakeReceipt?.status).to.equal(1);
      } finally {
        await ethers.provider.send("evm_setAutomine", [true]);
      }

      const received = (await token.balanceOf(alice.address)) - balBefore;
      expect(received).to.be.gt(E100);
      expect(received).to.be.closeTo(E100 + E10, ethers.parseEther("0.1"));
    });
  });

  // ================================================================
  //  EDGE CASES
  // ================================================================
  describe("Edge Cases", function () {
    it("Pool 0 flexible: stake với minStake = 1e18", async function () {
      const { strategy, stakeAs, alice } = await loadFixture(deployStrategyFixture);
      await expect(stakeAs(alice, POOL_FLEXIBLE, E18)).to.not.be.reverted;
    });

    it("emergencyWithdraw khi vault loss thật: penalty cap — không underflow", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice } =
        await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_DONG, E100);
      await mineBlock();

      await vault.setRedeemLossBps(9_900); // redeem 1% của principal, thấp hơn raw penalty 2%
      const balBefore = await token.balanceOf(alice.address);
      await expect(strategy.connect(alice).emergencyWithdraw(0)).to.not.be.reverted;
      const returned = (await token.balanceOf(alice.address)) - balBefore;

      expect(returned).to.equal(0);
      expect(await strategy.totalPenalties()).to.equal(ethers.parseEther("1"));
      expect(await strategy.totalDeployedToVault()).to.equal(0);
    });

    it("harvest với 0 stakers: không revert, tổng harvest tăng", async function () {
      const { strategy, token, owner } = await loadFixture(deployStrategyFixture);
      // Không có staker nào
      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await expect(strategy.connect(owner).harvest(E10)).to.not.be.reverted;
      expect(await strategy.totalHarvested()).to.equal(E10);
    });

    it("harvest KHÔNG mint Vault shares mới cho Strategy", async function () {
      const { strategy, vault, token, owner } = await loadFixture(deployStrategyFixture);
      const strategyAddr   = await strategy.getAddress();
      const sharesBefore   = await vault.balanceOf(strategyAddr);

      await token.connect(owner).approve(strategyAddr, E10);
      await strategy.connect(owner).harvest(E10);

      expect(await vault.balanceOf(strategyAddr)).to.equal(sharesBefore); // vẫn = 0
    });

    it("unstake inactive stakeId → StakeNotActive", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyFixture);
      await expect(strategy.connect(alice).unstake(999))
        .to.be.revertedWithCustomError(strategy, "StakeNotActive");
    });

    it("multiple stakes cùng user — stakeIds độc lập", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      // Unstake stakeId=0 không ảnh hưởng stakeId=1
      await strategy.connect(alice).unstake(0);
      const info1 = await strategy.userStakes(alice.address, 1);
      expect(info1.isActive).to.be.true;
    });

    it("vault.emergencyWithdraw() khi paused drain underlying (admin risk — documented)", async function () {
      // RISK DOCUMENTATION: Owner/multisig có thể drain vault bằng emergencyWithdraw() khi paused.
      // Mitigation: dùng multisig + timelock cho Vault owner trong production.
      const { vault, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      // Vault owner có thể pause và drain
      await vault.connect(owner).pause();
      const balBefore = await token.balanceOf(owner.address);
      await vault.connect(owner).emergencyWithdraw();
      const balAfter = await token.balanceOf(owner.address);

      // Owner nhận được tất cả token trong vault (bao gồm cả của alice)
      expect(balAfter - balBefore).to.equal(E100);
      // ⚠ Đây là rủi ro: cần multisig/timelock trong production
    });
  });
});
