import React from 'react';
import { VaultStatsPanel } from '../components/vault/VaultStatsPanel';
import { VaultActionPanel } from '../components/vault/VaultActionPanel';
import { useWeb3 } from '../hooks/useWeb3';

export default function VaultPage() {
  const { isConnected, isWrongNetwork, connect } = useWeb3();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">DefiVault</h1>
          <p className="text-gray-500 mt-1">Single-asset Yield Aggregation Vault (ERC-4626). Deposit SKT array to automatically earn yields from multiple strategy pools.</p>
        </div>
      </div>

      {!isConnected ? (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Connect your wallet to use the Vault</h3>
            <p className="text-gray-500 mb-6">Deposit SKT tokens to receive yield-bearing dvSKT shares.</p>
            <button 
                onClick={() => connect()}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
                Connect MetaMask
            </button>
        </div>
      ) : isWrongNetwork ? (
        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
            <div className="flex items-center text-red-800 mb-2">
                <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-medium">Wrong Network</h3>
            </div>
            <p className="text-red-700">Please switch your network to Sepolia Testnet to use the DefiVault.</p>
        </div>
      ) : (
        <>
            <VaultStatsPanel />
            
            <div className="flex flex-col md:flex-row gap-6 items-start justify-center mt-8">
                <VaultActionPanel />
                
                <div className="w-full max-w-md bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-4">How it works</h3>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-start">
                      <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs mr-3 mt-0.5">1</div>
                      <p>Deposit <b>SKT</b> into the Vault.</p>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs mr-3 mt-0.5">2</div>
                      <p>Receive <b>dvSKT</b> (Vault Shares) representing your fraction of the pool.</p>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs mr-3 mt-0.5">3</div>
                      <p>The total SKT in the Vault grows over time as fees/harvest yields are added.</p>
                    </li>
                    <li className="flex items-start">
                      <div className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs mr-3 mt-0.5">4</div>
                      <p>When you redeem dvSKT, you receive more SKT than you deposited!</p>
                    </li>
                  </ul>
                  
                  <div className="mt-6 pt-6 border-t border-gray-200 text-xs text-gray-500">
                    Slippage floor is automatically applied to protect your positions from front-running inflation attacks.
                  </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
}
