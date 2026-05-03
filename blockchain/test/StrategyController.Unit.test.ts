import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { deployStrategyUnitFixture } from "./shared/Strategy.fixture";

// Pool IDs mặc định trong constructor
const POOL_FLEXIBLE = 0; // minStake=1e18, lockDuration=0,       penalty=0
const POOL_DONG     = 1; // minStake=10e18, lockDuration=30days, penalty=2%
const POOL_BAC      = 2; // minStake=50e18, lockDuration=90days, penalty=5%
const POOL_VANG     = 3; // minStake=100e18,lockDuration=180days,penalty=10%

const E18 = ethers.parseEther("1");

describe("StakingStrategyController — Unit Tests", function () {

  // ================================================================
  //  DEPLOYMENT
  // ================================================================
  describe("Deployment", function () {
    it("sets stakingToken và vault đúng", async function () {
      const { strategy, tokenAddress, vaultAddress } = await loadFixture(deployStrategyUnitFixture);
      expect(await strategy.stakingToken()).to.equal(tokenAddress);
      expect(await strategy.vault()).to.equal(vaultAddress);
    });

    it("reverts TokenMismatch nếu token không khớp vault.asset()", async function () {
      const [owner] = await ethers.getSigners();
      const T = await ethers.getContractFactory("Token");
      const wrongToken = await T.deploy(owner.address);
      const V = await ethers.getContractFactory("DefiVault");
      const vault = await V.deploy(await wrongToken.getAddress());

      const T2 = await T.deploy(owner.address); // token khác
      const S  = await ethers.getContractFactory("StakingStrategyController");
      await expect(
        S.deploy(await T2.getAddress(), await vault.getAddress())
      ).to.be.revertedWithCustomError(S, "TokenMismatch");
    });

    it("khởi tạo 4 pool mặc định", async function () {
      const { strategy } = await loadFixture(deployStrategyUnitFixture);
      expect(await strategy.poolCount()).to.equal(4);
    });

    it("IStrategy: totalDeployed = 0 lúc đầu", async function () {
      const { strategy } = await loadFixture(deployStrategyUnitFixture);
      expect(await strategy.totalDeployed()).to.equal(0);
    });
  });

  // ================================================================
  //  stake()
  // ================================================================
  describe("stake()", function () {
    it("deposits assets vào Vault — vault.totalAssets() tăng", async function () {
      const { strategy, vault, stakeAs, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_FLEXIBLE, amount);
      expect(await vault.totalAssets()).to.equal(amount);
    });

    it("lưu shares (không phải raw amount) vào StakeInfo", async function () {
      const { strategy, vault, stakeAs, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_FLEXIBLE, amount);
      const info = await strategy.userStakes(alice.address, 0);
      expect(info.shares).to.be.gt(0);
      expect(info.assetsAtStake).to.equal(amount);
      // shares phải match vault.balanceOf(strategy)
      expect(await vault.balanceOf(await strategy.getAddress())).to.equal(info.shares);
    });

    it("cập nhật totalDeployedToVault và totalStaked", async function () {
      const { strategy, stakeAs, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_FLEXIBLE, amount);
      expect(await strategy.totalDeployedToVault()).to.equal(amount);
      expect(await strategy.totalStaked()).to.equal(amount);
    });

    it("emits Staked + VaultDeposited", async function () {
      const { strategy, token, strategyAddress, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await token.connect(alice).approve(strategyAddress, amount);
      await expect(strategy.connect(alice).stake(POOL_FLEXIBLE, amount))
        .to.emit(strategy, "Staked")
        .withArgs(alice.address, POOL_FLEXIBLE, 0, amount)
        .and.to.emit(strategy, "VaultDeposited");
    });

    it("reverts PoolNotFound khi poolId >= poolCount", async function () {
      const { strategy, stakeAs, alice } = await loadFixture(deployStrategyUnitFixture);
      await expect(stakeAs(alice, 99, E18)).to.be.revertedWithCustomError(strategy, "PoolNotFound");
    });

    it("reverts PoolInactive khi pool bị disable", async function () {
      const { strategy, stakeAs, alice, owner } = await loadFixture(deployStrategyUnitFixture);
      await strategy.connect(owner).updatePool(POOL_FLEXIBLE, false);
      await expect(stakeAs(alice, POOL_FLEXIBLE, E18)).to.be.revertedWithCustomError(strategy, "PoolInactive");
    });

    it("reverts AmountTooLow khi amount < minStake", async function () {
      const { strategy, stakeAs, alice } = await loadFixture(deployStrategyUnitFixture);
      // Pool 1 (Đồng): minStake = 10e18
      const tooLow = ethers.parseEther("1");
      await expect(stakeAs(alice, POOL_DONG, tooLow)).to.be.revertedWithCustomError(strategy, "AmountTooLow");
    });

    it("reverts AmountTooHigh khi amount > maxStake", async function () {
      const { strategy, stakeAs, owner, alice } = await loadFixture(deployStrategyUnitFixture);
      // Tạo pool với maxStake = 50e18
      await strategy.connect(owner).addPool("TestPool", 0, 0, E18, ethers.parseEther("50"));
      const poolId = (await strategy.poolCount()) - 1n;
      await expect(stakeAs(alice, Number(poolId), ethers.parseEther("100")))
        .to.be.revertedWithCustomError(strategy, "AmountTooHigh");
    });

    it("reverts whenPaused", async function () {
      const { strategy, stakeAs, alice, owner } = await loadFixture(deployStrategyUnitFixture);
      await strategy.connect(owner).pause();
      await expect(stakeAs(alice, POOL_FLEXIBLE, E18)).to.be.revertedWithCustomError(strategy, "EnforcedPause");
    });
  });

  // ================================================================
  //  unstake()
  // ================================================================
  describe("unstake()", function () {
    it("redeems shares từ Vault — trả đúng assets 1:1 khi không có yield", async function () {
      const { strategy, token, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_FLEXIBLE, amount);
      await mineBlock();

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const balAfter = await token.balanceOf(alice.address);

      // Vault có Virtual Shares offset nên có thể diff 1 wei
      expect(balAfter - balBefore).to.be.closeTo(amount, ethers.parseEther("0.001"));
    });

    it("trả principal + yield sau khi Vault nhận donation", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, bob } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_FLEXIBLE, amount);

      // Inject yield: bob transfer trực tiếp vào vault
      const yieldAmt = ethers.parseEther("20");
      await token.connect(bob).transfer(await vault.getAddress(), yieldAmt);

      await mineBlock();
      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const balAfter = await token.balanceOf(alice.address);

      // alice nhận > 100 (có yield ~20 trừ rounding của Virtual Shares)
      expect(balAfter - balBefore).to.be.gt(amount);
    });

    it("áp penalty khi rút sớm (pool Đồng: 2%)", async function () {
      const { strategy, token, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_DONG, amount);
      await mineBlock();

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const balAfter = await token.balanceOf(alice.address);

      const returned = balAfter - balBefore;
      // penalty = 2% của principal = 2 ETH → nhận ~98 ETH
      expect(returned).to.be.lt(amount);
      expect(returned).to.be.closeTo(ethers.parseEther("98"), ethers.parseEther("0.01"));
    });

    it("KHÔNG áp penalty sau lockDuration", async function () {
      const { strategy, token, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_DONG, amount);

      // Fast-forward qua 30 days
      await network.provider.send("evm_increaseTime", [30 * 24 * 3600 + 1]);
      await mineBlock();

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const balAfter = await token.balanceOf(alice.address);

      // Nhận đủ principal (không penalty), có thể ± rounding
      expect(balAfter - balBefore).to.be.closeTo(amount, ethers.parseEther("0.001"));
    });

    it("emits VaultRedeemed + Unstaked; YieldGenerated khi có yield", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, bob } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_FLEXIBLE, amount);
      await token.connect(bob).transfer(await vault.getAddress(), ethers.parseEther("10"));
      await mineBlock();

      await expect(strategy.connect(alice).unstake(0))
        .to.emit(strategy, "VaultRedeemed")
        .and.to.emit(strategy, "Unstaked")
        .and.to.emit(strategy, "YieldGenerated");
    });

    it("reverts StakeNotActive khi stakeId không active", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E18);
      await mineBlock();
      await strategy.connect(alice).unstake(0);
      await expect(strategy.connect(alice).unstake(0)).to.be.revertedWithCustomError(strategy, "StakeNotActive");
    });

    it("reverts whenPaused", async function () {
      const { strategy, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E18);
      await mineBlock();
      await strategy.connect(owner).pause();
      await expect(strategy.connect(alice).unstake(0)).to.be.revertedWithCustomError(strategy, "EnforcedPause");
    });

    it("state bị clear sau unstake (isActive=false, shares=0)", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E18);
      await mineBlock();
      await strategy.connect(alice).unstake(0);
      const info = await strategy.userStakes(alice.address, 0);
      expect(info.isActive).to.be.false;
      expect(info.shares).to.equal(0);
    });
  });

  // ================================================================
  //  harvest()
  // ================================================================
  describe("harvest()", function () {
    it("tăng vault.totalAssets() mà KHÔNG mint thêm Vault shares", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, ethers.parseEther("100"));
      await mineBlock();

      const sharesBefore = await vault.totalSupply();
      const rewardAmt = ethers.parseEther("10");
      await token.connect(owner).approve(await strategy.getAddress(), rewardAmt);
      await strategy.connect(owner).harvest(rewardAmt);

      expect(await vault.totalSupply()).to.equal(sharesBefore); // không mint shares
      expect(await vault.totalAssets()).to.equal(ethers.parseEther("110")); // totalAssets tăng
    });

    it("tăng pricePerShare sau harvest", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, ethers.parseEther("100"));
      await mineBlock();

      const ppsBefore = await vault.previewRedeem(E18);

      const rewardAmt = ethers.parseEther("10");
      await token.connect(owner).approve(await strategy.getAddress(), rewardAmt);
      await strategy.connect(owner).harvest(rewardAmt);

      const ppsAfter = await vault.previewRedeem(E18);
      expect(ppsAfter).to.be.gt(ppsBefore);
    });

    it("emits Harvested event", async function () {
      const { strategy, token, owner } = await loadFixture(deployStrategyUnitFixture);
      const rewardAmt = ethers.parseEther("5");
      await token.connect(owner).approve(await strategy.getAddress(), rewardAmt);
      await expect(strategy.connect(owner).harvest(rewardAmt))
        .to.emit(strategy, "Harvested")
        .withArgs(rewardAmt);
    });

    it("reverts khi non-owner gọi", async function () {
      const { strategy, token, alice } = await loadFixture(deployStrategyUnitFixture);
      const rewardAmt = ethers.parseEther("5");
      await token.connect(alice).approve(await strategy.getAddress(), rewardAmt);
      await expect(strategy.connect(alice).harvest(rewardAmt))
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });

    it("reverts HarvestAmountZero khi amount = 0", async function () {
      const { strategy, owner } = await loadFixture(deployStrategyUnitFixture);
      await expect(strategy.connect(owner).harvest(0))
        .to.be.revertedWithCustomError(strategy, "HarvestAmountZero");
    });

    it("cập nhật totalHarvested", async function () {
      const { strategy, token, owner } = await loadFixture(deployStrategyUnitFixture);
      const rewardAmt = ethers.parseEther("5");
      await token.connect(owner).approve(await strategy.getAddress(), rewardAmt);
      await strategy.connect(owner).harvest(rewardAmt);
      expect(await strategy.totalHarvested()).to.equal(rewardAmt);
    });
  });

  // ================================================================
  //  emergencyWithdraw()
  // ================================================================
  describe("emergencyWithdraw()", function () {
    it("redeems từ Vault, áp penalty đầy đủ theo pool", async function () {
      const { strategy, token, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_DONG, amount); // penalty=2%
      await mineBlock();

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).emergencyWithdraw(0);
      const balAfter = await token.balanceOf(alice.address);

      // Nhận ~98 (penalty 2%)
      expect(balAfter - balBefore).to.be.closeTo(ethers.parseEther("98"), ethers.parseEther("0.01"));
    });

    it("hoạt động khi Strategy paused (Vault không bị pause)", async function () {
      const { strategy, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E18);
      await mineBlock();
      await strategy.connect(owner).pause();
      // emergencyWithdraw không có whenNotPaused — phải thành công
      await expect(strategy.connect(alice).emergencyWithdraw(0)).to.not.be.reverted;
    });

    it("reverts StakeNotActive khi stakeId không active", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyUnitFixture);
      await expect(strategy.connect(alice).emergencyWithdraw(99))
        .to.be.revertedWithCustomError(strategy, "StakeNotActive");
    });

    it("emits PenaltyCollected + EmergencyWithdrawn", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_DONG, ethers.parseEther("100"));
      await mineBlock();
      await expect(strategy.connect(alice).emergencyWithdraw(0))
        .to.emit(strategy, "PenaltyCollected")
        .and.to.emit(strategy, "EmergencyWithdrawn");
    });
  });

  // ================================================================
  //  VIEW FUNCTIONS
  // ================================================================
  describe("View Functions", function () {
    it("getPendingYield() = 0 khi chưa có yield", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, ethers.parseEther("100"));
      await mineBlock();
      expect(await strategy.getPendingYield(alice.address, 0)).to.equal(0);
    });

    it("getPendingYield() > 0 sau khi harvest", async function () {
      const { strategy, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, ethers.parseEther("100"));
      await mineBlock();
      const rewardAmt = ethers.parseEther("10");
      await token.connect(owner).approve(await strategy.getAddress(), rewardAmt);
      await strategy.connect(owner).harvest(rewardAmt);
      expect(await strategy.getPendingYield(alice.address, 0)).to.be.gt(0);
    });

    it("getPendingYield() = 0 khi stake không active", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E18);
      await mineBlock();
      await strategy.connect(alice).unstake(0);
      expect(await strategy.getPendingYield(alice.address, 0)).to.equal(0);
    });

    it("getStakeValue() khớp với vault.previewRedeem(shares)", async function () {
      const { strategy, vault, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, ethers.parseEther("100"));
      await mineBlock();
      const info = await strategy.userStakes(alice.address, 0);
      const expected = await vault.previewRedeem(info.shares);
      expect(await strategy.getStakeValue(alice.address, 0)).to.equal(expected);
    });

    it("isLocked() đúng trước lockDuration", async function () {
      const { strategy, stakeAs, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_DONG, ethers.parseEther("10"));
      const [locked] = await strategy.isLocked(alice.address, 0);
      expect(locked).to.be.true;
    });

    it("isLocked() = false sau lockDuration", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_DONG, ethers.parseEther("10"));
      await network.provider.send("evm_increaseTime", [30 * 24 * 3600 + 1]);
      await mineBlock();
      const [locked, remaining] = await strategy.isLocked(alice.address, 0);
      expect(locked).to.be.false;
      expect(remaining).to.equal(0);
    });

    it("totalVaultAssets() = vault.totalAssets()", async function () {
      const { strategy, vault, stakeAs, alice } = await loadFixture(deployStrategyUnitFixture);
      await stakeAs(alice, POOL_FLEXIBLE, ethers.parseEther("100"));
      expect(await strategy.totalVaultAssets()).to.equal(await vault.totalAssets());
    });
  });

  // ================================================================
  //  ADMIN: addPool / updatePool / pause / unpause
  // ================================================================
  describe("Admin", function () {
    it("addPool() chỉ callable bởi owner", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyUnitFixture);
      await expect(strategy.connect(alice).addPool("X", 0, 0, 0, 0))
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });

    it("updatePool() chỉ callable bởi owner", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyUnitFixture);
      await expect(strategy.connect(alice).updatePool(0, false))
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });

    it("pause/unpause chỉ callable bởi owner", async function () {
      const { strategy, alice } = await loadFixture(deployStrategyUnitFixture);
      await expect(strategy.connect(alice).pause())
        .to.be.revertedWithCustomError(strategy, "OwnableUnauthorizedAccount");
    });
  });
});
