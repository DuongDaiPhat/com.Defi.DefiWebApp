import { useSearchParams } from 'react-router-dom';
import { useDashboardMock } from '../hooks/useDashboardMock';
import { SwapModule } from '../components/dashboard/SwapModule';
import { LimitOrderModule } from '../components/dashboard/LimitOrderModule';
import { BuySellModule } from '../components/dashboard/BuySellModule';

const TABS = [
  { key: 'swap', label: 'Swap' },
  { key: 'limit', label: 'Limit' },
  { key: 'buy', label: 'Buy' },
  { key: 'sell', label: 'Sell' },
];

export function SwapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'swap';

  const {
    tokens, exchangeRate, gasEstimate,
    slippage, setSlippage,
    isSwapping, performSwap,
    transactions,
  } = useDashboardMock();

  return (
    <div className="py-4">
      {/* Tab Switcher */}
      <div className="max-w-lg mx-auto mb-6">
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSearchParams(tab.key === 'swap' ? {} : { tab: tab.key })}
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
      {activeTab === 'swap' && (
        <SwapModule
          tokens={tokens}
          exchangeRate={exchangeRate}
          gasEstimate={gasEstimate}
          slippage={slippage}
          setSlippage={setSlippage}
          isSwapping={isSwapping}
          performSwap={performSwap}
          transactions={transactions}
        />
      )}
      {activeTab === 'limit' && <LimitOrderModule />}
      {activeTab === 'buy' && <BuySellModule mode="buy" />}
      {activeTab === 'sell' && <BuySellModule mode="sell" />}
    </div>
  );
}
