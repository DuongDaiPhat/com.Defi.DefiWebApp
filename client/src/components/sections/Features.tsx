import { ArrowDownUp, Settings, Activity, ShieldCheck, Zap } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

function MockSwapUI() {
  return (
    <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 relative overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium text-white">Swap Assets</h4>
        <button className="text-[var(--color-text-muted)] hover:text-white transition-colors">
          <Settings className="w-4 h-4" />
        </button>
      </div>
      
      {/* From Token */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg p-3 mb-2 border border-white/5">
        <div className="flex justify-between text-sm mb-1 text-[var(--color-text-muted)]">
          <span>You pay</span>
          <span>Balance: 1.542</span>
        </div>
        <div className="flex justify-between items-center">
          <input 
            type="text" 
            value="1.0" 
            readOnly 
            className="bg-transparent text-2xl font-bold text-white outline-none w-1/2"
          />
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-2 py-1">
            <div className="w-5 h-5 rounded-full bg-blue-500" />
            <span className="font-semibold text-white">ETH</span>
          </div>
        </div>
      </div>

      {/* Switch Button */}
      <div className="absolute left-1/2 top-[102px] -translate-x-1/2 translate-y-2 z-10 w-8 h-8 bg-[var(--color-bg-elevated)] rounded-full flex items-center justify-center border border-white/10 hover:border-white/30 cursor-pointer shadow-lg hover:text-[var(--color-primary-light)] transition-colors">
        <ArrowDownUp className="w-4 h-4" />
      </div>

      {/* To Token */}
      <div className="bg-[var(--color-bg-elevated)] rounded-lg p-3 mt-1 mb-4 border border-white/5">
        <div className="flex justify-between text-sm mb-1 text-[var(--color-text-muted)]">
          <span>You receive</span>
          <span>Balance: 0.00</span>
        </div>
        <div className="flex justify-between items-center">
          <input 
            type="text" 
            value="2540.50" 
            readOnly 
            className="bg-transparent text-2xl font-bold text-white outline-none w-1/2"
          />
          <div className="flex items-center gap-2 bg-[var(--color-primary)]/20 rounded-lg px-2 py-1 border border-[var(--color-primary)]/30">
            <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center font-bold text-[10px] text-white">D</div>
            <span className="font-semibold text-white">DFT</span>
          </div>
        </div>
      </div>

      <Button className="w-full h-12 text-lg shadow-[var(--glow-gold)]">
        Swap on Sepolia
      </Button>
    </div>
  );
}

function MockStakeUI() {
  return (
    <div className="h-full flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-display font-bold text-white mb-1">Liquid Staking</h3>
            <p className="text-sm text-[var(--color-text-muted)]">Earn rewards dynamically.</p>
          </div>
          <Badge variant="success" className="animate-pulse">12.5% APY</Badge>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex justify-between items-center bg-[var(--color-bg)]/50 p-3 rounded-lg border border-white/5">
            <span className="text-sm text-[var(--color-text-muted)]">Your Staked</span>
            <span className="font-semibold text-white">450.00 DFT</span>
          </div>
          <div className="flex justify-between items-center bg-[var(--color-bg)]/50 p-3 rounded-lg border border-white/5">
            <span className="text-sm text-[var(--color-text-muted)]">Pending Reward</span>
            <span className="font-semibold text-[var(--color-success)]">+12.45 DFT</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1">Unstake</Button>
        <Button className="flex-1">Claim Rewards</Button>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-display font-bold tracking-tight mb-4">
            Powerful <span className="text-gradient">DeFi Primitives</span>
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
            Experience our Smart Contracts deployed on Ethereum Sepolia Testnet. Fast, secure, and ready for extreme scale.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main Swap Component (Span 2 config on large screens if desired, but here we do balanced) */}
          <Card className="col-span-1 md:col-span-2 md:row-span-2 bg-gradient-to-br from-[var(--color-bg-card)] to-slate-900 border-white/10" glowOnHover>
            <div className="grid md:grid-cols-2 gap-8 h-full">
              <div className="flex flex-col justify-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/20 flex items-center justify-center mb-6 border border-[var(--color-primary)]/30">
                  <ArrowDownUp className="w-6 h-6 text-[var(--color-primary-light)]" />
                </div>
                <h3 className="text-2xl font-display font-bold text-white mb-3">Instant Token Swap</h3>
                <p className="text-[var(--color-text-muted)] mb-6">
                  Swap ERC-20 tokens instantly with minimal slippage. Our testnet AMM ensures deep liquidity simulations.
                </p>
                <div className="flex gap-3 text-sm font-medium">
                  <Badge variant="outline"><Activity className="w-3 h-3 mr-1 inline"/> Sub-second</Badge>
                  <Badge variant="outline"><Zap className="w-3 h-3 mr-1 inline"/> Zero fees</Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-center">
                <div className="w-full max-w-sm">
                  <MockSwapUI />
                </div>
              </div>
            </div>
          </Card>

          {/* Staking Card */}
          <Card className="col-span-1 bg-gradient-to-bl from-purple-900/20 to-[var(--color-bg-card)] border-white/10" glowOnHover>
             <MockStakeUI />
          </Card>

          {/* Security Banner Card */}
          <Card className="col-span-1 flex flex-col justify-between bg-[var(--color-bg-card)] border-white/10" glowOnHover>
            <div>
              <div className="w-10 h-10 rounded-lg bg-[var(--color-success)]/20 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-[var(--color-success)]" />
              </div>
              <h3 className="text-lg font-display font-bold text-white mb-2">Audited Smart Contracts</h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                Our Sepolia testnet contracts are designed with industry-standard security patterns (ReentrancyGuards, SafeMath).
              </p>
            </div>
          </Card>

        </div>
      </div>
    </section>
  );
}
