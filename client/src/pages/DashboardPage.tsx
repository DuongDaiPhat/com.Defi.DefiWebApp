import { useSearchParams } from 'react-router-dom';
import { useDashboardMock } from '../hooks/useDashboardMock';
import { PortfolioOverview } from '../components/dashboard/PortfolioOverview';
import { TransactionMonitor } from '../components/dashboard/TransactionMonitor';
import { AnalyticsSection } from '../components/dashboard/AnalyticsSection';
import { TestingTools } from '../components/dashboard/TestingTools';
import { PoolsTable } from '../components/dashboard/PoolsTable';

const TABS = [
  { key: 'tokens', label: 'Tokens' },
  { key: 'pools', label: 'Pools' },
  { key: 'transactions', label: 'Transactions' },
];

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'tokens';

  const {
    totalUSD, portfolioBreakdown, change24h,
    transactions,
    analytics,
    contractAddresses, networkStatus, requestFaucet, mintTestTokens,
  } = useDashboardMock();

  return (
    <>
      {/* Tab Switcher */}
      <div className="mb-6">
        <div className="flex bg-white/5 rounded-xl p-1 gap-1 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSearchParams(tab.key === 'tokens' ? {} : { tab: tab.key })}
              className={`py-2.5 px-5 rounded-lg text-sm font-semibold transition-all duration-200 ${
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
      {activeTab === 'tokens' && (
        <div className="space-y-6">
          <PortfolioOverview totalUSD={totalUSD} breakdown={portfolioBreakdown} change24h={change24h} />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <AnalyticsSection analytics={analytics} />
            </div>
            <TestingTools
              contractAddresses={contractAddresses}
              networkStatus={networkStatus}
              requestFaucet={requestFaucet}
              mintTestTokens={mintTestTokens}
            />
          </div>
        </div>
      )}

      {activeTab === 'pools' && <PoolsTable />}

      {activeTab === 'transactions' && (
        <TransactionMonitor transactions={transactions} />
      )}
    </>
  );
}
