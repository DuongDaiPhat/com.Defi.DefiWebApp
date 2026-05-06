import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from '../hooks/useWeb3';
import { useOSVA, computeOSVAOut, type SwapQuoteState } from '../hooks/useOSVA';

const SLIPPAGE_OPTIONS = [0.5, 1, 3];
const QUOTE_TTL = 60; // seconds

function formatToken(wei: bigint, dp = 6): string {
  if (wei === 0n) return '0';
  const formatted = ethers.formatEther(wei);
  const num = parseFloat(formatted);
  if (num < 0.000001) return '< 0.000001';
  return num.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 2 });
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SwapPage() {
  const { isConnected, connect, address, isWrongNetwork, chainId } = useWeb3();
  const {
    poolState,
    token0Balance,
    token1Balance,
    isLoading,
    fetchPoolState,
    fetchSwapQuote,
    executeSwap,
  } = useOSVA();

  // Token direction: true = token0 → token1, false = token1 → token0
  const [isToken0In, setIsToken0In]   = useState(true);
  const [amountIn, setAmountIn]       = useState('');
  const [slippage, setSlippage]       = useState(1);
  const [customSlippage, setCustomSlippage] = useState('');
  const [showCustom, setShowCustom]   = useState(false);

  const [quoteState, setQuoteState]   = useState<SwapQuoteState | null>(null);
  const [countdown, setCountdown]     = useState<number>(0);
  const [txResult, setTxResult]       = useState<{ amountOut: bigint; alpha: bigint; hash: string } | null>(null);
  const [swapError, setSwapError]     = useState<string | null>(null);
  const [phase, setPhase]             = useState<'idle' | 'quoting' | 'approving' | 'swapping' | 'done'>('idle');

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const quoteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────
  const tokenIn  = poolState ? (isToken0In ? poolState.token0 : poolState.token1) : '';
  const symIn    = poolState ? (isToken0In ? poolState.token0Symbol : poolState.token1Symbol) : '—';
  const symOut   = poolState ? (isToken0In ? poolState.token1Symbol : poolState.token0Symbol) : '—';
  const balIn    = isToken0In ? token0Balance : token1Balance;
  const balOut   = isToken0In ? token1Balance : token0Balance;

  const activeSlippage = showCustom ? (parseFloat(customSlippage) || 1) : slippage;

  const amountInWei: bigint = (() => {
    try { return amountIn ? ethers.parseEther(amountIn) : 0n; } catch { return 0n; }
  })();

  const insufficientBalance = amountInWei > 0n && amountInWei > balIn;

  // ── Quote countdown ─────────────────────────────────────────────────
  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(QUOTE_TTL);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setQuoteState(null); // expired
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Auto-quote on input change ───────────────────────────────────────
  useEffect(() => {
    if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current);
    if (!amountInWei || amountInWei === 0n || !address || !poolState) {
      setQuoteState(null);
      return;
    }
    quoteDebounceRef.current = setTimeout(async () => {
      setPhase('quoting');
      setSwapError(null);
      const qs = await fetchSwapQuote(tokenIn, amountInWei, activeSlippage);
      setQuoteState(qs);
      setPhase('idle');
      if (qs.quote) startCountdown();
    }, 600);

    return () => { if (quoteDebounceRef.current) clearTimeout(quoteDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountIn, isToken0In, activeSlippage, address, poolState]);

  // Cleanup on unmount
  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // ── Switch direction ─────────────────────────────────────────────────
  const handleFlip = () => {
    setIsToken0In(prev => !prev);
    setAmountIn('');
    setQuoteState(null);
    setCountdown(0);
    setTxResult(null);
    setSwapError(null);
  };

  // ── Switch network ───────────────────────────────────────────────────
  const handleSwitchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await (window.ethereum as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }],
      });
    } catch (e: any) {
      if (e.code === 4902) {
        await (window.ethereum as any).request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xaa36a7',
            chainName: 'Sepolia Testnet',
            rpcUrls: ['https://rpc.sepolia.org'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      }
    }
  };

  // ── Swap handler ──────────────────────────────────────────────────────
  const handleSwap = async () => {
    if (!quoteState) return;
    setSwapError(null);
    setTxResult(null);

    try {
      if (phase === 'idle') {
        setPhase('approving');
        const result = await executeSwap(tokenIn, amountInWei, quoteState);
        setPhase('done');
        setTxResult({ amountOut: result.amountOut, alpha: result.appliedAlpha, hash: result.txHash });
        setAmountIn('');
        setQuoteState(null);
        setCountdown(0);
        setTimeout(() => setPhase('idle'), 5000);
      }
    } catch (err: any) {
      setSwapError(err?.reason ?? err?.message ?? 'Swap thất bại');
      setPhase('idle');
    }
  };

  // ── Set max ──────────────────────────────────────────────────────────
  const handleMax = () => {
    setAmountIn(ethers.formatEther(balIn));
  };

  // ── Estimated output (live preview while quoting) ────────────────────
  const liveEstimateOut: bigint = (() => {
    if (quoteState) return quoteState.estimatedOut;
    if (!poolState || amountInWei === 0n) return 0n;
    const rIn  = isToken0In ? poolState.reserve0 : poolState.reserve1;
    const rOut = isToken0In ? poolState.reserve1 : poolState.reserve0;
    return computeOSVAOut(rIn, rOut, amountInWei, 0); // alpha=0 until quote arrives
  })();

  // ── V2 baseline for "better than V2" label ───────────────────────────
  const v2EstimateOut: bigint = (() => {
    if (!poolState || amountInWei === 0n) return 0n;
    const rIn  = isToken0In ? poolState.reserve0 : poolState.reserve1;
    const rOut = isToken0In ? poolState.reserve1 : poolState.reserve0;
    return computeOSVAOut(rIn, rOut, amountInWei, 0);
  })();

  const alphaBenefit = quoteState?.quote
    ? (quoteState.quote.alpha > 0 && v2EstimateOut > 0n
        ? Number(((liveEstimateOut - v2EstimateOut) * 10000n) / v2EstimateOut) / 100
        : 0)
    : 0;

  // ─────────────────────────────────────────────────────────────────────
  // Not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-violet-600/20 flex items-center justify-center mb-6 border border-amber-500/20">
          <span className="text-4xl">⚡</span>
        </div>
        <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-amber-400 to-violet-400 bg-clip-text text-transparent">
          OSVA Swap
        </h2>
        <p className="text-slate-400 mb-8 max-w-sm">
          Kết nối ví để swap token với thanh khoản ảo được khuếch đại bởi Oracle off-chain.
        </p>
        <button
          onClick={() => connect()}
          className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/25"
        >
          Kết nối MetaMask
        </button>
      </div>
    );
  }

  const swapButtonLabel = () => {
    if (isWrongNetwork) return 'Chuyển sang Sepolia';
    if (phase === 'quoting') return 'Đang lấy quote…';
    if (phase === 'approving') return 'Đang approve…';
    if (phase === 'swapping') return 'Đang swap…';
    if (phase === 'done') return '✓ Swap thành công!';
    if (insufficientBalance) return `Không đủ ${symIn}`;
    if (!amountIn || amountInWei === 0n) return 'Nhập số lượng';
    if (!quoteState) return 'Đang tính…';
    return `Swap ${symIn} → ${symOut}`;
  };

  const swapButtonDisabled =
    isLoading ||
    phase === 'quoting' ||
    phase === 'approving' ||
    phase === 'swapping' ||
    (!isWrongNetwork && (insufficientBalance || !quoteState || amountInWei === 0n || phase === 'done'));

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">OSVA Swap</h1>
          <p className="text-slate-400 text-sm">Off-chain Signed Virtual Amplification</p>
        </div>
        <button
          onClick={() => fetchPoolState()}
          className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
          title="Làm mới"
        >
          ↻
        </button>
      </div>

      {/* Wrong network banner */}
      {isWrongNetwork && (
        <div className="mb-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center justify-between">
          <div>
            <p className="text-red-400 font-semibold text-sm">Sai mạng (Chain ID: {chainId})</p>
            <p className="text-red-400/70 text-xs">Vui lòng chuyển sang Sepolia Testnet</p>
          </div>
          <button
            onClick={handleSwitchNetwork}
            className="bg-red-500 hover:bg-red-400 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            Switch
          </button>
        </div>
      )}

      {/* Main card */}
      <div className="glass rounded-2xl p-6 space-y-4">

        {/* Oracle status */}
        <div className="flex items-center justify-between">
          {quoteState?.isFallback ? (
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Fallback V2 — {quoteState.fallbackReason}</span>
            </div>
          ) : phase === 'quoting' ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
              <span>Đang kết nối Oracle…</span>
            </div>
          ) : quoteState?.quote ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Oracle sẵn sàng · α = {quoteState.quote.alpha}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              <span>Nhập số lượng để lấy quote</span>
            </div>
          )}

          {/* Countdown */}
          {countdown > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6">
                <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                  <circle
                    cx="12" cy="12" r="9" fill="none"
                    stroke={countdown < 10 ? '#ef4444' : '#f59e0b'}
                    strokeWidth="2.5"
                    strokeDasharray={`${2 * Math.PI * 9}`}
                    strokeDashoffset={`${2 * Math.PI * 9 * (1 - countdown / QUOTE_TTL)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
              </div>
              <span className={`text-xs font-mono ${countdown < 10 ? 'text-red-400' : 'text-amber-400'}`}>
                {countdown}s
              </span>
            </div>
          )}
        </div>

        {/* Token In */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Bạn trả</span>
            <span>
              Số dư: {formatToken(balIn)} {symIn}
              <button onClick={handleMax} className="ml-2 text-amber-400 hover:text-amber-300 font-semibold">MAX</button>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={amountIn}
              onChange={e => { setAmountIn(e.target.value); setTxResult(null); setSwapError(null); }}
              placeholder="0.00"
              min="0"
              className="bg-transparent flex-1 text-3xl font-bold text-white outline-none placeholder-slate-600"
              disabled={isLoading || phase !== 'idle'}
            />
            <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg shrink-0">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="font-bold text-white">{symIn}</span>
            </div>
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center -my-1">
          <button
            onClick={handleFlip}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/30 text-slate-400 hover:text-amber-400 transition-all flex items-center justify-center text-lg font-bold"
          >
            ⇅
          </button>
        </div>

        {/* Token Out */}
        <div className="bg-violet-500/5 border border-violet-500/15 rounded-xl p-4">
          <div className="flex justify-between text-xs text-violet-300/70 mb-2">
            <span>Bạn nhận (ước tính)</span>
            <span>Số dư: {formatToken(balOut)} {symOut}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 text-3xl font-bold text-violet-300">
              {phase === 'quoting'
                ? <span className="animate-pulse text-slate-500">…</span>
                : formatToken(liveEstimateOut)
              }
            </div>
            <div className="flex items-center gap-2 bg-violet-500/10 px-3 py-2 rounded-lg shrink-0">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="font-bold text-violet-200">{symOut}</span>
            </div>
          </div>
          {alphaBenefit > 0 && (
            <div className="mt-2 text-xs text-emerald-400 font-medium">
              ✓ +{alphaBenefit.toFixed(3)}% so với Uniswap V2 (α={quoteState?.quote?.alpha})
            </div>
          )}
        </div>

        {/* Slippage selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Slippage tolerance</span>
            <span className="text-xs text-amber-400 font-semibold">{activeSlippage}%</span>
          </div>
          <div className="flex gap-2">
            {SLIPPAGE_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setSlippage(s); setShowCustom(false); }}
                className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  !showCustom && slippage === s
                    ? 'bg-amber-500 text-black'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {s}%
              </button>
            ))}
            <button
              onClick={() => setShowCustom(true)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                showCustom ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              Custom
            </button>
          </div>
          {showCustom && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                value={customSlippage}
                onChange={e => setCustomSlippage(e.target.value)}
                placeholder="1.5"
                className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none w-24"
              />
              <span className="text-slate-400 text-sm">%</span>
            </div>
          )}
        </div>

        {/* Quote details */}
        {quoteState?.quote && !quoteState.isFallback && (
          <div className="bg-white/5 rounded-xl p-3 space-y-1.5 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Hệ số khuếch đại (α)</span>
              <span className="text-amber-400 font-semibold">{quoteState.quote.alpha} / 100</span>
            </div>
            <div className="flex justify-between">
              <span>Min nhận được</span>
              <span className="text-white">{formatToken(quoteState.minAmountOut)} {symOut}</span>
            </div>
            <div className="flex justify-between">
              <span>Oracle signer</span>
              <span className="text-slate-300 font-mono">{shortenAddress(quoteState.quote.signerAddress)}</span>
            </div>
            <div className="flex justify-between">
              <span>Phí swap</span>
              <span className="text-white">0.3%</span>
            </div>
          </div>
        )}

        {quoteState?.isFallback && quoteState.quote && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
            <p className="font-semibold mb-1">⚠️ Chế độ Fallback V2</p>
            <p>Swap sẽ thực hiện không có khuếch đại thanh khoản ảo (α=0). Kết quả tương đương Uniswap V2.</p>
          </div>
        )}

        {/* Error */}
        {swapError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
            {swapError}
          </div>
        )}

        {/* Success */}
        {txResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-sm text-emerald-300 space-y-1">
            <p className="font-semibold">✓ Swap thành công!</p>
            <p>Nhận được: <strong>{formatToken(txResult.amountOut)} {symOut}</strong></p>
            <p>Alpha áp dụng: <strong>{txResult.alpha.toString()}</strong></p>
            <a
              href={`https://sepolia.etherscan.io/tx/${txResult.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline block"
            >
              Xem trên Etherscan ↗
            </a>
          </div>
        )}

        {/* Swap button */}
        <button
          onClick={isWrongNetwork ? handleSwitchNetwork : handleSwap}
          disabled={swapButtonDisabled}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            isWrongNetwork
              ? 'bg-red-500 hover:bg-red-400 text-white'
              : phase === 'done'
              ? 'bg-emerald-500 text-white cursor-default'
              : swapButtonDisabled
              ? 'bg-white/10 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/25'
          }`}
        >
          {swapButtonLabel()}
        </button>

      </div>

      {/* Pool info */}
      {poolState && (
        <div className="mt-4 glass rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-1">Reserve {poolState.token0Symbol}</p>
            <p className="text-white font-semibold">{formatToken(poolState.reserve0, 4)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Reserve {poolState.token1Symbol}</p>
            <p className="text-white font-semibold">{formatToken(poolState.reserve1, 4)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Pool</p>
            <a
              href={`https://sepolia.etherscan.io/address/0xbd2B2030c82DD76bbEe0F361525Ac36b5A6d6484`}
              target="_blank" rel="noopener noreferrer"
              className="text-violet-400 hover:underline font-mono text-xs"
            >
              0xbd2B…6484 ↗
            </a>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">LP Supply</p>
            <p className="text-white font-semibold">{formatToken(poolState.totalSupply, 4)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
