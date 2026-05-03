import { ethers } from "hardhat";

/**
 * Fixture: deploy Token + DefiVault + StakingStrategyController
 * Dùng cho cả Unit tests và Integration tests.
 *
 * Actors:
 *  - owner:  deployer, keeper (harvest), pool admin
 *  - alice:  staker chính
 *  - bob:    staker thứ hai
 *  - carol:  staker thứ ba (multi-pool scenarios)
 */
export async function deployStrategyFixture() {
  const [owner, alice, bob, carol] = await ethers.getSigners();

  // ── Token ──────────────────────────────────────────────────────
  const TokenFactory = await ethers.getContractFactory("Token");
  const token = await TokenFactory.deploy(owner.address);
  const tokenAddress = await token.getAddress();

  // Mint tokens cho tất cả actors
  const MINT = ethers.parseEther("1000000");
  await token.mint(owner.address, MINT);
  await token.mint(alice.address, MINT);
  await token.mint(bob.address, MINT);
  await token.mint(carol.address, MINT);

  // ── DefiVault ──────────────────────────────────────────────────
  const VaultFactory = await ethers.getContractFactory("DefiVault");
  const vault = await VaultFactory.deploy(tokenAddress);
  const vaultAddress = await vault.getAddress();

  // ── StakingStrategyController ──────────────────────────────────
  const StrategyFactory = await ethers.getContractFactory("StakingStrategyController");
  const strategy = await StrategyFactory.deploy(tokenAddress, vaultAddress);
  const strategyAddress = await strategy.getAddress();

  // Helper: stake với approve trước
  async function stakeAs(
    signer: typeof alice,
    poolId: number,
    amount: bigint
  ) {
    await token.connect(signer).approve(strategyAddress, amount);
    return strategy.connect(signer).stake(poolId, amount);
  }

  // Helper: mine 1 block (bypass same-block withdrawal guard)
  async function mineBlock() {
    await ethers.provider.send("evm_mine", []);
  }

  return {
    token,
    tokenAddress,
    vault,
    vaultAddress,
    strategy,
    strategyAddress,
    owner,
    alice,
    bob,
    carol,
    stakeAs,
    mineBlock,
  };
}

export async function deployStrategyUnitFixture() {
  const [owner, alice, bob, carol] = await ethers.getSigners();

  const TokenFactory = await ethers.getContractFactory("Token");
  const token = await TokenFactory.deploy(owner.address);
  const tokenAddress = await token.getAddress();

  const MINT = ethers.parseEther("1000000");
  await token.mint(owner.address, MINT);
  await token.mint(alice.address, MINT);
  await token.mint(bob.address, MINT);
  await token.mint(carol.address, MINT);

  const VaultFactory = await ethers.getContractFactory("MockVault");
  const vault = await VaultFactory.deploy(tokenAddress);
  const vaultAddress = await vault.getAddress();

  const StrategyFactory = await ethers.getContractFactory("StakingStrategyController");
  const strategy = await StrategyFactory.deploy(tokenAddress, vaultAddress);
  const strategyAddress = await strategy.getAddress();

  async function stakeAs(
    signer: typeof alice,
    poolId: number,
    amount: bigint
  ) {
    await token.connect(signer).approve(strategyAddress, amount);
    return strategy.connect(signer).stake(poolId, amount);
  }

  async function mineBlock() {
    await ethers.provider.send("evm_mine", []);
  }

  return {
    token,
    tokenAddress,
    vault,
    vaultAddress,
    strategy,
    strategyAddress,
    owner,
    alice,
    bob,
    carol,
    stakeAs,
    mineBlock,
  };
}

export async function deployReentrantStrategyFixture() {
  const [owner, alice, bob] = await ethers.getSigners();

  const TokenFactory = await ethers.getContractFactory("ReentrantToken");
  const token = await TokenFactory.deploy(owner.address);
  const tokenAddress = await token.getAddress();

  const MINT = ethers.parseEther("1000000");
  await token.mint(alice.address, MINT);
  await token.mint(bob.address, MINT);

  const VaultFactory = await ethers.getContractFactory("DefiVault");
  const vault = await VaultFactory.deploy(tokenAddress);
  const vaultAddress = await vault.getAddress();

  const StrategyFactory = await ethers.getContractFactory("StakingStrategyController");
  const strategy = await StrategyFactory.deploy(tokenAddress, vaultAddress);
  const strategyAddress = await strategy.getAddress();

  async function mineBlock() {
    await ethers.provider.send("evm_mine", []);
  }

  return {
    token,
    tokenAddress,
    vault,
    vaultAddress,
    strategy,
    strategyAddress,
    owner,
    alice,
    bob,
    mineBlock,
  };
}
