export const StakingABI = [
  // Views
  "function totalDeployedToVault() view returns (uint256)",
  "function totalHarvested() view returns (uint256)",
  "function totalPenalties() view returns (uint256)",
  "function getUserStakeCount(address user) view returns (uint256)",
  "function getUserStake(address user, uint256 index) view returns (uint256 poolId, uint256 shares, uint256 assetsAtStake, uint256 stakedAt, bool isActive)",
  "function isLocked(address user, uint256 stakeId) view returns (bool locked, uint256 remaining)",
  
  // Actions
  "function stake(uint256 poolId, uint256 amount)",
  "function unstake(uint256 stakeId)",
  "function emergencyWithdraw(uint256 stakeId)",
  "function harvest()",
  
  // Admin & Pool Configuration getters
  "function getPool(uint256 poolId) view returns (tuple(string name, uint256 apr, uint256 lockDuration, uint256 penaltyRate, uint256 minStake, uint256 maxStake, uint256 totalStaked, bool isActive))",
  "function getAllPools() view returns (tuple(string name, uint256 apr, uint256 lockDuration, uint256 penaltyRate, uint256 minStake, uint256 maxStake, uint256 totalStaked, bool isActive)[])"
];
