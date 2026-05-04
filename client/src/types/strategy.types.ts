export interface StrategyStats {
  totalDeployedToVault: string;
  totalHarvested: string;
  totalPenalties: string;
  pricePerShare: string;
  vaultPaused: boolean;
}

export interface UserStrategyStake {
  stakeId: number;
  poolId: number;
  assetsAtStake: string;       // SKT principal đã nạp
  sharesReceived: string;      // dvSKT do contract giữ
  currentValue: string;        // giá trị SKT có thể rút hiện tại
  pendingYield: string;        // lãi hiện có
  isActive: boolean;
  isLocked: boolean;
  lockRemainingSeconds: number;
  stakedAt: string;
  status: string;              // ACTIVE, UNSTAKED, EMERGENCY_WITHDRAWN
  stakeTransactionHash?: string;
}

export interface StrategyPoolData {
  poolId: number;
  name: string;
  apr: number;          // basis points (100 = 1%)
  lockDuration: number; // in seconds
  penaltyRate: number;  // basis points
  minStake: string;     // in wei
  maxStake: string;     // in wei
  totalStaked: string;  // in wei
  isActive: boolean;
}
