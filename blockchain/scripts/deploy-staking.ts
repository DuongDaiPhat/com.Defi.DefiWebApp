/**
 * demo.ts — Deploy + Interact trong 1 script duy nhất
 * Chạy: npx hardhat run scripts/demo.ts --network hardhat
 */
import { ethers } from "hardhat";
import type { ContractTransactionResponse } from "ethers";

// ── Types ────────────────────────────────────────────────────────
interface PoolInfo {
  id:           bigint;
  name:         string;
  apr:          bigint;
  lockDuration: bigint;
  penaltyRate:  bigint;
  minStake:     bigint;
  maxStake:     bigint;
  totalStaked:  bigint;
  isActive:     boolean;
}

interface StakeInfo {
  poolId:        bigint;
  amount:        bigint;
  stakedAt:      bigint;
  lastClaimAt:   bigint;
  pendingReward: bigint;
  isActive:      boolean;
}

// ── Terminal colors ──────────────────────────────────────────────
const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  cyan:    "\x1b[36m",
  red:     "\x1b[31m",
  magenta: "\x1b[35m",
  bgBlue:  "\x1b[44m",
  bgGreen: "\x1b[42m",
  white:   "\x1b[37m",
} as const;

const fmt    = (n: bigint): string  => ethers.formatEther(n);
const sep    = (): void             => console.log(C.dim + "─".repeat(60) + C.reset);
const header = (title: string): void =>
  console.log(`\n${C.bgBlue}${C.bold}${C.white} ⛓  ${title} ${C.reset}`);
const deployHeader = (title: string): void =>
  console.log(`\n${C.bgGreen}${C.bold}${C.white} 🚀  ${title} ${C.reset}`);

async function printBalance(
  label:   string,
  address: string,
  token:   { balanceOf(a: string): Promise<bigint> },
  symbol:  string
): Promise<void> {
  const bal = await token.balanceOf(address);
  console.log(`   ${label.padEnd(20)} ${C.cyan}${fmt(bal).padStart(14)} ${symbol}${C.reset}`);
}

// ── Main ─────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const [deployer, alice, bob] = await ethers.getSigners();
  const { name: networkName, chainId } = await ethers.provider.getNetwork();

  console.log("\n" + "═".repeat(60));
  console.log(`${C.bold}  DeFi Staking — Full Demo${C.reset}`);
  console.log("═".repeat(60));
  console.log(`  Network  : ${C.cyan}${networkName} (chainId: ${chainId})${C.reset}`);
  console.log(`  Deployer : ${C.cyan}${deployer.address}${C.reset}`);
  console.log(`  Alice    : ${C.cyan}${alice.address}${C.reset}`);
  console.log(`  Bob      : ${C.cyan}${bob.address}${C.reset}`);
  sep();

  // ══════════════════════════════════════════════════════════════
  //  PHASE 1 — DEPLOY
  // ══════════════════════════════════════════════════════════════

  // 1. Deploy RewardToken (RWT)
  deployHeader("1 / 3 — Deploy RewardToken (RWT)");
  const RewardTokenFactory = await ethers.getContractFactory("Token");
  const rewardToken = await RewardTokenFactory.deploy(deployer.address);
  await rewardToken.waitForDeployment();
  const rewardTokenAddr = await rewardToken.getAddress();
  console.log(`   ✅ RewardToken : ${C.green}${rewardTokenAddr}${C.reset}`);

  // 2. Deploy StakingToken (STK)
  deployHeader("2 / 3 — Deploy StakingToken (STK)");
  const StakingTokenFactory = await ethers.getContractFactory("Token");
  const stakingToken = await StakingTokenFactory.deploy(deployer.address);
  await stakingToken.waitForDeployment();
  const stakingTokenAddr = await stakingToken.getAddress();
  console.log(`   ✅ StakingToken: ${C.green}${stakingTokenAddr}${C.reset}`);

  // 3. Deploy DeFiStaking
  deployHeader("3 / 3 — Deploy DeFiStaking");
  const StakingFactory = await ethers.getContractFactory("DeFiStaking");
  const staking = await StakingFactory.deploy(stakingTokenAddr, rewardTokenAddr);
  await staking.waitForDeployment();
  const stakingAddr = await staking.getAddress();
  console.log(`   ✅ DeFiStaking : ${C.green}${stakingAddr}${C.reset}`);

  // 4. Nạp reward pool
  sep();
  console.log(`\n${C.bold}  💰 Funding reward pool with 100,000 RWT...${C.reset}`);
  const rewardAmount = ethers.parseEther("100000");
  await (await rewardToken.approve(stakingAddr, rewardAmount) as ContractTransactionResponse).wait();
  await (await staking.depositReward(rewardAmount) as ContractTransactionResponse).wait();
  console.log(`   ✅ Reward pool funded: ${C.yellow}${fmt(rewardAmount)} RWT${C.reset}`);

  // 5. In pools
  sep();
  console.log(`\n${C.bold}  📋 Staking Pools:${C.reset}`);
  const poolCount = await staking.poolCount();
  for (let i = 0n; i < poolCount; i++) {
    const p       = await staking.getPool(i) as PoolInfo;
    const lock    = Number(p.lockDuration);
    const lockStr = lock === 0 ? "No lock   " : `${lock / 86400} days   `;
    console.log(
      `   [Pool ${i}] ${C.bold}${p.name.padEnd(10)}${C.reset}` +
      `  APR: ${C.green}${(Number(p.apr) / 100).toString().padStart(5)}%${C.reset}` +
      `  Lock: ${C.yellow}${lockStr.padEnd(12)}${C.reset}` +
      `  Penalty: ${C.red}${Number(p.penaltyRate) / 100}%${C.reset}`
    );
  }

  // ══════════════════════════════════════════════════════════════
  //  PHASE 2 — INTERACT
  // ══════════════════════════════════════════════════════════════

  // Setup: phân phối STK
  sep();
  header("SETUP — Distribute STK tokens");
  const aliceAmt = ethers.parseEther("500");
  const bobAmt   = ethers.parseEther("200");
  await (await stakingToken.transfer(alice.address, aliceAmt) as ContractTransactionResponse).wait();
  await (await stakingToken.transfer(bob.address,   bobAmt)   as ContractTransactionResponse).wait();
  console.log(`   ✅ Alice receives ${fmt(aliceAmt)} STK`);
  console.log(`   ✅ Bob   receives ${fmt(bobAmt)} STK`);

  // BƯỚC 1: Alice → Pool 0 (Flexible)
  sep();
  header("ALICE — Stake 100 STK into Flexible Pool (5% APR)");
  const aliceStake1 = ethers.parseEther("100");
  await (await stakingToken.connect(alice).approve(stakingAddr, aliceStake1) as ContractTransactionResponse).wait();
  await (await staking.connect(alice).stake(0n, aliceStake1) as ContractTransactionResponse).wait();
  console.log(`   ✅ Staked ${fmt(aliceStake1)} STK  (stakeId=0, Pool 0 — Flexible)`);

  // BƯỚC 2: Alice → Pool 1 (Silver)
  header("ALICE — Stake 200 STK into Silver Pool (12% APR, 30 days lock)");
  const aliceStake2 = ethers.parseEther("200");
  await (await stakingToken.connect(alice).approve(stakingAddr, aliceStake2) as ContractTransactionResponse).wait();
  await (await staking.connect(alice).stake(1n, aliceStake2) as ContractTransactionResponse).wait();
  console.log(`   ✅ Staked ${fmt(aliceStake2)} STK  (stakeId=1, Pool 1 — Silver)`);

  // BƯỚC 3: Bob → Pool 2 (Gold)
  header("BOB — Stake 200 STK into Gold Pool (20% APR, 90 days lock)");
  await (await stakingToken.connect(bob).approve(stakingAddr, bobAmt) as ContractTransactionResponse).wait();
  await (await staking.connect(bob).stake(2n, bobAmt) as ContractTransactionResponse).wait();
  console.log(`   ✅ Staked ${fmt(bobAmt)} STK  (stakeId=0, Pool 2 — Gold)`);

  // Balances sau khi stake
  sep();
  header("BALANCES after staking");
  await printBalance("Alice STK", alice.address, stakingToken, "STK");
  await printBalance("Bob   STK", bob.address,   stakingToken, "STK");
  console.log(`\n   Total staked in contract: ${C.green}${fmt(await staking.totalStaked())} STK${C.reset}`);
  console.log(`   Reward pool remaining   : ${C.yellow}${fmt(await staking.rewardPool())} RWT${C.reset}`);

  // Time travel +30 ngày
  sep();
  header("TIME TRAVEL — Fast-forward 30 days");
  await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
  await ethers.provider.send("evm_mine", []);
  console.log("   ✅ Advanced 30 days");

  // Pending rewards
  header("PENDING REWARDS after 30 days");
  const [r0, r1, rb] = await Promise.all([
    staking.pendingReward(alice.address, 0n),
    staking.pendingReward(alice.address, 1n),
    staking.pendingReward(bob.address,   0n),
  ]);
  console.log(`   Alice stakeId=0 (Flexible 5% ): ${C.magenta}${fmt(r0).padStart(12)} RWT${C.reset}`);
  console.log(`   Alice stakeId=1 (Silver  12%): ${C.magenta}${fmt(r1).padStart(12)} RWT${C.reset}`);
  console.log(`   Bob   stakeId=0 (Gold    20%): ${C.magenta}${fmt(rb).padStart(12)} RWT${C.reset}`);

  // Alice claim reward (Flexible)
  sep();
  header("ALICE — Claim reward from Flexible pool");
  await (await staking.connect(alice).claimReward(0n) as ContractTransactionResponse).wait();
  const aliceRWT = await rewardToken.balanceOf(alice.address);
  console.log(`   ✅ Claimed! Alice RWT balance: ${C.magenta}${fmt(aliceRWT)} RWT${C.reset}`);

  // Alice rút sớm Silver (còn locked)
  sep();
  header("ALICE — Early unstake from Silver (still locked → emergency)");
  const [silverLocked] = await staking.isLocked(alice.address, 1n);
  if (silverLocked) {
    console.log("   ⚠️  Still locked! Emergency withdraw with 5% penalty...");
    await (await staking.connect(alice).emergencyWithdraw(1n) as ContractTransactionResponse).wait();
    console.log("   ✅ Emergency withdraw executed (lost 5% = 10 STK)");
  } else {
    console.log("   Unlocked — normal unstake...");
    await (await staking.connect(alice).unstake(1n) as ContractTransactionResponse).wait();
  }

  // Time travel +60 ngày (Bob Gold unlock)
  sep();
  header("TIME TRAVEL — Fast-forward 60 more days (Bob's Gold unlocks)");
  await ethers.provider.send("evm_increaseTime", [60 * 24 * 60 * 60]);
  await ethers.provider.send("evm_mine", []);
  const [bobStillLocked] = await staking.isLocked(bob.address, 0n);
  console.log(
    `   ✅ Bob's Gold pool locked: ${bobStillLocked
      ? `${C.red}YES`
      : `${C.green}NO — ready to unstake`
    }${C.reset}`
  );

  // Bob unstake
  header("BOB — Unstake from Gold pool (full reward, no penalty)");
  const bobPending = await staking.pendingReward(bob.address, 0n);
  console.log(`   Pending reward: ${C.magenta}${fmt(bobPending)} RWT${C.reset}`);
  await (await staking.connect(bob).unstake(0n) as ContractTransactionResponse).wait();
  console.log("   ✅ Unstaked successfully!");

  // Final balances
  sep();
  header("FINAL BALANCES");
  await printBalance("Alice STK", alice.address, stakingToken, "STK");
  await printBalance("Alice RWT", alice.address, rewardToken,  "RWT");
  await printBalance("Bob   STK", bob.address,   stakingToken, "STK");
  await printBalance("Bob   RWT", bob.address,   rewardToken,  "RWT");

  const [aliceClaimed, bobClaimed] = await Promise.all([
    staking.totalRewardClaimed(alice.address),
    staking.totalRewardClaimed(bob.address),
  ]);
  console.log(`\n   Total claimed Alice: ${C.magenta}${fmt(aliceClaimed)} RWT${C.reset}`);
  console.log(`   Total claimed Bob  : ${C.magenta}${fmt(bobClaimed)} RWT${C.reset}`);
  console.log(`\n   Remaining staked   : ${C.green}${fmt(await staking.totalStaked())} STK${C.reset}`);
  console.log(`   Remaining rewards  : ${C.yellow}${fmt(await staking.rewardPool())} RWT${C.reset}`);

  sep();
  console.log(`${C.green}${C.bold}\n  ✅ All interactions complete!\n${C.reset}`);
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});