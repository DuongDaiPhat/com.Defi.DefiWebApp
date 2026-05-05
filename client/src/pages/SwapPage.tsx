import { useState, useEffect } from 'react';
import { useWeb3 } from '../hooks/useWeb3';
import { useSimpleAMM } from '../hooks/useSimpleAMM';
import { ethers } from 'ethers';
import { formatWei } from '../lib/formatters';

export default function SwapPage() {
  const { isConnected, connect, tokenBalance, balance: ethBalance } = useWeb3();
  const { ammInfo, fetchAMMInfo, getQuote, swap, isLoading } = useSimpleAMM();
  const [amountIn, setAmountIn] = useState('');
  const [estimatedOut, setEstimatedOut] = useState('0');
  const [direction, setDirection] = useState<'eth_to_skt' | 'skt_to_eth'>('eth_to_skt');
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    fetchAMMInfo();
  }, [fetchAMMInfo]);

  useEffect(() => {
    const fetchQuote = async () => {
      if (!amountIn || parseFloat(amountIn) <= 0) {
        setEstimatedOut('0');
        return;
      }
      try {
        const quote = await getQuote(ethers.parseEther(amountIn).toString(), direction);
        setEstimatedOut(ethers.formatEther(quote));
        setError(null);
      } catch (err: any) {
        setEstimatedOut('0');
        setError("Slippage or Liquidity Error: Insufficient Reserves");
      }
    };
    
    const timeout = setTimeout(fetchQuote, 500); // debounce API call
    return () => clearTimeout(timeout);
  }, [amountIn, direction, getQuote]);

  const handleSwap = async () => {
    if (!amountIn) return;
    setError(null);
    try {
      const minOut = parseFloat(estimatedOut) * 0.99; // 1% manual slippage from UI
      await swap(
        ethers.parseEther(amountIn).toString(), 
        ethers.parseEther(minOut.toString()).toString(), 
        direction === 'eth_to_skt'
      );
      setAmountIn('');
      alert("Swap successful");
    } catch (err: any) {
      setError(err.message || "Swap failed");
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <h2 className="text-2xl font-bold mb-4">Simple AMM Swap</h2>
        <p className="text-gray-500 mb-6">Connect your wallet to swap SKT &lt;-&gt; ETH</p>
        <button onClick={() => connect()} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Connect Wallet</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Token Swap</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        
        {/* Switch Direction */}
        <div className="flex justify-between items-center mb-6 bg-gray-50 p-1 rounded-lg">
          <button 
            className={`flex-1 py-2 font-medium rounded text-sm ${direction === 'eth_to_skt' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            onClick={() => {setDirection('eth_to_skt'); setAmountIn('');}}
          >
            Buy SKT (ETH → SKT)
          </button>
          <button 
            className={`flex-1 py-2 font-medium rounded text-sm ${direction === 'skt_to_eth' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            onClick={() => {setDirection('skt_to_eth'); setAmountIn('');}}
          >
            Sell SKT (SKT → ETH)
          </button>
        </div>

        {/* Input */}
        <div className="mb-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>You pay</span>
            <span>Balance: {direction === 'eth_to_skt' ? ethBalance : tokenBalance}</span>
          </div>
          <div className="flex gap-4 items-center">
            <input 
              type="number"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
              placeholder="0.0"
              className="bg-transparent w-full text-2xl outline-none text-black"
              disabled={isLoading}
            />
            <span className="font-semibold">{direction === 'eth_to_skt' ? 'ETH' : 'SKT'}</span>
          </div>
        </div>

        {/* Output */}
        <div className="mb-6 bg-blue-50 rounded-lg p-4 border border-blue-100">
          <div className="flex justify-between text-xs text-blue-600 mb-2">
            <span>You receive (Estimated)</span>
            <span>Balance: {direction === 'eth_to_skt' ? tokenBalance : ethBalance}</span>
          </div>
          <div className="flex gap-4 items-center">
            <input 
              type="text"
              value={estimatedOut}
              className="bg-transparent w-full text-2xl outline-none text-black"
              readOnly
            />
            <span className="font-semibold text-blue-700">{direction === 'eth_to_skt' ? 'SKT' : 'ETH'}</span>
          </div>
        </div>

        {/* Info */}
        <div className="flex justify-between text-sm text-gray-500 mb-6 px-1">
          <span>Pool Exchange Rate</span>
          <span>{ammInfo ? formatWei(ammInfo.priceRatio, 6) : '--'}</span>
        </div>

        {error && <div className="text-red-500 mb-4 text-sm text-center">{error}</div>}

        <button 
          onClick={handleSwap}
          disabled={isLoading || !amountIn || estimatedOut === '0' || error !== null}
          className="w-full bg-blue-600 text-white rounded-lg py-4 font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Processing...' : 'Confirm Swap'}
        </button>

      </div>
    </div>
  );
}
