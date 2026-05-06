import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getOSVAStatus, type OSVAStatus } from '../lib/osvaApi';

const POLL_INTERVAL = 12_000; // 12 seconds

function fmtWei(wei: string, dp = 4): string {
  try {
    const n = parseFloat(ethers.formatEther(wei));
    if (n < 0.001) return '< 0.001';
    return n.toLocaleString('en-US', { maximumFractionDigits: dp });
  } catch { return '—'; }
}

function fmtDecimal(val: string, dp = 4): string {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: dp });
}

function fmtPct(val: string): string {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : `${(n * 100).toFixed(2)}%`;
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('vi-VN'); }
  catch { return iso; }
}

// Alpha gauge arc (SVG)
function AlphaGauge({ alpha }: { alpha: number }) {
  const pct = Math.min(Math.max(alpha, 0), 100) / 100;
  const r = 52;
  const circumference = Math.PI * r; // half circle
  const offset = circumference * (1 - pct);
  const color = alpha < 25 ? '#94a3b8' : alpha < 60 ? '#f59e0b' : '#8b5cf6';

  return (
    <div className="relative flex flex-col items-center">
      <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
        {/* Background arc */}
        <path
          d="M 14 70 A 52 52 0 0 1 126 70"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 14 70 A 52 52 0 0 1 126 70"
          fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className="text-4xl font-bold text-white">{alpha}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  );
}

export default function OSVADashboardPage() {
  const [status, setStatus]         = useState<OSVAStatus | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [nextPoll, setNextPoll]     = useState(POLL_INTERVAL / 1000);
  const [lastFetch, setLastFetch]   = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getOSVAStatus();
      setStatus(data);
      setError(null);
      setLastFetch(new Date());
    } catch (err: any) {
      setError(err?.message ?? 'Không thể kết nối Backend');
    } finally {
      setLoading(false);
      setNextPoll(POLL_INTERVAL / 1000);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Countdown to next poll
  useEffect(() => {
    const tick = setInterval(() => setNextPoll(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">OSVA Oracle Dashboard</h1>
          <p className="text-slate-400 text-sm">Trạng thái hệ thống Off-chain Signed Virtual Amplification</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Cập nhật sau: <span className="text-amber-400 font-mono">{nextPoll}s</span></span>
          <button onClick={fetchStatus} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all" title="Làm mới">
            ↻
          </button>
        </div>
      </div>

      {loading && !status && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm mb-6">
          <span className="font-semibold">⚠️ Không thể kết nối Backend: </span>{error}
        </div>
      )}

      {status && (
        <div className="space-y-4">

          {/* System Ready + Alpha gauge */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* System Status */}
            <div className="glass rounded-2xl p-6">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Trạng thái hệ thống</p>
              <div className="flex items-center gap-3 mb-6">
                <span className={`w-4 h-4 rounded-full ${status.systemReady ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className={`text-2xl font-bold ${status.systemReady ? 'text-emerald-400' : 'text-red-400'}`}>
                  {status.systemReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Oracle Signer</span>
                  <span className="text-slate-300 font-mono text-xs">
                    {status.oracleSignerAddress
                      ? `${status.oracleSignerAddress.slice(0, 8)}…${status.oracleSignerAddress.slice(-6)}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cập nhật lúc</span>
                  <span className="text-slate-300">{fmtTime(status.lastUpdated)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Dữ liệu UI lúc</span>
                  <span className="text-slate-300">{lastFetch ? lastFetch.toLocaleTimeString('vi-VN') : '—'}</span>
                </div>
              </div>
            </div>

            {/* Alpha gauge */}
            <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Alpha hiện tại (α)</p>
              <AlphaGauge alpha={status.currentAlpha} />
              <p className="text-slate-400 text-xs mt-3">
                {status.currentAlpha === 0 ? 'Không khuếch đại (V2 chuẩn)'
                  : status.currentAlpha < 25 ? 'Khuếch đại nhẹ'
                  : status.currentAlpha < 70 ? 'Khuếch đại trung bình'
                  : 'Khuếch đại cao'}
              </p>
            </div>
          </div>

          {/* Market metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Sigma (σ)', value: fmtPct(status.sigma), desc: 'Biến động thị trường', color: 'amber' },
              { label: 'Depth Factor', value: fmtDecimal(status.depthFactor), desc: 'Độ sâu sổ lệnh CEX', color: 'violet' },
              { label: 'Imbalance Ratio', value: fmtDecimal(status.imbalanceRatio), desc: 'Mất cân bằng pool', color: 'sky' },
              { label: 'Alpha (α)', value: status.currentAlpha.toString(), desc: '/ 100 max', color: 'emerald' },
            ].map(m => (
              <div key={m.label} className="glass rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">{m.label}</p>
                <p className={`text-2xl font-bold text-${m.color}-400`}>{m.value}</p>
                <p className="text-xs text-slate-500 mt-1">{m.desc}</p>
              </div>
            ))}
          </div>

          {/* Reserves */}
          <div className="glass rounded-2xl p-6">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Dự trữ Pool (OSVAPool)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300 font-medium">Reserve Token0</span>
                  <span className="text-white font-bold">{fmtWei(status.reserve0)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (parseFloat(ethers.formatEther(status.reserve0)) / (parseFloat(ethers.formatEther(status.reserve0)) + parseFloat(ethers.formatEther(status.reserve1)) || 1)) * 100).toFixed(1)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">{status.reserve0} wei</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-300 font-medium">Reserve Token1</span>
                  <span className="text-white font-bold">{fmtWei(status.reserve1)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (parseFloat(ethers.formatEther(status.reserve1)) / (parseFloat(ethers.formatEther(status.reserve0)) + parseFloat(ethers.formatEther(status.reserve1)) || 1)) * 100).toFixed(1)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1 font-mono">{status.reserve1} wei</p>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="glass rounded-2xl p-6">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cách OSVA hoạt động</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {[
                { step: '1', title: 'Oracle tính α', desc: 'Backend phân tích sigma (σ), depth factor, imbalance ratio → tính hệ số khuếch đại α tối ưu.' },
                { step: '2', title: 'Ký EIP-712', desc: 'Oracle ký α + deadline bằng private key → tạo chữ ký 65 bytes không thể giả mạo.' },
                { step: '3', title: 'On-chain verify', desc: 'Smart contract xác minh chữ ký, áp dụng thanh khoản ảo → slippage thấp hơn V2.' },
              ].map(s => (
                <div key={s.step} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm shrink-0">
                    {s.step}
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">{s.title}</p>
                    <p className="text-slate-400 text-xs leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
