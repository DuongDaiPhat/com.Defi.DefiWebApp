import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ArrowDownUp, Settings, Fuel } from 'lucide-react';
import type { Token, Transaction } from '../../hooks/useDashboardMock';

interface SwapModuleProps {
  tokens: Token[];
  exchangeRate: number;
  gasEstimate: number;
  slippage: number;
  setSlippage: (v: number) => void;
  isSwapping: boolean;
  performSwap: (amount: number) => Promise<void>;
  transactions: Transaction[];
}

const SLIPPAGE_OPTIONS = [0.5, 1, 3];

export function SwapModule({ tokens, exchangeRate, gasEstimate, slippage, setSlippage, isSwapping, performSwap, transactions }: SwapModuleProps) {
  const [inputAmount, setInputAmount] = useState('1.0');
  const [showSettings, setShowSettings] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const numericInput = parseFloat(inputAmount) || 0;
  
  // Base rate is 1 ETH = X WDFI
  // If flipped, 1 WDFI = (1 / exchangeRate) ETH
  const effectiveRate = isFlipped ? (1 / exchangeRate) : exchangeRate;
  const outputAmount = (numericInput * effectiveRate).toFixed(isFlipped ? 6 : 2);
  
  const eth = tokens.find(t => t.symbol === 'ETH');
  const wdfi = tokens.find(t => t.symbol === 'WDFI');

  const fromToken = isFlipped ? wdfi : eth;
  const toToken = isFlipped ? eth : wdfi;
  
  const fromSymbol = isFlipped ? 'WDFI' : 'ETH';
  const toSymbol = isFlipped ? 'ETH' : 'WDFI';

  const recentSwaps = transactions.filter(tx => tx.type === 'Swap').slice(0, 5);

  const handleSwap = () => {
    if (numericInput > 0) performSwap(numericInput);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card className="border-white/10 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-display font-bold text-white">Swap</h2>
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="text-[var(--color-text-muted)] hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Slippage Settings */}
        {showSettings && (
          <div className="mb-6 bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5">
            <p className="text-sm text-[var(--color-text-muted)] mb-3">Slippage Tolerance</p>
            <div className="flex gap-2">
              {SLIPPAGE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setSlippage(opt)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    slippage === opt
                      ? 'bg-[var(--color-primary)] text-slate-950'
                      : 'bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {opt}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* From Token */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-2 overflow-hidden">
          <div className="flex justify-between text-sm mb-2 text-[var(--color-text-muted)]">
            <span>You pay</span>
            <span>Balance: {fromToken?.balance.toLocaleString(undefined, { maximumFractionDigits: 3 })} {fromSymbol}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="bg-transparent text-3xl font-bold text-white outline-none min-w-0 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.0"
            />
            <div className={`shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 border ${isFlipped ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)]/30' : 'bg-[#627EEA]/20 border-[#627EEA]/30'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${isFlipped ? 'bg-[var(--color-primary)]' : 'bg-[#627EEA]'}`}>
                {isFlipped ? 'W' : 'Ξ'}
              </div>
              <span className="font-semibold text-white">{fromSymbol}</span>
            </div>
          </div>
        </div>

        {/* Switch */}
        <div className="flex justify-center -my-3 relative z-10">
          <button 
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-10 h-10 bg-[var(--color-bg-elevated)] rounded-xl flex items-center justify-center border border-white/10 hover:border-white/30 cursor-pointer hover:text-[var(--color-primary-light)] transition-all shadow-lg active:scale-95"
          >
            <motion.div
              animate={{ rotate: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <ArrowDownUp className="w-5 h-5 flex-shrink-0" />
            </motion.div>
          </button>
        </div>

        {/* To Token */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mt-2 mb-6 overflow-hidden">
          <div className="flex justify-between text-sm mb-2 text-[var(--color-text-muted)]">
            <span>You receive</span>
            <span>Balance: {toToken?.balance.toLocaleString(undefined, { maximumFractionDigits: 3 })} {toSymbol}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-3xl font-bold text-white min-w-0 truncate">{outputAmount}</span>
            <div className={`shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 border ${!isFlipped ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)]/30' : 'bg-[#627EEA]/20 border-[#627EEA]/30'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${!isFlipped ? 'bg-[var(--color-primary)]' : 'bg-[#627EEA]'}`}>
                {!isFlipped ? 'W' : 'Ξ'}
              </div>
              <span className="font-semibold text-white">{toSymbol}</span>
            </div>
          </div>
        </div>

        {/* Info Row */}
        <div className="space-y-2 mb-6 text-sm">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Rate</span>
            <span className="text-white">1 {fromSymbol} = {effectiveRate.toLocaleString(undefined, { maximumFractionDigits: 6 })} {toSymbol}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1"><Fuel className="w-3 h-3" /> Est. Gas</span>
            <span className="text-white">{gasEstimate} ETH</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Slippage</span>
            <span className="text-white">{slippage}%</span>
          </div>
        </div>

        {/* Swap Button */}
        <Button 
          onClick={handleSwap} 
          isLoading={isSwapping} 
          disabled={numericInput <= 0}
          className="w-full h-14 text-lg shadow-[var(--glow-gold)]"
        >
          {numericInput <= 0 ? 'Enter an amount' : 'Swap'}
        </Button>
      </Card>

      {/* Recent Swaps */}
      {recentSwaps.length > 0 && (
        <Card className="border-white/10">
          <h4 className="text-sm font-semibold text-white mb-4">Recent Swaps</h4>
          <div className="space-y-2">
            {recentSwaps.map(tx => (
              <div key={tx.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <div>
                  <span className="text-white">{tx.from}</span>
                  <span className="text-[var(--color-text-muted)] mx-2">→</span>
                  <span className="text-[var(--color-primary-light)]">{tx.to}</span>
                </div>
                <Badge variant={tx.status === 'Success' ? 'success' : tx.status === 'Failed' ? 'warning' : 'outline'}>
                  {tx.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
