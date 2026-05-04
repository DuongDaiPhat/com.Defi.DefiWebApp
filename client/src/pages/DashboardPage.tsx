import React from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { useWeb3 } from '../hooks/useWeb3';
import { formatNumber } from '../lib/formatters';
import { NavLink } from 'react-router-dom';

export default function DashboardPage() {
  const { isConnected, connect } = useWeb3();
  const { stats, isLoading } = useDashboard();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">DeFi Dashboard</h2>
        <p className="text-gray-500 mb-6">Connect your wallet to view your unified DeFi portfolio overview.</p>
        <button onClick={() => connect()} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Unified Portfolio</h1>

      {isLoading && !stats ? (
        <div className="animate-pulse text-gray-500">Loading your data...</div>
      ) : stats ? (
        <div className="space-y-8">
          
          {/* Top Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 border border-gray-100 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500 font-medium mb-2">Total Estimated Balance (USD)</h3>
              <div className="text-3xl font-bold text-gray-900">${formatNumber(stats.totalBalanceUSD)}</div>
              <p className="text-xs text-gray-400 mt-2">Valuation at 1 SKT = $0.10</p>
            </div>
            
            <div className="bg-white p-6 border border-gray-100 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500 font-medium mb-2">Total Yield Earned (USD)</h3>
              <div className="text-3xl font-bold text-green-600">+${formatNumber(stats.yieldEarnedUSD)}</div>
              <p className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded inline-block mt-2">Yield is Automatically Compounded</p>
            </div>
            
            <div className="bg-white p-6 border border-gray-100 rounded-lg shadow-sm">
              <h3 className="text-sm text-gray-500 font-medium mb-2">Wallet SKT Balance</h3>
              <div className="text-3xl font-bold text-gray-900">{formatNumber(stats.sktTokenBalance)} <span className="text-sm text-gray-500">SKT</span></div>
              <div className="mt-3">
                <NavLink to="/swap" className="text-blue-600 text-sm hover:underline">Get more SKT Token &rarr;</NavLink>
              </div>
            </div>
          </div>

          {/* Connected Modules Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* DefiVault Box */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">DefiVault Allocation</h3>
                <span className={`px-2 py-1 text-xs rounded font-medium ${stats.vaultStatus.paused ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {stats.vaultStatus.paused ? 'PAUSED' : 'ACTIVE'}
                </span>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-500">Global TVL</span>
                  <span className="font-semibold">{formatNumber(stats.vaultStatus.totalAssets)} SKT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Share Price</span>
                  <span className="font-semibold text-blue-600">1 dvSKT = {parseFloat(stats.vaultStatus.pricePerShare).toFixed(4)} SKT</span>
                </div>
              </div>
              <NavLink to="/vault" className="block w-full text-center bg-white border border-gray-300 rounded py-2 text-gray-700 font-medium hover:bg-gray-100">
                Manage Vault Shares
              </NavLink>
            </div>

            {/* Strategy Box */}
            <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Direct Strategy Allocation</h3>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                   <span className="text-gray-500">Active Locked Stakes</span>
                   <span className="font-semibold">{stats.activeStakesCount}</span>
                </div>
              </div>
              <NavLink to="/stake" className="block w-full text-center bg-white border border-gray-300 rounded py-2 text-gray-700 font-medium hover:bg-gray-100">
                Manage Pool Stakes
              </NavLink>
            </div>
            
          </div>
        </div>
      ) : null}
    </div>
  );
}
