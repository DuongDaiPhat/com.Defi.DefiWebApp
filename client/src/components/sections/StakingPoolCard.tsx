import React, { useState } from 'react';
import { StakingPool } from '../../types/staking.types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Zap, Lock, TrendingUp } from 'lucide-react';

interface StakingPoolCardProps {
  pool: StakingPool;
  onStakeClick: (poolId: number) => void;
  isLoading?: boolean;
}

export function StakingPoolCard({ pool, onStakeClick, isLoading = false }: StakingPoolCardProps) {
  const aprPercentage = Number(pool.apr) / 100; // Convert basis points to percentage
  const penaltyPercentage = Number(pool.penaltyRate) / 100;
  const lockDaysDisplay = Math.floor(Number(pool.lockDuration) / 86400);

  const formatAmount = (amount: bigint) => {
    if (amount === BigInt(0)) return 'Unlimited';
    return `${(Number(amount) / 1e18).toFixed(2)} DFI`;
  };

  return (
    <Card className="border-white/10 hover:border-white/20 transition-all cursor-pointer">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-bold text-white">{pool.name}</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Pool ID: {pool.id}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${
            pool.isActive ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <Zap className={`w-5 h-5 ${pool.isActive ? 'text-green-400' : 'text-red-400'}`} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* APR */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">APR</p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-4 h-4 text-[var(--color-primary-light)]" />
              <p className="text-lg font-bold text-white">{aprPercentage.toFixed(1)}%</p>
            </div>
          </div>

          {/* Lock Duration */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Lock Time</p>
            <div className="flex items-center gap-1">
              <Lock className="w-4 h-4 text-[var(--color-primary-light)]" />
              <p className="text-lg font-bold text-white">
                {lockDaysDisplay === 0 ? 'Flexible' : `${lockDaysDisplay}d`}
              </p>
            </div>
          </div>

          {/* Penalty Rate */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Early Penalty</p>
            <p className="text-lg font-bold text-white">{penaltyPercentage.toFixed(1)}%</p>
          </div>

          {/* Total Staked */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">TVL</p>
            <p className="text-sm font-bold text-[var(--color-primary-light)]">
              {(Number(pool.totalStaked) / 1e18).toFixed(2)} DFI
            </p>
          </div>
        </div>

        {/* Min/Max Stake */}
        <div className="bg-white/5 p-3 rounded-lg text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Min Stake:</span>
            <span className="text-white font-medium">{formatAmount(pool.minStake)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--color-text-muted)]">Max Stake:</span>
            <span className="text-white font-medium">{formatAmount(pool.maxStake)}</span>
          </div>
        </div>

        {/* Stake Button */}
        <Button
          onClick={() => onStakeClick(pool.id)}
          disabled={!pool.isActive || isLoading}
          className="w-full"
        >
          {isLoading ? 'Processing...' : 'Stake Now'}
        </Button>
      </div>
    </Card>
  );
}
