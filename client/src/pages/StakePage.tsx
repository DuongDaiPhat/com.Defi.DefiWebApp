import React, { useEffect } from 'react';
import { useStakingStrategy } from '../hooks/useStakingStrategy';
import { useWeb3 } from '../hooks/useWeb3';
import { StrategyStakingDashboard } from '../components/staking/StrategyStakingDashboard';
import { StrategyStakePosition } from '../components/staking/StrategyStakePosition';
import { formatNumber } from '../lib/formatters';

export default function StakePage() {
  const { isConnected, connect } = useWeb3();
  const { pools, userStakes, stats, isLoading, fetchStrategyData } = useStakingStrategy();

  useEffect(() => {
    fetchStrategyData();
    const interval = setInterval(fetchStrategyData, 20000); // 20s polling
    return () => clearInterval(interval);
  }, [fetchStrategyData]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-2xl font-bold mb-4">Staking Strategy</h2>
        <p className="text-gray-500 mb-6 text-center max-w-md">Connect your wallet to participate in Staking Strategies natively on-chain or view your active positions.</p>
        <button onClick={() => connect()} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Direct Staking Pools</h1>
          <p className="text-gray-500 mt-1">Stake SKT directly into individual strategy pools.</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <div>
             <p className="text-sm text-gray-500 mb-1">Total Vault Allocation</p>
             <p className="text-xl font-bold">{formatNumber(stats.totalDeployedToVault)} <span className="text-sm font-normal text-gray-500">SKT</span></p>
          </div>
          <div>
             <p className="text-sm text-gray-500 mb-1">Total Harvested Yield</p>
             <p className="text-xl font-bold text-green-600">+{formatNumber(stats.totalHarvested)} <span className="text-sm font-normal text-gray-500">SKT</span></p>
          </div>
          <div>
             <p className="text-sm text-gray-500 mb-1">Current Price Per Share</p>
             <p className="text-xl font-bold">1 dvSKT = {parseFloat(stats.pricePerShare).toFixed(4)} <span className="text-sm font-normal text-gray-500">SKT</span></p>
          </div>
          <div>
             <p className="text-sm text-gray-500 mb-1">Penalties Collected</p>
             <p className="text-xl font-bold text-red-500">{formatNumber(stats.totalPenalties)} <span className="text-sm font-normal text-gray-500">SKT</span></p>
          </div>
        </div>
      )}

      {userStakes.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">My Stable Positions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userStakes.map(stake => (
              <StrategyStakePosition key={stake.stakeId} position={stake} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Available Strategy Pools</h2>
        {isLoading && pools.length === 0 ? (
          <div className="text-center py-8 text-gray-500 animate-pulse">Loading pools...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pools.map(pool => (
              <StrategyStakingDashboard key={pool.poolId} pool={pool} />
            ))}
          </div>
        )}
      </div>
      
    </div>
  );
}
