import { useState, memo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card } from '../ui/Card';
import { Tabs } from '../ui/Tabs';
import { Activity, Users, Layers, Fuel } from 'lucide-react';
import type { AnalyticsData } from '../../hooks/useDashboardMock';

interface AnalyticsProps {
  analytics: AnalyticsData;
}

const StatCard = memo(function StatCard({ icon: Icon, label, value, suffix }: { icon: React.ElementType; label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5">
      <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[var(--color-primary-light)]" />
      </div>
      <div>
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <p className="text-lg font-display font-bold text-white">{value}{suffix && <span className="text-sm text-[var(--color-text-muted)] ml-1">{suffix}</span>}</p>
      </div>
    </div>
  );
});

const tooltipStyle = { background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', fontSize: '13px' };

export const AnalyticsSection = memo(function AnalyticsSection({ analytics }: AnalyticsProps) {
  const [pricePeriod, setPricePeriod] = useState('30d');
  const priceData = pricePeriod === '7d' ? analytics.priceHistory.slice(-7) : analytics.priceHistory;

  return (
    <Card id="analytics" className="border-white/10">
      <h3 className="text-xl font-display font-bold text-white mb-6">Analytics</h3>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Layers} label="Total Value Locked" value={`$${(analytics.tvl / 1e6).toFixed(1)}M`} />
        <StatCard icon={Users} label="Active Stakers" value={analytics.activeStakers.toLocaleString()} />
        <StatCard icon={Activity} label="24h Volume" value={`$${(analytics.volume24h / 1e3).toFixed(0)}K`} />
        <StatCard icon={Fuel} label="Avg Gas (Swap)" value={`${analytics.gasFees[0].avgGas}`} suffix="ETH" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Price History */}
        <div className="bg-[var(--color-bg)]/40 rounded-xl p-4 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-white">WDFI Price History</h4>
            <Tabs tabs={['7d', '30d']} activeTab={pricePeriod} onTabChange={setPricePeriod} className="w-[140px]" />
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | string | undefined) => [`$${Number(value ?? 0).toFixed(2)}`, 'Price']} />
                <Line type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ fill: '#f59e0b', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume Chart */}
        <div className="bg-[var(--color-bg)]/40 rounded-xl p-4 border border-white/5">
          <h4 className="text-sm font-semibold text-white mb-4">Daily Volume</h4>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priceData.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | string | undefined) => [`$${Number(value ?? 0).toLocaleString()}`, 'Volume']} />
                <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gas Comparison */}
        <div className="bg-[var(--color-bg)]/40 rounded-xl p-4 border border-white/5 lg:col-span-2">
          <h4 className="text-sm font-semibold text-white mb-4">Gas Fees by Transaction Type (ETH)</h4>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.gasFees} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 13, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={70} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number | string | undefined) => [`${value ?? 0} ETH`, 'Avg Gas']} />
                <Bar dataKey="avgGas" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Card>
  );
});
