import { memo } from 'react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { TrendingUp, Droplets } from 'lucide-react';

const MOCK_POOLS = [
  { id: 1, name: 'ETH / WDFI', tvl: 2_450_000, apr: 12.5, vol24h: 320_000, fee: '0.3%', status: 'Active' as const },
  { id: 2, name: 'ETH / USDC', tvl: 8_120_000, apr: 5.2, vol24h: 1_200_000, fee: '0.05%', status: 'Active' as const },
  { id: 3, name: 'WDFI / USDC', tvl: 890_000, apr: 18.7, vol24h: 95_000, fee: '0.3%', status: 'Active' as const },
  { id: 4, name: 'ETH / DAI', tvl: 3_200_000, apr: 4.8, vol24h: 680_000, fee: '0.05%', status: 'Active' as const },
  { id: 5, name: 'WDFI / DAI', tvl: 420_000, apr: 22.1, vol24h: 45_000, fee: '1%', status: 'New' as const },
  { id: 6, name: 'ETH / WBTC', tvl: 15_600_000, apr: 3.1, vol24h: 2_800_000, fee: '0.05%', status: 'Active' as const },
];

const fmt = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1_000).toFixed(0)}K`;

export const PoolsTable = memo(function PoolsTable() {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-[var(--color-primary-light)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Total TVL</p>
              <p className="text-lg font-bold text-white">$30.68M</p>
            </div>
          </div>
        </Card>
        <Card className="border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-success)]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[var(--color-success)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">24h Volume</p>
              <p className="text-lg font-bold text-white">$5.14M</p>
            </div>
          </div>
        </Card>
        <Card className="border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-[var(--color-accent-light)]" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Active Pools</p>
              <p className="text-lg font-bold text-white">{MOCK_POOLS.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pools Table */}
      <Card className="border-white/10">
        <h3 className="text-lg font-display font-bold text-white mb-4">Liquidity Pools</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--color-text-muted)] border-b border-white/5">
                <th className="text-left pb-3 font-medium">Pool</th>
                <th className="text-right pb-3 font-medium">TVL</th>
                <th className="text-right pb-3 font-medium">APR</th>
                <th className="text-right pb-3 font-medium hidden sm:table-cell">Volume 24h</th>
                <th className="text-right pb-3 font-medium hidden sm:table-cell">Fee</th>
                <th className="text-right pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_POOLS.map(pool => (
                <tr key={pool.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        <div className="w-6 h-6 rounded-full bg-[#627EEA] flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--color-bg-card)]">Ξ</div>
                        <div className="w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-[var(--color-bg-card)]">W</div>
                      </div>
                      <span className="font-semibold text-white">{pool.name}</span>
                    </div>
                  </td>
                  <td className="text-right text-white py-3.5">{fmt(pool.tvl)}</td>
                  <td className="text-right py-3.5">
                    <span className={`font-semibold ${pool.apr > 10 ? 'text-[var(--color-success)]' : 'text-white'}`}>{pool.apr}%</span>
                  </td>
                  <td className="text-right text-[var(--color-text-muted)] py-3.5 hidden sm:table-cell">{fmt(pool.vol24h)}</td>
                  <td className="text-right text-[var(--color-text-muted)] py-3.5 hidden sm:table-cell">{pool.fee}</td>
                  <td className="text-right py-3.5">
                    <Badge variant={pool.status === 'New' ? 'default' : 'outline'}>{pool.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
});
