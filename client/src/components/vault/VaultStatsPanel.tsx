import React, { useEffect } from 'react';
import { useDefiVault } from '../../hooks/useDefiVault';
import { formatNumber } from '../../lib/formatters';

export function VaultStatsPanel() {
  const { vaultInfo, fetchVaultInfo } = useDefiVault();

  useEffect(() => {
    fetchVaultInfo();
    const interval = setInterval(fetchVaultInfo, 20000); // 20s polling
    return () => clearInterval(interval);
  }, [fetchVaultInfo]);

  if (!vaultInfo) return <div className="text-gray-500 animate-pulse">Loading vault data...</div>;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
        <h3 className="font-semibold text-gray-800">DefiVault (ERC-4626) Overview</h3>
        {vaultInfo.paused ? (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">PAUSED</span>
        ) : (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">ACTIVE</span>
        )}
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
        <div>
          <p className="text-sm text-gray-500 mb-1">Total Assets (TVL)</p>
          <div className="text-2xl font-bold text-gray-900">{formatNumber(vaultInfo.totalAssets)} <span className="text-sm text-gray-500 font-normal">SKT</span></div>
        </div>
        
        <div>
          <p className="text-sm text-gray-500 mb-1">Total Shares Minted</p>
          <div className="text-2xl font-bold text-blue-600">{formatNumber(vaultInfo.totalSupply)} <span className="text-sm text-gray-500 font-normal">dvSKT</span></div>
        </div>
        
        <div>
          <p className="text-sm text-gray-500 mb-1">Price Per Share</p>
          <div className="text-xl font-semibold text-gray-800">1 dvSKT = {parseFloat(vaultInfo.pricePerShare).toFixed(4)} SKT</div>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Your Position</p>
          <div className="text-xl font-semibold text-indigo-600">{formatNumber(vaultInfo.userAssetValue || '0')} SKT</div>
          <p className="text-xs text-gray-400">({formatNumber(vaultInfo.userShares || '0')} shares)</p>
        </div>
      </div>
    </div>
  );
}
