import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CreditCard, Banknote, Building2, ChevronDown, Check } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';

interface BuySellModuleProps {
  mode: 'buy' | 'sell';
}

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit Card', icon: CreditCard, fee: '2.5%' },
  { id: 'bank', label: 'Bank Transfer', icon: Building2, fee: '0.5%' },
  { id: 'cash', label: 'Cash Balance', icon: Banknote, fee: '0%' },
];

const CURRENCIES = ['USD', 'EUR', 'VND', 'GBP'];

export function BuySellModule({ mode }: BuySellModuleProps) {
  const [amount, setAmount] = useState('100');
  const [currency, setCurrency] = useState('USD');
  const [selectedPayment, setSelectedPayment] = useState('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsDropdownOpen(false));

  const isBuy = mode === 'buy';
  const mockRate = 1800.50;
  const numericAmount = parseFloat(amount) || 0;
  const estimatedCrypto = isBuy
    ? (numericAmount / mockRate).toFixed(6)
    : (numericAmount * mockRate).toFixed(2);

  const selectedMethod = PAYMENT_METHODS.find(p => p.id === selectedPayment);

  const handleSubmit = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsProcessing(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card className="border-white/10">
        <h2 className="text-2xl font-display font-bold text-white mb-6">
          {isBuy ? 'Buy Crypto' : 'Sell Crypto'}
        </h2>

        {/* Amount */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-4 overflow-visible relative">
          <p className="text-sm text-[var(--color-text-muted)] mb-2">
            {isBuy ? 'You pay' : 'You sell'}
          </p>
          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="bg-transparent text-3xl font-bold text-black outline-none min-w-0 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.0"
            />
            {isBuy ? (
              <div className="shrink-0 relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-semibold transition-all hover:bg-white/10 hover:border-white/20"
                >
                  <span className="text-[var(--color-primary-light)]">{currency}</span>
                  <motion.div
                    animate={{ rotate: isDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {isDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                      className="absolute right-0 top-full mt-2 w-32 bg-[#18181b] border border-white/10 rounded-xl shadow-2xl p-1 z-50 overflow-hidden"
                    >
                      {CURRENCIES.map(c => (
                        <button
                          key={c}
                          onClick={() => {
                            setCurrency(c);
                            setIsDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            currency === c
                              ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-light)]'
                              : 'text-[var(--color-text-muted)] hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {c}
                          {currency === c && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="shrink-0 flex items-center gap-2 bg-[#627EEA]/20 rounded-xl px-3 py-2 border border-[#627EEA]/30">
                <div className="w-6 h-6 rounded-full bg-[#627EEA] flex items-center justify-center text-xs font-bold text-white">Ξ</div>
                <span className="font-semibold text-white">ETH</span>
              </div>
            )}
          </div>
        </div>

        {/* You receive */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-6 overflow-hidden">
          <p className="text-sm text-[var(--color-text-muted)] mb-2">You receive (estimated)</p>
          <div className="flex items-center justify-between gap-3">
            <span className="text-3xl font-bold text-white min-w-0 truncate">{estimatedCrypto}</span>
            <div className="shrink-0 flex items-center gap-2 bg-[#627EEA]/20 rounded-xl px-3 py-2 border border-[#627EEA]/30">
              <div className="w-6 h-6 rounded-full bg-[#627EEA] flex items-center justify-center text-xs font-bold text-white">Ξ</div>
              <span className="font-semibold text-white">{isBuy ? 'ETH' : currency}</span>
            </div>
          </div>
        </div>

        {/* Payment Method (buy only) */}
        {isBuy && (
          <div className="mb-6">
            <p className="text-sm text-[var(--color-text-muted)] mb-3">Payment Method</p>
            <div className="space-y-2">
              {PAYMENT_METHODS.map(method => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      selectedPayment === method.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                        : 'border-white/5 hover:border-white/20 bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${selectedPayment === method.id ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-text-muted)]'}`} />
                      <span className="font-medium text-white text-sm">{method.label}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">Fee: {method.fee}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="space-y-2 mb-6 text-sm">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Rate</span>
            <span className="text-white">1 ETH ≈ {mockRate.toLocaleString()} {currency}</span>
          </div>
          {isBuy && selectedMethod && (
            <div className="flex justify-between text-[var(--color-text-muted)]">
              <span>Processing Fee</span>
              <span className="text-white">{selectedMethod.fee}</span>
            </div>
          )}
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Network</span>
            <span className="text-white">Sepolia Testnet</span>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          isLoading={isProcessing}
          disabled={numericAmount <= 0}
          className="w-full h-14 text-lg shadow-[var(--glow-gold)]"
        >
          {numericAmount <= 0 ? 'Enter an amount' : isBuy ? `Buy ETH` : `Sell ETH`}
        </Button>
      </Card>
    </div>
  );
}
