import React, { useState } from 'react';
import { useStakingStrategy } from '../../hooks/useStakingStrategy';
import { UserStrategyStake } from '../../types/strategy.types';
import { formatNumber } from '../../lib/formatters';

export function StrategyStakePosition({ position }: { position: UserStrategyStake }) {
  const { unstake, emergencyWithdraw, isLoading } = useStakingStrategy();
  const [showPenaltyWarning, setShowPenaltyWarning] = useState(false);

  const handleUnstake = async () => {
    try {
      await unstake(position.stakeId);
      alert("Unstaked successfully! Yield and Principal returned.");
    } catch (err) {
      alert("Unstake failed. See console.");
    }
  };

  const handleEmergency = async () => {
    try {
      await emergencyWithdraw(position.stakeId);
      alert("Emergency withdrawal successful.");
      setShowPenaltyWarning(false);
    } catch (err) {
      alert("Emergency withdrawal failed.");
    }
  };

  return (
    <div className="bg-white border rounded-lg p-5 shadow-sm relative">
      {position.status !== 'ACTIVE' && (
        <div className="absolute inset-0 bg-gray-50 bg-opacity-70 flex items-center justify-center rounded-lg z-10 backdrop-blur-[1px]">
           <span className="font-bold text-gray-400 transform rotate-12 text-3xl">
              {position.status}
           </span>
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded">Pool #{position.poolId}</span>
        {position.isLocked ? (
          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded">Locked ({position.lockRemainingSeconds}s left)</span>
        ) : (
          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Unlocked</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <div className="text-sm text-gray-500">Principal</div>
          <div className="font-semibold text-gray-800">{formatNumber(position.assetsAtStake)} SKT</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Pending Yield</div>
          <div className="font-bold text-green-600">+{formatNumber(position.pendingYield)} SKT</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Current Vault Shares</div>
          <div className="text-sm text-gray-700">{formatNumber(position.sharesReceived)} dvSKT</div>
        </div>
        <div>
          <div className="text-sm text-gray-500">Current Value</div>
          <div className="font-semibold text-indigo-600">{formatNumber(position.currentValue)} SKT</div>
        </div>
      </div>

      {position.status === 'ACTIVE' && (
        <div className="flex gap-2 mt-4 border-t pt-4">
          <button 
            onClick={handleUnstake}
            disabled={isLoading || position.isLocked}
            className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Unstake & Claim
          </button>
          
          <button 
            onClick={() => setShowPenaltyWarning(true)}
            disabled={isLoading || !position.isLocked}
            className="flex-1 border border-red-500 text-red-600 rounded py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            Emergency Withdraw
          </button>
        </div>
      )}

      {/* Penalty Warning Modal */}
      {showPenaltyWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full m-4">
            <h4 className="text-lg font-bold text-red-600 mb-2">Emergency Withdrawal</h4>
            <p className="text-sm text-gray-600 mb-4">
              You are withdrawing before the lock period expires. You will <b>lose all pending yield</b> and pay a <b>penalty fee</b> on your principal.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowPenaltyWarning(false)}
                className="flex-1 border rounded py-2 text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleEmergency}
                disabled={isLoading}
                className="flex-1 bg-red-600 text-white rounded py-2 hover:bg-red-700 disabled:opacity-50"
              >
                {isLoading ? 'Processing...' : 'Confirm Penalty'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
