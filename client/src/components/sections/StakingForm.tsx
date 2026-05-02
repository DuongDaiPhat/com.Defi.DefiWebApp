import React, { useState, useMemo } from 'react';
import { StakingPool } from '../../types/staking.types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { AlertCircle, Plus } from 'lucide-react';
import { ethers } from 'ethers';

interface StakingFormProps {
  pools: StakingPool[];
  onStake: (poolId: number, amount: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

export function StakingForm({ pools, onStake, isLoading = false, error }: StakingFormProps) {
  const [selectedPoolId, setSelectedPoolId] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedPool = useMemo(
    () => pools.find(p => p.id === selectedPoolId),
    [pools, selectedPoolId]
  );

  const validateInput = (): boolean => {
    setLocalError(null);

    if (!selectedPool) {
      setLocalError('Please select a pool');
      return false;
    }

    if (!amount || parseFloat(amount) === 0) {
      setLocalError('Please enter an amount');
      return false;
    }

    try {
      const amountWei = ethers.parseUnits(amount, 18);

      if (amountWei < selectedPool.minStake) {
        const minAmount = (Number(selectedPool.minStake) / 1e18).toFixed(2);
        setLocalError(`Minimum stake is ${minAmount} DFI`);
        return false;
      }

      if (selectedPool.maxStake > BigInt(0) && amountWei > selectedPool.maxStake) {
        const maxAmount = (Number(selectedPool.maxStake) / 1e18).toFixed(2);
        setLocalError(`Maximum stake is ${maxAmount} DFI`);
        return false;
      }

      return true;
    } catch (err) {
      setLocalError('Invalid amount');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateInput()) {
      return;
    }

    try {
      await onStake(selectedPoolId, amount);
      setAmount('');
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Staking failed';
      setSubmitError(errMsg);
    }
  };

  const currentError = error || localError || submitError;
  const aprPercentage = selectedPool ? Number(selectedPool.apr) / 100 : 0;
  const lockDays = selectedPool ? Math.floor(Number(selectedPool.lockDuration) / 86400) : 0;

  return (
    <Card className="border-white/10">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="flex items-center gap-2">
          <Plus className="w-5 h-5 text-[var(--color-primary-light)]" />
          <h2 className="text-2xl font-display font-bold text-white">New Stake Position</h2>
        </div>

        {/* Pool Selection */}
        <div>
          <label className="block text-sm font-medium text-white mb-3">Select Pool</label>
          <div className="space-y-2">
            {pools.map(pool => (
              <button
                key={pool.id}
                type="button"
                onClick={() => setSelectedPoolId(pool.id)}
                disabled={!pool.isActive}
                className={`w-full p-3 rounded-lg border-2 transition text-left ${
                  selectedPoolId === pool.id
                    ? 'border-[var(--color-primary-light)] bg-[var(--color-primary-light)]/10'
                    : pool.isActive
                    ? 'border-white/10 hover:border-white/20'
                    : 'border-red-500/20 bg-red-500/5 opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white">{pool.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {(Number(pool.apr) / 100).toFixed(1)}% APR • {lockDays === 0 ? 'Flexible' : `${lockDays}d lock`}
                    </p>
                  </div>
                  {!pool.isActive && (
                    <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">Inactive</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-white mb-2">
            Amount to Stake
          </label>
          <div className="relative">
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.0"
              min="0"
              step="0.01"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-primary-light)] disabled:opacity-50"
            />
            <span className="absolute right-4 top-3 text-white/50 text-sm">DFI</span>
          </div>
          {selectedPool && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Min: {(Number(selectedPool.minStake) / 1e18).toFixed(2)} DFI
              {selectedPool.maxStake > BigInt(0) && ` • Max: ${(Number(selectedPool.maxStake) / 1e18).toFixed(2)} DFI`}
            </p>
          )}
        </div>

        {/* Pool Info Preview */}
        {selectedPool && (
          <div className="bg-white/5 p-4 rounded-lg border border-white/10 space-y-3">
            <h3 className="font-medium text-white mb-3">Pool Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[var(--color-text-muted)] mb-1">APR</p>
                <p className="font-bold text-white">{aprPercentage.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)] mb-1">Lock Period</p>
                <p className="font-bold text-white">{lockDays === 0 ? 'Flexible' : `${lockDays} days`}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)] mb-1">Early Withdrawal Fee</p>
                <p className="font-bold text-white">{(Number(selectedPool.penaltyRate) / 100).toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)] mb-1">Pool TVL</p>
                <p className="font-bold text-white">{(Number(selectedPool.totalStaked) / 1e18).toFixed(2)} DFI</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {currentError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{currentError}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading || !selectedPool || !amount}
          className="w-full"
        >
          {isLoading ? 'Processing...' : 'Confirm Stake'}
        </Button>

        {/* Info Note */}
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Make sure you have sufficient token balance and have approved the contract
        </p>
      </form>
    </Card>
  );
}
