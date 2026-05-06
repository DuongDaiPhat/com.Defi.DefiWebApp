import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { Card } from '../components/ui/Card';
import { ArrowUpRight, Clock, CheckCircle, XCircle, RefreshCw, History } from 'lucide-react';
import { useWeb3 } from '../hooks/useWeb3';
import { OSVA_POOL_ADDRESS, OSVA_POOL_ABI } from '../lib/osvaAbi';

// ============================================================
//  Types
// ============================================================

interface SwapEvent {
  blockNumber: number;
  transactionHash: string;
  user: string;
  tokenIn: string;
  amountIn: bigint;
  amountOut: bigint;
  alpha: bigint;
  type: 'Swap';
}

interface LiquidityEvent {
  blockNumber: number;
  transactionHash: string;
  provider: string;
  amount0: bigint;
  amount1: bigint;
  shares: bigint;
  type: 'LiquidityAdded' | 'LiquidityRemoved';
}

type TxEvent = SwapEvent | LiquidityEvent;

// ============================================================
//  Helpers
// ============================================================

function shortHash(hash: string) {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function formatAmt(wei: bigint) {
  return parseFloat(ethers.formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

// ============================================================
//  Load events from on-chain logs
// ============================================================

async function loadEvents(userAddress: string): Promise<TxEvent[]> {
  const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
  const pool = new ethers.Contract(OSVA_POOL_ADDRESS, OSVA_POOL_ABI, provider);

  const currentBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, currentBlock - 10_000); // last ~1.5 days on Sepolia

  const [swapLogs, addLogs, removeLogs] = await Promise.all([
    pool.queryFilter(pool.filters.Swap(userAddress), fromBlock),
    pool.queryFilter(pool.filters.LiquidityAdded(userAddress), fromBlock),
    pool.queryFilter(pool.filters.LiquidityRemoved(userAddress), fromBlock),
  ]);

  const swapEvents: SwapEvent[] = swapLogs.map((log: ethers.EventLog | ethers.Log) => {
    const e = log as ethers.EventLog;
    return {
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      user: e.args.user,
      tokenIn: e.args.tokenIn,
      amountIn: BigInt(e.args.amountIn.toString()),
      amountOut: BigInt(e.args.amountOut.toString()),
      alpha: BigInt(e.args.alpha.toString()),
      type: 'Swap',
    };
  });

  const addEvents: LiquidityEvent[] = addLogs.map((log: ethers.EventLog | ethers.Log) => {
    const e = log as ethers.EventLog;
    return {
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      provider: e.args.provider,
      amount0: BigInt(e.args.amount0.toString()),
      amount1: BigInt(e.args.amount1.toString()),
      shares: BigInt(e.args.shares.toString()),
      type: 'LiquidityAdded',
    };
  });

  const removeEvents: LiquidityEvent[] = removeLogs.map((log: ethers.EventLog | ethers.Log) => {
    const e = log as ethers.EventLog;
    return {
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
      provider: e.args.provider,
      amount0: BigInt(e.args.amount0.toString()),
      amount1: BigInt(e.args.amount1.toString()),
      shares: BigInt(e.args.shares.toString()),
      type: 'LiquidityRemoved',
    };
  });

  return [...swapEvents, ...addEvents, ...removeEvents].sort((a, b) => b.blockNumber - a.blockNumber);
}

// ============================================================
//  Component
// ============================================================

const TYPE_META: Record<string, { label: string; color: string }> = {
  Swap: { label: 'Swap', color: 'text-blue-400 bg-blue-400/10' },
  LiquidityAdded: { label: 'Add LP', color: 'text-green-400 bg-green-400/10' },
  LiquidityRemoved: { label: 'Remove LP', color: 'text-amber-400 bg-amber-400/10' },
};

export function HistoryPage() {
  const { address, isConnected } = useWeb3();
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!address) return;
    setIsLoading(true);
    setError('');
    try {
      const evts = await loadEvents(address);
      setEvents(evts);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load transaction history');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) load();
  }, [isConnected, load]);

  return (
    <div className="py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-6 h-6 text-[var(--color-primary)]" />
          <h1 className="text-2xl font-display font-bold text-white">Transaction History</h1>
        </div>
        {isConnected && (
          <button
            onClick={load}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
      </div>

      {!isConnected ? (
        <Card className="border-white/10 text-center py-16">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">Connect your wallet to view transaction history</p>
        </Card>
      ) : error ? (
        <Card className="border-red-500/20 text-center py-12">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={load} className="mt-4 text-sm text-slate-400 hover:text-white underline">Try again</button>
        </Card>
      ) : isLoading ? (
        <Card className="border-white/10 py-16 flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[var(--color-primary)]/20 border-t-[var(--color-primary)] rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading events from Sepolia…</p>
        </Card>
      ) : events.length === 0 ? (
        <Card className="border-white/10 text-center py-16">
          <CheckCircle className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No OSVA transactions found for this wallet in the last ~10,000 blocks</p>
        </Card>
      ) : (
        <Card className="border-white/10 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/10">
                <tr className="text-left">
                  {['Type', 'Block', 'TX Hash', 'Details', 'Alpha', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-xs text-slate-500 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((evt, i) => {
                  const meta = TYPE_META[evt.type];
                  return (
                    <tr key={`${evt.transactionHash}-${i}`} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono">#{evt.blockNumber.toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-slate-300">{shortHash(evt.transactionHash)}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {evt.type === 'Swap' ? (
                          <span>{formatAmt(evt.amountIn)} → {formatAmt(evt.amountOut)}</span>
                        ) : (
                          <span>{formatAmt(evt.amount0)} / {formatAmt(evt.amount1)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {evt.type === 'Swap' ? (
                          <span className="text-[var(--color-primary)] font-mono font-semibold">α={evt.alpha.toString()}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={`https://sepolia.etherscan.io/tx/${evt.transactionHash}`}
                          target="_blank" rel="noreferrer"
                          className="text-[var(--color-primary-light)] hover:text-white transition-colors"
                        >
                          <ArrowUpRight className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-white/5 text-xs text-slate-600">
            Showing {events.length} events from the last ~10,000 blocks • Pool: {OSVA_POOL_ADDRESS.slice(0,8)}…
          </div>
        </Card>
      )}
    </div>
  );
}
