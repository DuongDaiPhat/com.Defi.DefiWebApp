/**
 * Run: npx hardhat run scripts/deploy-staking.ts --network localhost
 */
import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);

  const TokenFactory = await ethers.getContractFactory("Token");
  const rewardToken  = await TokenFactory.deploy(deployer.address);
  await rewardToken.waitForDeployment();

  const stakingToken = await TokenFactory.deploy(deployer.address);
  await stakingToken.waitForDeployment();

  const StakingFactory = await ethers.getContractFactory("WalletStaking");
  const staking = await StakingFactory.deploy(
    await stakingToken.getAddress(),
    await rewardToken.getAddress()
  );
  await staking.waitForDeployment();

  console.log("RewardToken  :", await rewardToken.getAddress());
  console.log("StakingToken :", await stakingToken.getAddress());
  console.log("DeFiStaking  :", await staking.getAddress());
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});