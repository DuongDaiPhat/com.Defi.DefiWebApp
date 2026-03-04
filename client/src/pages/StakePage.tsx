import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardMock } from '../hooks/useDashboardMock';
import { StakingDashboard } from '../components/dashboard/StakingDashboard';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Plus, Info } from 'lucide-react';

const TABS = [
  { key: 'positions', label: 'View Positions' },
  { key: 'create', label: 'Create Position' },
];

const POOL_OPTIONS = [
  { pair: 'ETH / WDFI', apr: '12.5%', tvl: '$2.45M' },
  { pair: 'ETH / USDC', apr: '5.2%', tvl: '$8.12M' },
  { pair: 'WDFI / USDC', apr: '18.7%', tvl: '$890K' },
];

const FEE_TIERS = ['0.01%', '0.05%', '0.3%', '1%'];

function CreatePositionModule() {
  const [selectedPool, setSelectedPool] = useState(0);
  const [feeTier, setFeeTier] = useState('0.3%');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const pool = POOL_OPTIONS[selectedPool];

  const handleCreate = async () => {
    setIsCreating(true);
    await new Promise(r => setTimeout(r, 2000));
    setIsCreating(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <Card className="border-white/10">
        <h2 className="text-2xl font-display font-bold text-white mb-6 flex items-center gap-2">
          <Plus className="w-6 h-6 text-[var(--color-primary-light)]" />
          New Position
        </h2>

        {/* Pool Selection */}
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Select Pool</p>
        <div className="space-y-2 mb-6">
          {POOL_OPTIONS.map((p, i) => (
            <button
              key={p.pair}
              onClick={() => setSelectedPool(i)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all ${
                selectedPool === i
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                  : 'border-white/5 hover:border-white/20 bg-white/[0.02]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-[#627EEA] flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--color-bg-card)]">Ξ</div>
                  <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--color-bg-card)]">W</div>
                </div>
                <span className="font-semibold text-white text-sm">{p.pair}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                <span>APR: <span className="text-[var(--color-success)]">{p.apr}</span></span>
                <span>TVL: {p.tvl}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Fee Tier */}
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Fee Tier</p>
        <div className="flex gap-2 mb-6">
          {FEE_TIERS.map(fee => (
            <button
              key={fee}
              onClick={() => setFeeTier(fee)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                feeTier === fee
                  ? 'bg-[var(--color-primary)] text-slate-950'
                  : 'bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white'
              }`}
            >
              {fee}
            </button>
          ))}
        </div>

        {/* Price Range */}
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Set Price Range</p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[var(--color-bg)]/50 rounded-xl p-3 border border-white/5">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Min Price</p>
            <input
              type="number"
              value={priceMin}
              onChange={e => setPriceMin(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-xl font-bold text-white outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="bg-[var(--color-bg)]/50 rounded-xl p-3 border border-white/5">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Max Price</p>
            <input
              type="number"
              value={priceMax}
              onChange={e => setPriceMax(e.target.value)}
              placeholder="∞"
              className="bg-transparent text-xl font-bold text-white outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Deposit Amounts */}
        <p className="text-sm text-[var(--color-text-muted)] mb-3">Deposit Amounts</p>
        <div className="space-y-3 mb-6">
          <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5">
            <div className="flex justify-between text-sm mb-2 text-[var(--color-text-muted)]">
              <span>{pool.pair.split(' / ')[0]}</span>
              <span>Balance: 1.542</span>
            </div>
            <input
              type="number"
              value={amount0}
              onChange={e => setAmount0(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-2xl font-bold text-white outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5">
            <div className="flex justify-between text-sm mb-2 text-[var(--color-text-muted)]">
              <span>{pool.pair.split(' / ')[1]}</span>
              <span>Balance: 2,500</span>
            </div>
            <input
              type="number"
              value={amount1}
              onChange={e => setAmount1(e.target.value)}
              placeholder="0.0"
              className="bg-transparent text-2xl font-bold text-white outline-none w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Info box */}
        <div className="flex items-start gap-2 bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 rounded-xl p-3 mb-6">
          <Info className="w-4 h-4 text-[var(--color-accent-light)] mt-0.5 shrink-0" />
          <p className="text-xs text-[var(--color-text-muted)]">
            Your position will earn fees proportional to your share of the pool within the selected price range. Narrower ranges earn more fees but may go out of range.
          </p>
        </div>

        <Button
          onClick={handleCreate}
          isLoading={isCreating}
          disabled={!amount0 && !amount1}
          className="w-full h-14 text-lg shadow-[var(--glow-gold)]"
        >
          {!amount0 && !amount1 ? 'Enter deposit amounts' : 'Create Position'}
        </Button>
      </Card>
    </div>
  );
}

export function StakePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'positions';

  const {
    tokens, staking, isStaking, isClaiming, countdown,
    performStake, performUnstake, claimRewards,
    transactions,
  } = useDashboardMock();

  const wdfiBalance = tokens.find(t => t.symbol === 'WDFI')?.balance ?? 0;

  return (
    <div className="py-4">
      {/* Tab Switcher */}
      <div className="max-w-lg mx-auto mb-6">
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSearchParams(tab.key === 'positions' ? {} : { tab: tab.key })}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-[var(--color-primary)] text-slate-950 shadow-lg'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'positions' && (
        <StakingDashboard
          staking={staking}
          isStaking={isStaking}
          isClaiming={isClaiming}
          countdown={countdown}
          performStake={performStake}
          performUnstake={performUnstake}
          claimRewards={claimRewards}
          transactions={transactions}
          tokenBalance={wdfiBalance}
        />
      )}
      {activeTab === 'create' && <CreatePositionModule />}
    </div>
  );
}
