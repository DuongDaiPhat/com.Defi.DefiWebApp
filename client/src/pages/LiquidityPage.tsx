import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../hooks/useWeb3';
import { useOSVA } from '../hooks/useOSVA';

function fmtWei(wei: bigint, dp = 4): string {
  if (wei === 0n) return '0';
  const n = parseFloat(ethers.formatEther(wei));
  return n.toLocaleString('en-US', { maximumFractionDigits: dp });
}

function parseWei(val: string): bigint {
  try { return val ? ethers.parseEther(val) : 0n; } catch { return 0n; }
}

type Tab = 'add' | 'remove';

export default function LiquidityPage() {
  const { isConnected, connect, isWrongNetwork } = useWeb3();
  const {
    poolState,
    userLpBalance,
    token0Balance,
    token1Balance,
    isLoading,
    addLiquidity,
    removeLiquidity,
    estimateRemoval,
    estimateToken1ForToken0,
    estimateToken0ForToken1,
    fetchPoolState,
  } = useOSVA();

  const [tab, setTab] = useState<Tab>('add');

  // Add Liquidity state
  const [add0, setAdd0] = useState('');
  const [add1, setAdd1] = useState('');
  const [addResult, setAddResult] = useState<{ shares: bigint; txHash: string } | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Remove Liquidity state
  const [removePct, setRemovePct] = useState(50);
  const [removeResult, setRemoveResult] = useState<{ amount0: bigint; amount1: bigint; txHash: string } | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Derived: add liquidity preview
  const add0Wei = parseWei(add0);
  const add1Wei = parseWei(add1);
  const lpToReceive =
    poolState && poolState.totalSupply > 0n && poolState.reserve0 > 0n
      ? (add0Wei * poolState.totalSupply) / poolState.reserve0
      : add0Wei; // if pool is empty, shares = amount

  // Derived: remove liquidity preview
  const sharesToRemove =
    poolState && userLpBalance > 0n
      ? (userLpBalance * BigInt(removePct)) / 100n
      : 0n;
  const removePreview = estimateRemoval(sharesToRemove);

  // Derived: pool share
  const userShare =
    poolState && poolState.totalSupply > 0n
      ? Number((userLpBalance * 10000n) / poolState.totalSupply) / 100
      : 0;

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleAdd0Change = useCallback((val: string) => {
    setAdd0(val);
    if (!poolState || poolState.reserve0 === 0n) { setAdd1(val); return; }
    try {
      const w = ethers.parseEther(val);
      const computed = estimateToken1ForToken0(w);
      setAdd1(computed === 0n ? '' : ethers.formatEther(computed));
    } catch { setAdd1(''); }
  }, [poolState, estimateToken1ForToken0]);

  const handleAdd1Change = useCallback((val: string) => {
    setAdd1(val);
    if (!poolState || poolState.reserve1 === 0n) { setAdd0(val); return; }
    try {
      const w = ethers.parseEther(val);
      const computed = estimateToken0ForToken1(w);
      setAdd0(computed === 0n ? '' : ethers.formatEther(computed));
    } catch { setAdd0(''); }
  }, [poolState, estimateToken0ForToken1]);

  const handleAddLiquidity = async () => {
    setAddError(null);
    setAddResult(null);
    if (!add0Wei || !add1Wei) return;
    try {
      const res = await addLiquidity(add0Wei, add1Wei);
      setAddResult({ shares: res.shares, txHash: res.txHash });
      setAdd0(''); setAdd1('');
    } catch (err: any) {
      setAddError(err?.reason ?? err?.message ?? 'Thất bại');
    }
  };

  const handleRemoveLiquidity = async () => {
    setRemoveError(null);
    setRemoveResult(null);
    if (!sharesToRemove) return;
    try {
      const res = await removeLiquidity(sharesToRemove);
      setRemoveResult({ amount0: res.amount0, amount1: res.amount1, txHash: res.txHash });
    } catch (err: any) {
      setRemoveError(err?.reason ?? err?.message ?? 'Thất bại');
    }
  };

  // ─────────────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500/20 to-amber-500/20 border border-violet-500/20 flex items-center justify-center mb-6">
          <span className="text-4xl">💧</span>
        </div>
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-violet-400 to-amber-400 bg-clip-text text-transparent">
          OSVA Liquidity
        </h2>
        <p className="text-slate-400 mb-8 max-w-sm">Kết nối ví để thêm hoặc rút thanh khoản từ OSVAPool.</p>
        <button
          onClick={() => connect()}
          className="bg-gradient-to-r from-violet-500 to-violet-400 hover:from-violet-400 hover:to-violet-300 text-white font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-violet-500/25"
        >
          Kết nối MetaMask
        </button>
      </div>
    );
  }

  const sym0 = poolState?.token0Symbol ?? 'TK0';
  const sym1 = poolState?.token1Symbol ?? 'TK1';

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">OSVA Liquidity</h1>
          <p className="text-slate-400 text-sm">Pool: 0xbd2B…6484 · Sepolia</p>
        </div>
        <button onClick={fetchPoolState} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">↻</button>
      </div>

      {/* Pool info */}
      {poolState && (
        <div className="glass rounded-2xl p-4 mb-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-1">LP Balance</p>
            <p className="text-white font-bold">{fmtWei(userLpBalance)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Pool Share</p>
            <p className="text-amber-400 font-bold">{userShare.toFixed(3)}%</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Total LP</p>
            <p className="text-white font-bold">{fmtWei(poolState.totalSupply)}</p>
          </div>
        </div>
      )}

      {/* Tab selector */}
      <div className="flex gap-2 mb-4 bg-white/5 p-1 rounded-xl">
        {(['add', 'remove'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setAddError(null); setRemoveError(null); setAddResult(null); setRemoveResult(null); }}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all ${
              tab === t ? 'bg-gradient-to-r from-amber-500 to-violet-500 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'add' ? '+ Thêm Thanh Khoản' : '− Rút Thanh Khoản'}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl p-6">
        {tab === 'add' && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">Cung cấp cả hai token để nhận LP token.</p>

            {/* Token 0 input */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>{sym0}</span>
                <span>Số dư: {fmtWei(token0Balance)}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0"
                  value={add0}
                  onChange={e => handleAdd0Change(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent flex-1 text-2xl font-bold text-white outline-none placeholder-slate-600"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleAdd0Change(ethers.formatEther(token0Balance))}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 px-2 py-1 rounded"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="flex justify-center text-slate-500 text-xl">+</div>

            {/* Token 1 input */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>{sym1}</span>
                <span>Số dư: {fmtWei(token1Balance)}</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number" min="0"
                  value={add1}
                  onChange={e => handleAdd1Change(e.target.value)}
                  placeholder="0.00"
                  className="bg-transparent flex-1 text-2xl font-bold text-white outline-none placeholder-slate-600"
                  disabled={isLoading}
                />
                <button
                  onClick={() => handleAdd1Change(ethers.formatEther(token1Balance))}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold bg-amber-500/10 px-2 py-1 rounded"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Preview */}
            {(add0Wei > 0n || add1Wei > 0n) && (
              <div className="bg-white/5 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>LP token sẽ nhận</span>
                  <span className="text-emerald-400 font-semibold">≈ {fmtWei(lpToReceive)}</span>
                </div>
                {poolState && poolState.totalSupply > 0n && (
                  <div className="flex justify-between text-slate-400">
                    <span>Pool share sau</span>
                    <span className="text-white">
                      {Number(((userLpBalance + lpToReceive) * 10000n) / (poolState.totalSupply + lpToReceive)) / 100}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {addError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{addError}</div>
            )}
            {addResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-300 space-y-1">
                <p className="font-semibold">✓ Thêm thanh khoản thành công!</p>
                <p>LP nhận được: <strong>{fmtWei(addResult.shares)}</strong></p>
                <a href={`https://sepolia.etherscan.io/tx/${addResult.txHash}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                  Xem trên Etherscan ↗
                </a>
              </div>
            )}

            <button
              onClick={handleAddLiquidity}
              disabled={isLoading || !add0Wei || !add1Wei || isWrongNetwork}
              className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-amber-500 to-violet-500 hover:from-amber-400 hover:to-violet-400 text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Đang xử lý…' : 'Approve & Thêm Thanh Khoản'}
            </button>
          </div>
        )}

        {tab === 'remove' && (
          <div className="space-y-4">
            <p className="text-slate-400 text-sm">
              LP Balance của bạn: <strong className="text-white">{fmtWei(userLpBalance)} LP</strong>
            </p>

            {userLpBalance === 0n ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-4xl mb-3">💧</p>
                <p>Bạn chưa có LP token trong pool này.</p>
              </div>
            ) : (
              <>
                {/* Percentage slider */}
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">Tỷ lệ rút</span>
                    <span className="text-amber-400 font-bold">{removePct}%</span>
                  </div>
                  <input
                    type="range" min={0} max={100} value={removePct}
                    onChange={e => setRemovePct(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>0%</span>
                    {[25, 50, 75, 100].map(p => (
                      <button key={p} onClick={() => setRemovePct(p)} className="text-slate-400 hover:text-amber-400 transition-colors">
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Bạn sẽ nhận được</p>
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-slate-300">{sym0}</span>
                    </div>
                    <span className="text-white font-bold">{fmtWei(removePreview.amount0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-violet-400" />
                      <span className="text-slate-300">{sym1}</span>
                    </div>
                    <span className="text-white font-bold">{fmtWei(removePreview.amount1)}</span>
                  </div>
                  <div className="border-t border-white/5 pt-2 flex justify-between">
                    <span className="text-slate-400 text-sm">LP đốt</span>
                    <span className="text-red-400 font-semibold">{fmtWei(sharesToRemove)}</span>
                  </div>
                </div>

                {removeError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{removeError}</div>
                )}
                {removeResult && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-300 space-y-1">
                    <p className="font-semibold">✓ Rút thành công!</p>
                    <p>{sym0}: <strong>{fmtWei(removeResult.amount0)}</strong></p>
                    <p>{sym1}: <strong>{fmtWei(removeResult.amount1)}</strong></p>
                    <a href={`https://sepolia.etherscan.io/tx/${removeResult.txHash}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                      Xem trên Etherscan ↗
                    </a>
                  </div>
                )}

                <button
                  onClick={handleRemoveLiquidity}
                  disabled={isLoading || sharesToRemove === 0n || isWrongNetwork}
                  className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-red-500/80 to-red-600/80 hover:from-red-500 hover:to-red-600 text-white transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Đang xử lý…' : `Rút ${removePct}% Thanh Khoản`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Your position summary */}
      {poolState && userLpBalance > 0n && (
        <div className="mt-4 glass rounded-xl p-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Vị thế của bạn</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-400 text-xs">{sym0} ước tính</p>
              <p className="text-white font-semibold">{fmtWei(estimateRemoval(userLpBalance).amount0)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">{sym1} ước tính</p>
              <p className="text-white font-semibold">{fmtWei(estimateRemoval(userLpBalance).amount1)}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Pool share</p>
              <p className="text-amber-400 font-bold">{userShare.toFixed(4)}%</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">LP token</p>
              <p className="text-white font-semibold">{fmtWei(userLpBalance)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
