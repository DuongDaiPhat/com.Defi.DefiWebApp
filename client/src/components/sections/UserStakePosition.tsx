import React, { useState } from 'react';
import { UserStake } from '../../types/staking.types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Clock, TrendingUp, AlertCircle } from 'lucide-react';

interface UserStakePositionProps {
  stake: UserStake;
  onUnstakeClick: (stakeId: number) => void;
  onClaimClick: (stakeId: number) => void;
  isLoading?: boolean;
}

export function UserStakePosition({
  stake,
  onUnstakeClick,
  onClaimClick,
  isLoading = false,
}: UserStakePositionProps) {
  const [showDetails, setShowDetails] = useState(false);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Unlocked';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h remaining`;
  };

  const hasRewards = parseFloat(stake.pendingReward) > 0;

  return (
    <Card className={`border-white/10 ${!stake.isActive ? 'opacity-60' : ''}`}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-bold text-white">
              {stake.poolName}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {!stake.isActive && <span className="text-red-400">Unstaked • </span>}
              Stake ID: {stake.stakeId}
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            stake.isActive
              ? stake.isLocked
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-green-500/20 text-green-300'
              : 'bg-gray-500/20 text-gray-300'
          }`}>
            {stake.isActive ? (stake.isLocked ? 'Locked' : 'Unlocked') : 'Inactive'}
          </div>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-3 gap-3">
          {/* Amount Staked */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Staked</p>
            <p className="font-bold text-white text-sm">{stake.amount} DFI</p>
          </div>

          {/* Pending Reward */}
          <div className={`p-3 rounded-lg ${
            hasRewards ? 'bg-green-500/10' : 'bg-white/5'
          }`}>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Reward</p>
            <p className={`font-bold text-sm ${hasRewards ? 'text-green-300' : 'text-white'}`}>
              {stake.pendingReward} DFI
            </p>
          </div>

          {/* APR */}
          <div className="p-3 bg-white/5 rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">APR</p>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-[var(--color-primary-light)]" />
              <p className="font-bold text-white text-sm">{(stake.apr / 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Lock Status */}
        {stake.isActive && stake.isLocked && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300 mb-1">
                  {formatTimeRemaining(stake.lockRemainingTime)}
                </p>
                <p className="text-xs text-amber-200/70">
                  Early unstaking will incur a {(stake.lockDuration / 100).toFixed(1)}% penalty
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {stake.isActive && (
          <div className="flex gap-2">
            <Button
              onClick={() => onUnstakeClick(stake.stakeId)}
              disabled={isLoading}
              className="flex-1"
              variant="secondary"
            >
              {isLoading ? 'Processing...' : 'Unstake'}
            </Button>
            <Button
              onClick={() => onClaimClick(stake.stakeId)}
              disabled={!hasRewards || isLoading}
              className="flex-1"
            >
              {isLoading ? 'Processing...' : `Claim ${stake.pendingReward}`}
            </Button>
          </div>
        )}

        {/* Expandable Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full text-xs text-[var(--color-primary-light)] hover:text-[var(--color-primary)] transition"
        >
          {showDetails ? '▼ Hide Details' : '▶ Show Details'}
        </button>

        {showDetails && (
          <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Staked At:</span>
              <span className="text-white">{formatDate(stake.stakedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Last Claim:</span>
              <span className="text-white">{formatDate(stake.lastClaimAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Pool ID:</span>
              <span className="text-white">{stake.poolId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Status:</span>
              <span className={stake.isActive ? 'text-green-300' : 'text-red-300'}>
                {stake.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
