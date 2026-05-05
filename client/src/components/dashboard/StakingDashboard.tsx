import React, { useState, useMemo } from 'react';
import { useStakingPool } from '../../hooks/useStakingPool';
import { useWalletStaking } from '../../hooks/useWalletStaking';
import { useWeb3 } from '../../hooks/useWeb3';
import { StakingPoolCard } from '../sections/StakingPoolCard';
import { UserStakePosition } from '../sections/UserStakePosition';
import { StakingForm } from '../sections/StakingForm';
import { Card } from '../ui/Card';
import { AlertCircle, TrendingUp, Zap, DollarSign } from 'lucide-react';

export function StakingDashboard() {
  const [activeTab, setActiveTab] = useState<'positions' | 'create'>('positions');
  const { address: userAddress, isConnected } = useWeb3();
  const { pools, loading: poolsLoading, error: poolsError } = useStakingPool();
  const {
    userStakes,
    isLoading: stakingLoading,
    error: stakingError,
    stake,
    unstake,
    claimReward,
  } = useWalletStaking(userAddress);

  const [stakeInProgress, setStakeInProgress] = useState(false);
  const [stakeError, setStakeError] = useState<string | null>(null);

  const handleStake = async (poolId: number, amount: string) => {
    try {
      setStakeInProgress(true);
      setStakeError(null);
      await stake(poolId, amount);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Staking failed';
      setStakeError(msg);
      throw err;
    } finally {
      setStakeInProgress(false);
    }
  };

  const handleUnstake = async (stakeId: number) => {
    try {
      setStakeInProgress(true);
      await unstake(stakeId);
    } catch (err) {
      console.error('Unstake failed:', err);
    } finally {
      setStakeInProgress(false);
    }
  };

  const handleClaimReward = async (stakeId: number) => {
    try {
      setStakeInProgress(true);
      await claimReward(stakeId);
    } catch (err) {
      console.error('Claim failed:', err);
    } finally {
      setStakeInProgress(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const activeStakes = userStakes.filter(s => s.isActive);
    const totalStaked = activeStakes.reduce((sum, s) => sum + parseFloat(s.amountRaw.toString()) / 1e18, 0);
    const totalRewards = activeStakes.reduce((sum, s) => sum + parseFloat(s.pendingRewardRaw.toString()) / 1e18, 0);

    return {
      totalStaked: totalStaked.toFixed(2),
      totalRewards: totalRewards.toFixed(2),
      activeStakesCount: activeStakes.length,
    };
  }, [userStakes]);

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="border-white/10 text-center py-8">
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-[var(--color-text-muted)] mb-4">
            Please connect your wallet to access staking features
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-display font-bold text-white mb-2">Wallet Staking</h1>
        <p className="text-[var(--color-text-muted)]">Earn rewards by staking your tokens</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-text-muted)] text-sm mb-1">Total Staked</p>
              <p className="text-2xl font-bold text-white">{stats.totalStaked} DFI</p>
            </div>
            <Zap className="w-8 h-8 text-[var(--color-primary-light)] opacity-50" />
          </div>
        </Card>

        <Card className="border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-text-muted)] text-sm mb-1">Pending Rewards</p>
              <p className="text-2xl font-bold text-green-300">{stats.totalRewards} DFI</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-400 opacity-50" />
          </div>
        </Card>

        <Card className="border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-text-muted)] text-sm mb-1">Active Stakes</p>
              <p className="text-2xl font-bold text-white">{stats.activeStakesCount}</p>
            </div>
            <DollarSign className="w-8 h-8 text-[var(--color-primary-light)] opacity-50" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'positions'
              ? 'text-[var(--color-primary-light)] border-b-2 border-[var(--color-primary-light)]'
              : 'text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          My Positions
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-6 py-3 font-medium transition ${
            activeTab === 'create'
              ? 'text-[var(--color-primary-light)] border-b-2 border-[var(--color-primary-light)]'
              : 'text-[var(--color-text-muted)] hover:text-white'
          }`}
        >
          Create Stake
        </button>
      </div>

      {/* Content */}
      <div>
        {activeTab === 'positions' ? (
          <div className="space-y-4">
            {poolsError && (
              <Card className="border-red-500/30 bg-red-500/10 p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300">{poolsError}</p>
                </div>
              </Card>
            )}

            {stakingError && (
              <Card className="border-red-500/30 bg-red-500/10 p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300">{stakingError}</p>
                </div>
              </Card>
            )}

            {stakingLoading ? (
              <Card className="border-white/10 p-8 text-center">
                <p className="text-[var(--color-text-muted)]">Loading your stakes...</p>
              </Card>
            ) : userStakes.length === 0 ? (
              <Card className="border-white/10 p-8 text-center">
                <p className="text-[var(--color-text-muted)] mb-4">No active stakes yet</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="inline-block px-6 py-2 bg-[var(--color-primary-light)] text-black rounded-lg font-medium hover:bg-[var(--color-primary-light)]/90 transition"
                >
                  Create Your First Stake
                </button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userStakes.map(stake => (
                  <UserStakePosition
                    key={stake.stakeId}
                    stake={stake}
                    onUnstakeClick={handleUnstake}
                    onClaimClick={handleClaimReward}
                    isLoading={stakeInProgress}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {stakeError && (
              <Card className="border-red-500/30 bg-red-500/10 p-4">
                <div className="flex gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-300">{stakeError}</p>
                </div>
              </Card>
            )}

            {poolsLoading ? (
              <Card className="border-white/10 p-8 text-center">
                <p className="text-[var(--color-text-muted)]">Loading pools...</p>
              </Card>
            ) : (
              <>
                <StakingForm
                  pools={pools}
                  onStake={handleStake}
                  isLoading={stakeInProgress}
                  error={stakeError}
                />

                <div>
                  <h3 className="text-lg font-display font-bold text-white mb-4">Available Pools</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {pools.map(pool => (
                      <StakingPoolCard
                        key={pool.id}
                        pool={pool}
                        onStakeClick={() => setActiveTab('create')}
                        isLoading={stakeInProgress}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
