import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Clock, ArrowRightLeft, TrendingUp } from 'lucide-react';

const EXPIRY_OPTIONS = ['1h', '24h', '7d', '30d'];

export function LimitOrderModule() {
  const [price, setPrice] = useState('1800');
  const [amount, setAmount] = useState('1.0');
  const [expiry, setExpiry] = useState('24h');
  const [isPlacing, setIsPlacing] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);

  const total = (parseFloat(price) * parseFloat(amount) || 0).toFixed(6);

  const baseToken = isFlipped ? 'WDFI' : 'ETH';
  const quoteToken = isFlipped ? 'ETH' : 'WDFI';

  const handlePlace = async () => {
    setIsPlacing(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsPlacing(false);
  };

  // Mock open orders
  const openOrders = [
    { id: 1, pair: 'ETH/WDFI', type: 'Buy', price: '1750.00', amount: '0.5', filled: '40%', expiry: '23h left' },
    { id: 2, pair: 'ETH/WDFI', type: 'Sell', price: '1900.00', amount: '1.0', filled: '0%', expiry: '6d left' },
    { id: 3, pair: 'WDFI/ETH', type: 'Buy', price: '0.00055', amount: '500', filled: '100%', expiry: 'Filled' },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card className="border-white/10">
        <h2 className="text-2xl font-display font-bold text-white mb-6">Limit Order</h2>

        {/* Token Pair */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-4 overflow-hidden">
          <p className="text-sm text-[var(--color-text-muted)] mb-3">Token Pair</p>
          <div className="flex items-center justify-between px-2">
            <div className={`flex items-center gap-2 transition-all w-28 ${isFlipped ? 'order-3 justify-end' : 'order-1 justify-start'}`}>
              <div className="w-7 h-7 rounded-full bg-[#627EEA] flex items-center justify-center text-xs font-bold text-white shrink-0">Ξ</div>
              <span className="font-semibold text-white text-lg">ETH</span>
            </div>
            
            <button 
              onClick={() => setIsFlipped(!isFlipped)}
              className="order-2 w-10 h-10 shrink-0 bg-[var(--color-bg-elevated)] rounded-xl flex items-center justify-center border border-white/10 hover:border-white/30 cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-primary-light)] transition-all shadow-lg active:scale-95 mx-4"
            >
              <motion.div animate={{ rotate: isFlipped ? 180 : 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <ArrowRightLeft className="w-5 h-5 flex-shrink-0" />
              </motion.div>
            </button>

            <div className={`flex items-center gap-2 transition-all w-28 ${isFlipped ? 'order-1 justify-start' : 'order-3 justify-end'}`}>
              <div className="w-7 h-7 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-xs font-bold text-white shrink-0">W</div>
              <span className="font-semibold text-white text-lg">WDFI</span>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-4 overflow-hidden group hover:border-[var(--color-primary)]/30 transition-colors">
          <div className="flex justify-between text-sm mb-3 text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Limit Price ({quoteToken} per {baseToken})</span>
            <span className="text-[var(--color-primary-light)] font-medium">Market: {isFlipped ? '0.00055' : '1,800.50'}</span>
          </div>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            className="bg-transparent text-3xl font-bold text-black outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0.0"
          />
        </div>

        {/* Amount */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-4 overflow-hidden">
          <p className="text-sm text-[var(--color-text-muted)] mb-3">Amount ({baseToken})</p>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="bg-transparent text-3xl font-bold text-black outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0.0"
          />
        </div>

        {/* Expiry */}
        <div className="mb-6">
          <p className="text-sm text-[var(--color-text-muted)] mb-3 flex items-center gap-1"><Clock className="w-3 h-3" /> Expires in</p>
          <div className="flex gap-2">
            {EXPIRY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setExpiry(opt)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  expiry === opt
                    ? 'bg-[var(--color-primary)] text-slate-950'
                    : 'bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="flex justify-between text-sm mb-6 text-[var(--color-text-muted)]">
          <span>Total</span>
          <span className="text-white font-semibold">{total} {quoteToken}</span>
        </div>

        <Button
          onClick={handlePlace}
          isLoading={isPlacing}
          disabled={!parseFloat(amount) || !parseFloat(price)}
          className="w-full h-14 text-lg shadow-[var(--glow-gold)]"
        >
          Place Limit Order
        </Button>
      </Card>

      {/* Open Orders */}
      <Card className="border-white/10">
        <h4 className="text-sm font-semibold text-white mb-4">Open Orders</h4>
        <div className="space-y-2">
          {openOrders.map(o => (
            <div key={o.id} className="flex items-center justify-between text-sm py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <Badge variant={o.type === 'Buy' ? 'success' : 'warning'}>{o.type}</Badge>
                <span className="text-white">{o.pair}</span>
              </div>
              <div className="flex items-center gap-4 text-[var(--color-text-muted)]">
                <span>@ {o.price}</span>
                <span>{o.filled}</span>
                <span className="text-xs">{o.expiry}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
