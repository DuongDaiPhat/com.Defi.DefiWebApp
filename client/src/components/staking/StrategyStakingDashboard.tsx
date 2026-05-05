import { useState } from 'react';
import { useStakingStrategy } from '../../hooks/useStakingStrategy';
import { formatNumber } from '../../lib/formatters';
import { validateStake } from '../../lib/validation';
import { useWeb3 } from '../../hooks/useWeb3';
import { ethers } from 'ethers';

export function StrategyStakingDashboard({ pool }: { pool: any }) {
  const { isConnected, chainId, tokenBalance } = useWeb3();
  const { stake, isLoading } = useStakingStrategy();
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStake = async () => {
    setError(null);
    const validation = validateStake({
      isConnected,
      chainId,
      pool,
      amount,
      userSktBalance: BigInt(tokenBalance.replace(/,/g, '').split('.')[0] || '0') * BigInt(10**18) // Estimate Wei
    });
    
    if (!validation.ok) {
      setError(validation.message || 'Validation failed');
      return;
    }

    try {
      // Pass amount in Wei
      const weiAmount = ethers.parseUnits(amount, 18).toString();
      await stake(pool.poolId, weiAmount);
      setAmount('');
      alert("Staked successfully!");
    } catch (err: any) {
      setError(err.message || 'Stake failed');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{pool.name}</h3>
          <p className="text-sm text-gray-500">Lock: {pool.lockDuration / 86400} Days</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-green-600">Dynamic Yield</div>
          <p className="text-xs text-gray-500">Penalty: {pool.penaltyRate / 100}%</p>
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600 bg-gray-50 p-3 rounded">
        <div>Total Staked in Pool: {formatNumber(pool.totalStaked)} SKT</div>
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="flex gap-2">
        <input 
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError(null); }}
          placeholder="Amount SKT to stake"
          className="flex-1 px-4 py-2 border rounded focus:ring-blue-500 focus:border-blue-500 text-black"
          disabled={isLoading || !pool.isActive}
        />
        <button 
          onClick={handleStake}
          disabled={isLoading || !pool.isActive || !amount}
          className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Staking...' : 'Stake'}
        </button>
      </div>
    </div>
  );
}
