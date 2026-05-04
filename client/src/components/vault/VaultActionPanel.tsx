import React, { useState } from 'react';
import { useDefiVault } from '../../hooks/useDefiVault';
import { formatDecimal, parseDecimal } from '../../lib/formatters';
import { validateVaultInput } from '../../lib/validation';

export function VaultActionPanel() {
  const { vaultInfo, deposit, redeem, isLoading } = useDefiVault();
  const [activeTab, setActiveTab] = useState<'DEPOSIT' | 'REDEEM'>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const pricePerShareNum = parseFloat(vaultInfo?.pricePerShare || '1.0');

  const getEstimatedReceived = () => {
    if (!amount || isNaN(parseFloat(amount))) return '0.0000';
    const num = parseFloat(amount);
    if (activeTab === 'DEPOSIT') {
      return (num / pricePerShareNum).toFixed(4); // approx shares
    } else {
      return (num * pricePerShareNum).toFixed(4); // approx assets
    }
  };

  const calculateSlippageMin = (estimated: string, isDeposit: boolean) => {
    const estNum = parseFloat(estimated);
    // Slippage 1% (Floor rounding protection vs inflation attack)
    return Math.floor(estNum * 0.99 * 1e18).toString(); 
  };

  const handleAction = async () => {
    setError(null);
    const balance = activeTab === 'DEPOSIT' 
      ? '999999999999' // TODO: Get max SKT wallet balance from tokenBalance
      : vaultInfo?.userShares || '0';

    const validation = validateVaultInput(
      amount,
      balance,
      pricePerShareNum,
      activeTab
    );

    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    try {
      const estimated = getEstimatedReceived();
      if (activeTab === 'DEPOSIT') {
        await deposit({
          amount: ethers.parseUnits(amount, 18).toString(),
          minShares: calculateSlippageMin(estimated, true)
        });
      } else {
        await redeem({
          shares: ethers.parseUnits(amount, 18).toString(),
          minAssets: calculateSlippageMin(estimated, false)
        });
      }
      setAmount('');
      alert(`${activeTab} successful!`);
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm w-full max-w-md">
      <div className="flex bg-gray-100 p-1 rounded-md mb-6">
        <button 
          className={`flex-1 py-2 text-sm font-medium rounded ${activeTab === 'DEPOSIT' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('DEPOSIT')}
        >
          Deposit SKT
        </button>
        <button 
          className={`flex-1 py-2 text-sm font-medium rounded ${activeTab === 'REDEEM' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('REDEEM')}
        >
          Redeem Shares
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount ({activeTab === 'DEPOSIT' ? 'SKT' : 'dvSKT'})
          </label>
          <div className="relative">
            <input 
              type="number" 
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-lg"
              placeholder="0.0"
              disabled={isLoading || vaultInfo?.paused}
            />
          </div>
        </div>

        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}

        <div className="bg-blue-50 p-3 rounded text-sm text-blue-800 space-y-1">
          <div className="flex justify-between">
            <span>Exchange Rate</span>
            <span className="font-medium">1 dvSKT = {formatDecimal(vaultInfo?.pricePerShare || '0')} SKT</span>
          </div>
          <div className="flex justify-between">
            <span>Estimated Received</span>
            <span className="font-medium">{getEstimatedReceived()} {activeTab === 'DEPOSIT' ? 'dvSKT' : 'SKT'}</span>
          </div>
          <div className="flex justify-between text-xs text-blue-600">
            <span>Min Receive (1% slippage limit)</span>
            <span>Protected</span>
          </div>
        </div>

        <button 
          onClick={handleAction}
          disabled={isLoading || vaultInfo?.paused || !amount}
          className={`w-full py-3 rounded-lg text-white font-medium ${
            vaultInfo?.paused 
              ? 'bg-red-400 cursor-not-allowed'
              : isLoading || !amount
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 shadow-md transform transition hover:-translate-y-0.5'
          }`}
        >
          {vaultInfo?.paused ? 'Vault Paused' : isLoading ? 'Processing...' : activeTab}
        </button>
      </div>
    </div>
  );
}
