import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { motion } from 'framer-motion';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Droplets, Minus, AlertTriangle } from 'lucide-react';
import { useOsvaPool } from '../../hooks/useOsvaPool';
import { useWeb3 } from '../../hooks/useWeb3';
import { OSVA_POOL_ABI, OSVA_POOL_ADDRESS } from '../../lib/osvaAbi';

const DEADLINE_SECONDS = 300n;

function formatWei(wei: bigint, decimals = 18, dp = 6) {
  if (wei === 0n) return '0';
  return parseFloat(ethers.formatUnits(wei, decimals)).toLocaleString(undefined, { maximumFractionDigits: dp });
}

type Mode = 'add' | 'remove';

export function LiquidityPanel() {
  const { address, isConnected } = useWeb3();
  const pool = useOsvaPool(address);

  const [mode, setMode] = useState<Mode>('add');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [removePercent, setRemovePercent] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { token0, token1, reserve0, reserve1, totalSupply, lpBalance } = pool;

  // Auto-calc amount1 when amount0 changes
  useEffect(() => {
    if (!amount0 || reserve0 === 0n || reserve1 === 0n) return;
    try {
      const a0Wei = ethers.parseUnits(amount0, token0?.decimals ?? 18);
      const a1Wei = (a0Wei * reserve1) / reserve0;
      setAmount1(parseFloat(ethers.formatUnits(a1Wei, token1?.decimals ?? 18)).toFixed(6));
    } catch { /* ignore parse errors */ }
  }, [amount0, reserve0, reserve1, token0?.decimals, token1?.decimals]);

  // Shares to remove based on %
  const sharesToRemove = lpBalance > 0n ? (lpBalance * BigInt(removePercent)) / 100n : 0n;
  const previewAmt0 = totalSupply > 0n ? (sharesToRemove * reserve0) / totalSupply : 0n;
  const previewAmt1 = totalSupply > 0n ? (sharesToRemove * reserve1) / totalSupply : 0n;

  const poolSharePct = totalSupply > 0n
    ? ((Number(lpBalance) / Number(totalSupply)) * 100).toFixed(4)
    : '0.0000';

  const handleAddLiquidity = useCallback(async () => {
    if (!isConnected || !address || !token0 || !token1) return;
    setError(''); setSuccessMsg(''); setIsLoading(true);
    try {
      const a0Wei = ethers.parseUnits(amount0 || '0', token0.decimals);
      const a1Wei = ethers.parseUnits(amount1 || '0', token1.decimals);
      if (a0Wei === 0n || a1Wei === 0n) throw new Error('Enter amounts for both tokens');

      // Approve both tokens
      await pool.ensureAllowance(token0.address, a0Wei);
      await pool.ensureAllowance(token1.address, a1Wei);

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(OSVA_POOL_ADDRESS, OSVA_POOL_ABI, signer);
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;

      const tx = await contract.addLiquidity(a0Wei, a1Wei, deadline);
      const receipt = await tx.wait();
      setSuccessMsg(`Liquidity added! TX: ${receipt?.hash?.slice(0, 18)}…`);
      setAmount0(''); setAmount1('');
      pool.fetchPoolState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, amount0, amount1, token0, token1, pool]);

  const handleRemoveLiquidity = useCallback(async () => {
    if (!isConnected || !address || sharesToRemove === 0n) return;
    setError(''); setSuccessMsg(''); setIsLoading(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(OSVA_POOL_ADDRESS, OSVA_POOL_ABI, signer);
      const deadline = BigInt(Math.floor(Date.now() / 1000)) + DEADLINE_SECONDS;

      const tx = await contract.removeLiquidity(sharesToRemove, deadline);
      const receipt = await tx.wait();
      setSuccessMsg(`Liquidity removed! TX: ${receipt?.hash?.slice(0, 18)}…`);
      pool.fetchPoolState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, sharesToRemove, pool]);

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Card className="border-white/10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Droplets className="w-5 h-5 text-[var(--color-primary)]" />
          <h2 className="text-2xl font-display font-bold text-white">Liquidity</h2>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-white/5 rounded-xl p-1 gap-1 mb-6">
          {(['add', 'remove'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccessMsg(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${
                mode === m ? 'bg-[var(--color-primary)] text-slate-950' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {m === 'add' ? '+ Add' : '− Remove'} Liquidity
            </button>
          ))}
        </div>

        {/* Pool info */}
        <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Your LP Balance</span>
            <span className="text-white font-mono">{formatWei(lpBalance, 18, 6)} OSVA-LP</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Pool Share</span>
            <span className="text-white">{poolSharePct}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{token0?.symbol ?? 'Token0'} in position</span>
            <span className="text-white">{totalSupply > 0n ? formatWei((lpBalance * reserve0) / totalSupply, token0?.decimals ?? 18) : '0'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">{token1?.symbol ?? 'Token1'} in position</span>
            <span className="text-white">{totalSupply > 0n ? formatWei((lpBalance * reserve1) / totalSupply, token1?.decimals ?? 18) : '0'}</span>
          </div>
        </div>

        {/* Add Liquidity */}
        {mode === 'add' && (
          <div className="space-y-3">
            {[
              { label: token0?.symbol ?? 'Token 0', value: amount0, onChange: setAmount0, bal: token0?.balance ?? 0n, dec: token0?.decimals ?? 18 },
              { label: token1?.symbol ?? 'Token 1', value: amount1, onChange: setAmount1, bal: token1?.balance ?? 0n, dec: token1?.decimals ?? 18, readonly: true },
            ].map(({ label, value, onChange, bal, dec, readonly }) => (
              <div key={label} className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between text-xs text-slate-400 mb-2">
                  <span>{label}</span>
                  <span>Balance: {formatWei(bal, dec, 4)}</span>
                </div>
                <input
                  type="number"
                  value={value}
                  onChange={e => onChange(e.target.value)}
                  readOnly={readonly}
                  placeholder="0.0"
                  className="bg-transparent text-2xl font-bold text-black dark:text-white outline-none w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            ))}
            <Button onClick={handleAddLiquidity} isLoading={isLoading} disabled={!isConnected || isLoading} className="w-full h-12">
              {isConnected ? 'Add Liquidity' : 'Connect Wallet'}
            </Button>
          </div>
        )}

        {/* Remove Liquidity */}
        {mode === 'remove' && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Remove Amount</span>
                <span className="text-white font-semibold">{removePercent}%</span>
              </div>
              <input
                type="range" min={1} max={100} value={removePercent}
                onChange={e => setRemovePercent(Number(e.target.value))}
                className="w-full accent-[var(--color-primary)]"
              />
              <div className="flex gap-2 mt-2">
                {[25, 50, 75, 100].map(p => (
                  <button
                    key={p}
                    onClick={() => setRemovePercent(p)}
                    className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all ${
                      removePercent === p ? 'bg-[var(--color-primary)] text-slate-950' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {p === 100 ? 'MAX' : `${p}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 space-y-2 text-sm">
              <p className="text-slate-400 text-xs mb-1">You will receive</p>
              <div className="flex justify-between">
                <span className="text-slate-300">{token0?.symbol ?? 'Token0'}</span>
                <span className="text-white font-mono">{formatWei(previewAmt0, token0?.decimals ?? 18)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">{token1?.symbol ?? 'Token1'}</span>
                <span className="text-white font-mono">{formatWei(previewAmt1, token1?.decimals ?? 18)}</span>
              </div>
              <div className="flex justify-between border-t border-white/5 pt-2">
                <span className="text-slate-300 flex items-center gap-1"><Minus className="w-3 h-3" /> LP Burned</span>
                <span className="text-white font-mono">{formatWei(sharesToRemove)} OSVA-LP</span>
              </div>
            </div>

            <Button
              onClick={handleRemoveLiquidity}
              isLoading={isLoading}
              disabled={!isConnected || isLoading || sharesToRemove === 0n}
              className="w-full h-12"
            >
              {isConnected ? 'Remove Liquidity' : 'Connect Wallet'}
            </Button>
          </div>
        )}

        {/* Feedback */}
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
        {successMsg && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-green-400 text-center">
            ✓ {successMsg}
          </motion.p>
        )}
      </Card>
    </div>
  );
}
