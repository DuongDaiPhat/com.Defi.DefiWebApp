import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { deployStrategyFixture } from "./shared/Strategy.fixture";

const E18  = ethers.parseEther("1");
const E100 = ethers.parseEther("100");
const E10  = ethers.parseEther("10");
const E50  = ethers.parseEther("50");

const POOL_FLEXIBLE = 0;
const POOL_DONG     = 1; // 30 days, 2% penalty
const POOL_VANG     = 3; // 180 days, 10% penalty

describe("StrategyVault — Integration Tests", function () {

  // ================================================================
  //  FULL LIFECYCLE
  // ================================================================
  describe("Full Lifecycle: Stake → Harvest → Unstake", function () {
    it("alice stakes 100 STK → vault nhận 100 STK, Strategy giữ shares", async function () {
      const { strategy, vault, stakeAs, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);

      expect(await vault.totalAssets()).to.equal(E100);
      const info = await strategy.userStakes(alice.address, 0);
      expect(info.isActive).to.be.true;
      expect(info.shares).to.be.gt(0);
      expect(await vault.balanceOf(await strategy.getAddress())).to.equal(info.shares);
    });

    it("keeper harvest 10 STK → pricePerShare tăng, totalSupply không đổi", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      const supplyBefore = await vault.totalSupply();
      const ppsBefore    = await vault.previewRedeem(E18);

      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);

      expect(await vault.totalSupply()).to.equal(supplyBefore);        // không mint shares
      expect(await vault.previewRedeem(E18)).to.be.gt(ppsBefore);     // pricePerShare tăng
      expect(await vault.totalAssets()).to.equal(E100 + E10);          // totalAssets tăng
    });

    it("alice unstake sau harvest → nhận > 100 STK (gốc + yield)", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const balAfter = await token.balanceOf(alice.address);

      expect(balAfter - balBefore).to.be.gt(E100);
      expect(balAfter - balBefore).to.be.closeTo(E100 + E10, ethers.parseEther("0.1"));
    });

    it("bob stake sau harvest → nhận ít shares hơn alice per STK", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, bob, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);

      // alice shares đã được tính tại pricePerShare thấp hơn
      const aliceInfo = await strategy.userStakes(alice.address, 0);

      await stakeAs(bob, POOL_FLEXIBLE, E100);
      const bobInfo = await strategy.userStakes(bob.address, 0);

      // pricePerShare cao hơn → bob nhận ít shares hơn alice cho cùng 100 STK
      expect(bobInfo.shares).to.be.lt(aliceInfo.shares);
    });

    it("multiple users → mỗi user benefit proportionally từ 1 harvest", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, bob, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await stakeAs(bob, POOL_FLEXIBLE, E100);
      await mineBlock();

      // Harvest 20 STK (10 cho mỗi user)
      const reward = ethers.parseEther("20");
      await token.connect(owner).approve(await strategy.getAddress(), reward);
      await strategy.connect(owner).harvest(reward);

      // alice và bob giữ số shares bằng nhau → nhận yield bằng nhau
      const aliceYield = await strategy.getPendingYield(alice.address, 0);
      const bobYield   = await strategy.getPendingYield(bob.address, 0);
      expect(aliceYield).to.be.closeTo(bobYield, ethers.parseEther("0.001"));
    });
  });

  // ================================================================
  //  PENALTY SCENARIOS
  // ================================================================
  describe("Penalty Scenarios", function () {
    it("early unstake Pool Đồng (2%): user nhận assetsReturned - penalty", async function () {
      const { strategy, token, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_DONG, amount);
      await mineBlock();

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const returned = (await token.balanceOf(alice.address)) - balBefore;

      // penalty = 2% of 100 = 2 STK → nhận ~98
      expect(returned).to.be.closeTo(ethers.parseEther("98"), ethers.parseEther("0.01"));
    });

    it("unstake sau lockDuration (30 days): nhận đủ principal + yield", async function () {
      const { strategy, token, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      const amount = ethers.parseEther("100");
      await stakeAs(alice, POOL_DONG, amount);
      await network.provider.send("evm_increaseTime", [30 * 24 * 3600 + 1]);
      await mineBlock();

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const returned = (await token.balanceOf(alice.address)) - balBefore;
      expect(returned).to.be.closeTo(amount, ethers.parseEther("0.001"));
    });

    it("early emergencyWithdraw Pool Vàng áp penalty và không underflow", async function () {
      // Full DefiVault path không có loss; loss thật được cover trong StrategyVault.Security.test.ts bằng MockVault.
      const { strategy, token, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_VANG, ethers.parseEther("100")); // penalty=10%
      await mineBlock();

      const tx   = await strategy.connect(alice).emergencyWithdraw(0);
      const rcpt = await tx.wait();

      expect(rcpt?.status).to.equal(1);
    });

    it("penalty nằm lại trong Strategy — track bằng totalPenalties", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_DONG, ethers.parseEther("100")); // 2% penalty = 2 STK
      await mineBlock();
      await strategy.connect(alice).unstake(0);

      expect(await strategy.totalPenalties()).to.be.gt(0);
      // penalty ~2 STK tồn tại trong contract
      const strategyBalance = await (await ethers.getContractAt(
        "Token",
        await strategy.stakingToken()
      )).balanceOf(await strategy.getAddress());
      expect(strategyBalance).to.be.closeTo(ethers.parseEther("2"), ethers.parseEther("0.01"));
    });
  });

  // ================================================================
  //  MULTI-POOL
  // ================================================================
  describe("Multi-Pool Strategy", function () {
    it("alice Pool 0 + bob Pool 3: cả 2 benefit từ cùng 1 harvest", async function () {
      const { strategy, token, stakeAs, mineBlock, alice, bob, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await stakeAs(bob, POOL_VANG, ethers.parseEther("100"));
      await mineBlock();

      // Cả 2 đều dùng cùng 1 vault → harvest benefits cả 2
      await token.connect(owner).approve(await strategy.getAddress(), ethers.parseEther("20"));
      await strategy.connect(owner).harvest(ethers.parseEther("20"));

      expect(await strategy.getPendingYield(alice.address, 0)).to.be.gt(0);
      expect(await strategy.getPendingYield(bob.address, 0)).to.be.gt(0);
    });

    it("vault.totalAssets() >= totalDeployedToVault sau harvest", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, bob, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await stakeAs(bob, POOL_VANG, ethers.parseEther("100"));
      await mineBlock();

      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);

      const vaultAssets  = await vault.totalAssets();
      const totalDeployed = await strategy.totalDeployedToVault();
      expect(vaultAssets).to.be.gte(totalDeployed);
    });
  });

  // ================================================================
  //  HARVEST COMPOUNDING
  // ================================================================
  describe("Harvest Compounding", function () {
    it("2 lần harvest: pricePerShare tăng đơn điệu P1 < P2", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);
      const pps1 = await vault.previewRedeem(E18);

      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);
      const pps2 = await vault.previewRedeem(E18);

      expect(pps2).to.be.gt(pps1);
    });

    it("alice unstake sau 2 harvest: nhận đúng value theo previewRedeem", async function () {
      const { strategy, vault, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();

      // Harvest 2 lần
      for (let i = 0; i < 2; i++) {
        await token.connect(owner).approve(await strategy.getAddress(), E10);
        await strategy.connect(owner).harvest(E10);
      }

      const info          = await strategy.userStakes(alice.address, 0);
      const expectedValue = await vault.previewRedeem(info.shares);

      const balBefore = await token.balanceOf(alice.address);
      await strategy.connect(alice).unstake(0);
      const received = (await token.balanceOf(alice.address)) - balBefore;

      // received phải khớp previewRedeem (không penalty vì pool flexible)
      expect(received).to.be.closeTo(expectedValue, ethers.parseEther("0.001"));
    });
  });

  // ================================================================
  //  GAS BENCHMARKS (NCKH)
  // ================================================================
  describe("Gas Benchmarks (NCKH)", function () {
    it("[GAS] stake() — StakingStrategyController", async function () {
      const { strategy, token, strategyAddress, alice } = await loadFixture(deployStrategyFixture);
      await token.connect(alice).approve(strategyAddress, E100);
      const tx   = await strategy.connect(alice).stake(POOL_FLEXIBLE, E100);
      const rcpt = await tx.wait();
      console.log(`      ⛽ StakingStrategyController.stake()   gas: ${rcpt?.gasUsed}`);
    });

    it("[GAS] unstake() no yield — StakingStrategyController", async function () {
      const { strategy, stakeAs, mineBlock, alice } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();
      const tx   = await strategy.connect(alice).unstake(0);
      const rcpt = await tx.wait();
      console.log(`      ⛽ StakingStrategyController.unstake() no-yield gas: ${rcpt?.gasUsed}`);
    });

    it("[GAS] unstake() with yield — StakingStrategyController", async function () {
      const { strategy, token, stakeAs, mineBlock, alice, owner } = await loadFixture(deployStrategyFixture);
      await stakeAs(alice, POOL_FLEXIBLE, E100);
      await mineBlock();
      await token.connect(owner).approve(await strategy.getAddress(), E10);
      await strategy.connect(owner).harvest(E10);
      const tx   = await strategy.connect(alice).unstake(0);
      const rcpt = await tx.wait();
      console.log(`      ⛽ StakingStrategyController.unstake() with-yield gas: ${rcpt?.gasUsed}`);
    });

    it("[GAS] harvest() — StakingStrategyController", async function () {
      const { strategy, token, owner } = await loadFixture(deployStrategyFixture);
      await token.connect(owner).approve(await strategy.getAddress(), E10);
      const tx   = await strategy.connect(owner).harvest(E10);
      const rcpt = await tx.wait();
      console.log(`      ⛽ StakingStrategyController.harvest()  gas: ${rcpt?.gasUsed}`);
    });

    it("[GAS] stake() — WalletStaking (baseline)", async function () {
      const [owner, alice] = await ethers.getSigners();
      const T  = await ethers.getContractFactory("Token");
      const tk = await T.deploy(owner.address);
      await tk.mint(alice.address, ethers.parseEther("1000000"));
      const W  = await ethers.getContractFactory("WalletStaking");
      const ws = await W.deploy(await tk.getAddress(), await tk.getAddress());
      const wsAddress = await ws.getAddress();

      await tk.connect(alice).approve(wsAddress, E18);
      const tx   = await ws.connect(alice).stake(0, E18);
      const rcpt = await tx.wait();
      console.log(`      ⛽ WalletStaking.stake()               gas: ${rcpt?.gasUsed}`);
    });

    it("[GAS] unstake() — WalletStaking (baseline)", async function () {
      const [owner, alice] = await ethers.getSigners();
      const T  = await ethers.getContractFactory("Token");
      const tk = await T.deploy(owner.address);
      await tk.mint(alice.address, ethers.parseEther("1000000"));
      const W  = await ethers.getContractFactory("WalletStaking");
      const ws = await W.deploy(await tk.getAddress(), await tk.getAddress());
      const wsAddress = await ws.getAddress();

      await tk.connect(alice).approve(wsAddress, E18);
      await ws.connect(alice).stake(0, E18);
      const tx   = await ws.connect(alice).unstake(0);
      const rcpt = await tx.wait();
      console.log(`      ⛽ WalletStaking.unstake()             gas: ${rcpt?.gasUsed}`);
    });
  });
});
