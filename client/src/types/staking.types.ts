/**
 * Staking Types and Interfaces
 */

export interface StakingPool {
  id: number;
  name: string;
  apr: number; // basis points (100 = 1%, 10000 = 100%)
  lockDuration: number; // seconds
  penaltyRate: number; // basis points
  minStake: bigint;
  maxStake: bigint; // 0 = no limit
  totalStaked: bigint;
  isActive: boolean;
}

export interface StakeInfo {
  poolId: number;
  amount: bigint;
  stakedAt: number; // unix timestamp
  lastClaimAt: number; // unix timestamp
  pendingReward: bigint;
  isActive: boolean;
}

export interface UserStake {
  stakeId: number;
  poolId: number;
  poolName: string;
  amount: string; // formatted
  amountRaw: bigint; // raw value
  stakedAt: Date;
  lastClaimAt: Date;
  pendingReward: string; // formatted
  pendingRewardRaw: bigint; // raw value
  isActive: boolean;
  isLocked: boolean;
  lockRemainingTime: number; // seconds (0 if unlocked)
  apr: number;
  lockDuration: number;
}

export interface StakingAction {
  type: 'STAKE' | 'UNSTAKE' | 'CLAIM' | 'EMERGENCY_WITHDRAW';
  walletAddress: string;
  poolId: number;
  amount?: string;
  rewardAmount?: string;
  transactionHash: string;
  timestamp: Date;
}

export interface ClaimHistory {
  id: string;
  walletAddress: string;
  stakeId: number;
  rewardAmount: string;
  claimedAt: Date;
  transactionHash: string;
}

export interface StakingStats {
  totalStaked: string;
  totalRewardsClaimed: string;
  activeStakesCount: number;
  unrealizedRewards: string;
}

export interface LockStatus {
  locked: boolean;
  remainingTime: number; // seconds
}
