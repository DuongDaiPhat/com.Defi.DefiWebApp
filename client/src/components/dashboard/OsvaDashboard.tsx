import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { CheckCircle, XCircle, RefreshCw, Activity, Layers, Scale, TrendingUp } from 'lucide-react';
import { fetchOsvaStatus, type OsvaStatusData } from '../../lib/osvaApi';
import { ethers } from 'ethers';

const POLL_INTERVAL_MS = 12_000;

function StatRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-[var(--color-text-muted)]">{label}</span>
      {children ?? <span className="text-sm font-medium text-white font-mono">{value}</span>}
    </div>
  );
}

function formatReserve(weiStr: string) {
  try {
    const wei = BigInt(weiStr);
    const eth = ethers.formatEther(wei);
    return parseFloat(eth).toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return weiStr;
  }
}

export function OsvaDashboard() {
  const [data, setData] = useState<OsvaStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetch = async () => {
    setIsLoading(true);
    try {
      const d = await fetchOsvaStatus();
      setData(d);
      setLastFetched(new Date());
    } catch {
      // keep old data on error, will retry
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const alphaPercent = data ? (data.currentAlpha / 100) * 100 : 0;
  const sigmaNum = data ? parseFloat(data.sigma) * 100 : 0;

  return (
    <Card className="border-white/10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[var(--color-primary)]" />
          <h3 className="text-lg font-display font-bold text-white">OSVA Oracle Dashboard</h3>
        </div>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-slate-500">Updated {lastFetched.toLocaleTimeString()}</span>
          )}
          <button
            onClick={fetch}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all ${isLoading ? 'animate-spin' : ''}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* System ready badge */}
      <div className="flex items-center gap-3 mb-6 bg-white/5 rounded-xl p-4">
        {data?.systemReady ? (
          <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
        ) : (
          <XCircle className="w-6 h-6 text-red-400 shrink-0" />
        )}
        <div>
          <p className={`text-sm font-semibold ${data?.systemReady ? 'text-green-400' : 'text-red-400'}`}>
            {data?.systemReady ? 'Oracle Ready' : data === null ? 'Connecting…' : 'Oracle Not Ready'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {data === null ? 'Waiting for first response' : 'Workers running, data available'}
          </p>
        </div>
      </div>

      {/* Alpha gauge */}
      <div className="mb-6 bg-[var(--color-bg)]/60 rounded-xl p-4 border border-white/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-[var(--color-text-muted)] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Amplification Factor α
          </span>
          <span className="text-2xl font-bold font-mono text-[var(--color-primary)]">
            {data?.currentAlpha ?? '—'}
          </span>
        </div>
        <div className="bg-white/5 rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-2 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)]"
            animate={{ width: `${alphaPercent}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0 (V2)</span><span>50</span><span>100 (Max)</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <Scale className="w-4 h-4 text-slate-400 mb-2" />
          <p className="text-xs text-slate-500 mb-1">Market Volatility σ</p>
          <p className="text-xl font-bold text-white">{sigmaNum.toFixed(2)}<span className="text-sm text-slate-400 ml-1">%</span></p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <Layers className="w-4 h-4 text-slate-400 mb-2" />
          <p className="text-xs text-slate-500 mb-1">Depth Factor</p>
          <p className="text-xl font-bold text-white">{data?.depthFactor ?? '—'}</p>
        </div>
      </div>

      {/* Table rows */}
      <div>
        <StatRow label="Imbalance Ratio" value={data?.imbalanceRatio ?? '—'} />
        <StatRow label="Reserve 0">
          <span className="text-sm font-mono text-white">{data ? formatReserve(data.reserve0) : '—'} <span className="text-slate-500">tokens</span></span>
        </StatRow>
        <StatRow label="Reserve 1">
          <span className="text-sm font-mono text-white">{data ? formatReserve(data.reserve1) : '—'} <span className="text-slate-500">tokens</span></span>
        </StatRow>
        <StatRow label="Oracle Signer">
          <span className="text-xs font-mono text-slate-300 break-all">
            {data?.oracleSignerAddress
              ? `${data.oracleSignerAddress.slice(0,8)}…${data.oracleSignerAddress.slice(-6)}`
              : '—'}
          </span>
        </StatRow>
        <StatRow label="Last Updated">
          <span className="text-xs text-slate-400">
            {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : '—'}
          </span>
        </StatRow>
      </div>
    </Card>
  );
}
