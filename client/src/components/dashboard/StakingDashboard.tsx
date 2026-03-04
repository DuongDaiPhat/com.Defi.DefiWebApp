import { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { ProgressBar } from '../ui/ProgressBar';
import { Timer, TrendingUp, Coins, Gift } from 'lucide-react';
import type { StakingInfo, Transaction } from '../../hooks/useDashboardMock';

interface StakingDashboardProps {
  staking: StakingInfo;
  isStaking: boolean;
  isClaiming: boolean;
  countdown: string;
  performStake: (amount: number) => Promise<void>;
  performUnstake: (amount: number) => Promise<void>;
  claimRewards: () => Promise<void>;
  transactions: Transaction[];
  tokenBalance: number;
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      </div>
      <p className="text-xl font-display font-bold text-white">{value}</p>
    </div>
  );
}

export function StakingDashboard({ staking, isStaking, isClaiming, countdown, performStake, performUnstake, claimRewards, transactions, tokenBalance }: StakingDashboardProps) {
  const [activeTab, setActiveTab] = useState('Stake');
  const [amount, setAmount] = useState('');

  const numericAmount = parseFloat(amount) || 0;
  const stakes = transactions.filter(tx => tx.type === 'Stake' || tx.type === 'Unstake').slice(0, 5);

  const handleAction = async () => {
    if (numericAmount <= 0) return;
    if (activeTab === 'Stake') {
      await performStake(numericAmount);
    } else {
      await performUnstake(numericAmount);
    }
    setAmount('');
  };

  const maxAmount = activeTab === 'Stake' ? tokenBalance : staking.totalStaked;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Coins} label="Total Staked" value={`${staking.totalStaked.toLocaleString()} WDFI`} color="bg-[var(--color-accent)]/20 text-[var(--color-accent-light)]" />
        <StatCard icon={TrendingUp} label="Current APY" value={`${staking.apy}%`} color="bg-[var(--color-success)]/20 text-[var(--color-success)]" />
        <StatCard icon={Gift} label="Pending Rewards" value={`${staking.pendingRewards.toFixed(1)} WDFI`} color="bg-[var(--color-primary)]/20 text-[var(--color-primary-light)]" />
        <StatCard icon={Timer} label="Next Reward" value={countdown || '-- : -- : --'} color="bg-yellow-500/20 text-yellow-500" />
      </div>

      {/* Countdown Bar */}
      <Card className="border-white/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--color-text-muted)]">Reward Distribution Progress</span>
          <span className="text-sm font-semibold text-[var(--color-primary-light)]">{countdown}</span>
        </div>
        <ProgressBar value={((4 * 3600000 - (staking.nextDistribution - Date.now())) / (4 * 3600000)) * 100} color="gold" />
      </Card>

      {/* Stake/Unstake Form */}
      <Card className="border-white/10">
        <Tabs tabs={['Stake', 'Unstake']} activeTab={activeTab} onTabChange={setActiveTab} className="mb-6" />

        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-4">
          <div className="flex justify-between text-sm mb-2 text-[var(--color-text-muted)]">
            <span>Amount</span>
            <span>Available: {maxAmount.toLocaleString()} WDFI</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-2xl font-bold text-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.0"
            />
            <button
              onClick={() => setAmount(String(maxAmount))}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] hover:bg-[var(--color-primary)]/30 transition-colors"
            >
              MAX
            </button>
            <div className="flex items-center gap-1.5 bg-[var(--color-primary)]/20 rounded-xl px-3 py-2 border border-[var(--color-primary)]/30">
              <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold text-white">W</div>
              <span className="font-semibold text-white text-sm">WDFI</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleAction}
            isLoading={isStaking}
            disabled={numericAmount <= 0}
            className="flex-1 h-12 text-base"
            variant={activeTab === 'Stake' ? 'primary' : 'outline'}
          >
            {activeTab === 'Stake' ? 'Stake Tokens' : 'Unstake Tokens'}
          </Button>
          <Button
            onClick={claimRewards}
            isLoading={isClaiming}
            disabled={staking.pendingRewards <= 0}
            variant="secondary"
            className="h-12 gap-2"
          >
            <Gift className="w-4 h-4" /> Claim
          </Button>
        </div>
      </Card>

      {/* Staking History */}
      {stakes.length > 0 && (
        <Card className="border-white/10">
          <h4 className="text-sm font-semibold text-white mb-4">Staking History</h4>
          <div className="space-y-2">
            {stakes.map(tx => (
              <div key={tx.id} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge variant={tx.type === 'Stake' ? 'default' : 'outline'}>{tx.type}</Badge>
                  <span className="text-white">{tx.amount}</span>
                </div>
                <Badge variant={tx.status === 'Success' ? 'success' : 'warning'}>{tx.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
