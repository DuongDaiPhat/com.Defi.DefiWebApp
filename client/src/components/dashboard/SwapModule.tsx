import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { ArrowDownUp, Settings, Fuel, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { useOsvaPool } from '../../hooks/useOsvaPool';
import { fetchOsvaQuote, type OsvaQuoteData } from '../../lib/osvaApi';
import { OSVA_POOL_ABI, OSVA_POOL_ADDRESS, SEPOLIA_HEX } from '../../lib/osvaAbi';
import { useWeb3 } from '../../hooks/useWeb3';

// ============================================================
//  Constants
// ============================================================

const SLIPPAGE_OPTIONS = [0.5, 1, 3];
const QUOTE_TTL = 60; // seconds

// ============================================================
//  Types
// ============================================================

type SwapStatus = 'idle' | 'fetching-quote' | 'approving' | 'swapping' | 'success' | 'error';

interface SwapResult {
  amountOut: string;
  alphaApplied: string;
  txHash: string;
}

// ============================================================
//  Helpers
// ============================================================

function formatWei(wei: bigint, decimals = 18, displayDecimals = 6): string {
  if (wei === 0n) return '0';
  const formatted = ethers.formatUnits(wei, decimals);
  const num = parseFloat(formatted);
  return num.toLocaleString(undefined, { maximumFractionDigits: displayDecimals, minimumFractionDigits: 0 });
}

function parseToWei(humanAmount: string, decimals = 18): bigint {
  try {
    if (!humanAmount || parseFloat(humanAmount) <= 0) return 0n;
    return ethers.parseUnits(humanAmount, decimals);
  } catch {
    return 0n;
  }
}

function mapRevertError(message: string): string {
  if (message.includes('AMM: EXPIRED_TRANSACTION')) return 'Quote expired — please get a new quote and try again.';
  if (message.includes('AMM: Slippage exceeded')) return 'Price moved too much — try increasing slippage tolerance.';
  if (message.includes('AMM: Invalid token')) return 'Invalid token selected.';
  if (message.includes('AMM: Empty pool')) return 'Pool has no liquidity. Please add liquidity first.';
  if (message.includes('AMM: Zero amountIn')) return 'Amount must be greater than zero.';
  if (message.includes('OSVA: Invalid Signature')) return 'Oracle signature invalid — please refresh the quote.';
  if (message.includes('user rejected')) return 'Transaction cancelled by user.';
  return message.length > 120 ? message.substring(0, 120) + '…' : message;
}

// ============================================================
//  Component
// ============================================================

export function SwapModule() {
  const { address, isConnected } = useWeb3();
  const pool = useOsvaPool(address);

  // Form state
  const [inputAmount, setInputAmount] = useState('');
  const [isFlipped, setIsFlipped] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [showSettings, setShowSettings] = useState(false);
  const [customSlippage, setCustomSlippage] = useState('');

  // Quote state
  const [quote, setQuote] = useState<OsvaQuoteData | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Swap status
  const [status, setStatus] = useState<SwapStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);

  // Derive tokens from pool
  const fromToken = isFlipped ? pool.token1 : pool.token0;
  const toToken = isFlipped ? pool.token0 : pool.token1;

  // Estimated output (live, from on-chain reserves)
  const amountInWei = parseToWei(inputAmount, fromToken?.decimals ?? 18);
  const currentAlpha = BigInt(quote?.alpha ?? 0);
  const { estimated: estimatedOutWei } = pool.estimateOutput(
    fromToken?.address ?? '', amountInWei, currentAlpha, slippage
  );
  const { minimum: minAmountOutWei } = pool.estimateOutput(
    fromToken?.address ?? '', amountInWei, currentAlpha, slippage
  );
  const estimatedOutDisplay = formatWei(estimatedOutWei, toToken?.decimals ?? 18);

  // Oracle indicator
  const oracleReady = !isFallback && quote !== null;

  // ── Countdown timer ──
  const startCountdown = useCallback((seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          setQuote(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // ── Ensure correct network ──
  const ensureSepolia = async () => {
    const chainId = await (window.ethereum as ethers.Eip1193Provider).request({ method: 'eth_chainId' });
    if (chainId !== SEPOLIA_HEX) {
      await (window.ethereum as ethers.Eip1193Provider).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_HEX }],
      });
    }
  };

  // ── Fetch quote from backend ──
  const getQuote = useCallback(async (): Promise<OsvaQuoteData | null> => {
    if (!address || !fromToken || amountInWei === 0n) return null;

    try {
      const q = await fetchOsvaQuote(address, fromToken.address, amountInWei.toString());
      setQuote(q);
      setIsFallback(false);
      startCountdown(QUOTE_TTL);
      return q;
    } catch {
      // Fallback V2 mode
      const fallbackDeadline = Math.floor(Date.now() / 1000) + 300;
      const fallbackQuote: OsvaQuoteData = { alpha: 0, deadline: fallbackDeadline, signature: '0x', signerAddress: '' };
      setQuote(fallbackQuote);
      setIsFallback(true);
      startCountdown(300);
      return fallbackQuote;
    }
  }, [address, fromToken, amountInWei, startCountdown]);

  // ── Main swap handler ──
  const handleSwap = async () => {
    if (!isConnected || !address || !fromToken || !toToken) return;
    setStatus('idle');
    setErrorMsg('');
    setSwapResult(null);

    try {
      // 1. Network check
      await ensureSepolia();

      // 2. Fetch fresh quote
      setStatus('fetching-quote');
      const activeQuote = await getQuote();
      if (!activeQuote) throw new Error('Could not get quote');

      const provider = new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
      const signer = await provider.getSigner();
      const pool_contract = new ethers.Contract(OSVA_POOL_ADDRESS, OSVA_POOL_ABI, signer);

      // 3. Check & approve allowance
      setStatus('approving');
      await pool.ensureAllowance(fromToken.address, amountInWei);

      // Recalculate minAmountOut with the signed alpha
      const signedAlpha = BigInt(activeQuote.alpha);
      const { minimum: freshMin } = pool.estimateOutput(fromToken.address, amountInWei, signedAlpha, slippage);

      // 4. Execute swap
      setStatus('swapping');
      const tx = await pool_contract.swapOSVA(
        fromToken.address,
        amountInWei,
        freshMin,
        BigInt(activeQuote.alpha),
        BigInt(activeQuote.deadline),
        activeQuote.signature
      );

      const receipt = await tx.wait();

      // 5. Decode Swap event
      const swapIface = new ethers.Interface([...OSVA_POOL_ABI]);
      let amountOutWei = 0n;
      let appliedAlpha = BigInt(activeQuote.alpha);

      for (const log of receipt?.logs ?? []) {
        try {
          const parsed = swapIface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'Swap') {
            amountOutWei = BigInt(parsed.args.amountOut.toString());
            appliedAlpha = BigInt(parsed.args.alpha.toString());
          }
        } catch { /* skip non-Swap logs */ }
      }

      setSwapResult({
        amountOut: formatWei(amountOutWei, toToken.decimals),
        alphaApplied: appliedAlpha.toString(),
        txHash: receipt?.hash ?? tx.hash,
      });
      setStatus('success');
      setInputAmount('');
      setQuote(null);
      pool.fetchPoolState(); // refresh balances
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const mapped = mapRevertError(raw);
      setErrorMsg(mapped);
      setStatus('error');
    }
  };

  // ── Swap tokens direction ──
  const flip = () => {
    setIsFlipped(f => !f);
    setInputAmount('');
    setQuote(null);
    setSwapResult(null);
    setStatus('idle');
  };

  // ── Effective slippage ──
  const effectiveSlippage = customSlippage ? parseFloat(customSlippage) || slippage : slippage;

  // ── Insufficient balance check ──
  const insufficientBalance = fromToken && amountInWei > fromToken.balance;

  // ── Button label ──
  const getButtonLabel = () => {
    if (!isConnected) return 'Connect Wallet';
    if (status === 'fetching-quote') return 'Getting quote…';
    if (status === 'approving') return 'Approving token…';
    if (status === 'swapping') return 'Confirming swap…';
    if (!inputAmount || amountInWei === 0n) return 'Enter an amount';
    if (insufficientBalance) return `Insufficient ${fromToken?.symbol} balance`;
    return isFallback ? 'Swap (Fallback V2)' : 'Swap';
  };

  const isSwapping = ['fetching-quote', 'approving', 'swapping'].includes(status);
  const swapDisabled = !isConnected || !inputAmount || amountInWei === 0n || !!insufficientBalance || isSwapping || pool.isLoading;

  return (
    <div className="max-w-lg mx-auto space-y-4">

      {/* Fallback banner */}
      <AnimatePresence>
        {isFallback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span><strong>Fallback V2 Mode</strong> — OSVA Oracle offline. Swap will use standard AMM (α=0).</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success banner */}
      <AnimatePresence>
        {status === 'success' && swapResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex flex-col gap-1 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span><strong>Swap Successful!</strong> Received {swapResult.amountOut} {toToken?.symbol} (α={swapResult.alphaApplied})</span>
            </div>
            <a
              href={`https://sepolia.etherscan.io/tx/${swapResult.txHash}`}
              target="_blank" rel="noreferrer"
              className="text-xs text-green-300/70 hover:text-green-300 underline ml-6"
            >
              View on Etherscan →
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-white/10 relative">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-display font-bold text-white">Swap</h2>
          <div className="flex items-center gap-3">
            {/* Oracle status */}
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${isFallback ? 'bg-amber-400' : oracleReady ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className={isFallback ? 'text-amber-400' : oracleReady ? 'text-green-400' : 'text-slate-400'}>
                {isFallback ? 'Fallback V2' : oracleReady ? `α=${quote.alpha}` : 'Oracle'}
              </span>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-[var(--color-text-muted)] hover:text-white transition-colors p-2 rounded-lg hover:bg-white/5"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Countdown */}
        <AnimatePresence>
          {countdown > 0 && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-xs text-slate-400 mb-4"
            >
              <Clock className="w-3 h-3" />
              <span>Quote expires in <strong className={countdown < 15 ? 'text-amber-400' : 'text-white'}>{countdown}s</strong></span>
              <div className="flex-1 bg-white/5 rounded-full h-1">
                <div
                  className={`h-1 rounded-full transition-all ${countdown < 15 ? 'bg-amber-400' : 'bg-[var(--color-primary)]'}`}
                  style={{ width: `${(countdown / QUOTE_TTL) * 100}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slippage settings */}
        {showSettings && (
          <div className="mb-6 bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 space-y-3">
            <p className="text-sm text-[var(--color-text-muted)]">Slippage Tolerance</p>
            <div className="flex gap-2">
              {SLIPPAGE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => { setSlippage(opt); setCustomSlippage(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    slippage === opt && !customSlippage
                      ? 'bg-[var(--color-primary)] text-slate-950'
                      : 'bg-white/5 text-[var(--color-text-muted)] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {opt}%
                </button>
              ))}
              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-2 flex-1">
                <input
                  type="number"
                  value={customSlippage}
                  onChange={e => { setCustomSlippage(e.target.value); setSlippage(parseFloat(e.target.value) || 0.5); }}
                  placeholder="Custom"
                  className="bg-transparent outline-none text-sm text-white w-full [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-slate-500 text-sm">%</span>
              </div>
            </div>
          </div>
        )}

        {/* From token input */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mb-2">
          <div className="flex justify-between text-sm mb-2 text-[var(--color-text-muted)]">
            <span>You pay</span>
            <span>
              Balance: {fromToken ? formatWei(fromToken.balance, fromToken.decimals, 4) : '—'} {fromToken?.symbol}
              {fromToken && (
                <button
                  onClick={() => setInputAmount(ethers.formatUnits(fromToken.balance, fromToken.decimals))}
                  className="ml-2 text-[var(--color-primary-light)] hover:underline text-xs"
                >MAX</button>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <input
              type="number"
              value={inputAmount}
              onChange={e => { setInputAmount(e.target.value); setQuote(null); setSwapResult(null); setStatus('idle'); }}
              className="bg-transparent text-3xl font-bold text-black dark:text-white outline-none min-w-0 flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.0"
              min="0"
            />
            <TokenBadge symbol={fromToken?.symbol ?? '…'} colored />
          </div>
          {insufficientBalance && (
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Insufficient balance</p>
          )}
        </div>

        {/* Switch direction */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={flip}
            className="w-10 h-10 bg-[var(--color-bg-elevated)] rounded-xl flex items-center justify-center border border-white/10 hover:border-white/30 cursor-pointer hover:text-[var(--color-primary-light)] transition-all shadow-lg active:scale-95"
          >
            <motion.div animate={{ rotate: isFlipped ? 180 : 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
              <ArrowDownUp className="w-5 h-5 flex-shrink-0" />
            </motion.div>
          </button>
        </div>

        {/* To token output */}
        <div className="bg-[var(--color-bg)]/50 rounded-xl p-4 border border-white/5 mt-2 mb-6">
          <div className="flex justify-between text-sm mb-2 text-[var(--color-text-muted)]">
            <span>You receive</span>
            <span>Balance: {toToken ? formatWei(toToken.balance, toToken.decimals, 4) : '—'} {toToken?.symbol}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-3xl font-bold text-white min-w-0 truncate">
              {estimatedOutWei > 0n ? estimatedOutDisplay : '0.0'}
            </span>
            <TokenBadge symbol={toToken?.symbol ?? '…'} />
          </div>
        </div>

        {/* Info row */}
        <div className="space-y-2 mb-6 text-sm">
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> OSVA α</span>
            <span className="text-white">{quote?.alpha ?? '—'} {isFallback && <span className="text-amber-400 text-xs ml-1">(Fallback)</span>}</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span>Slippage</span>
            <span className="text-white">{effectiveSlippage}%</span>
          </div>
          <div className="flex justify-between text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1"><Fuel className="w-3 h-3" /> Min. received</span>
            <span className="text-white">{minAmountOutWei > 0n ? formatWei(minAmountOutWei, toToken?.decimals ?? 18) : '—'} {toToken?.symbol}</span>
          </div>
        </div>

        {/* Error message */}
        <AnimatePresence>
          {status === 'error' && errorMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-400"
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swap button */}
        <Button
          onClick={handleSwap}
          isLoading={isSwapping}
          disabled={swapDisabled}
          className="w-full h-14 text-lg shadow-[var(--glow-gold)]"
        >
          {getButtonLabel()}
        </Button>
      </Card>
    </div>
  );
}

// ── Small helper component ──
function TokenBadge({ symbol, colored = false }: { symbol: string; colored?: boolean }) {
  return (
    <div className={`shrink-0 flex items-center gap-2 rounded-xl px-3 py-2 border ${
      colored ? 'bg-[var(--color-primary)]/20 border-[var(--color-primary)]/30' : 'bg-slate-700/40 border-slate-600/30'
    }`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
        colored ? 'bg-[var(--color-primary)]' : 'bg-slate-600'
      }`}>
        {symbol.charAt(0)}
      </div>
      <span className="font-semibold text-white">{symbol}</span>
    </div>
  );
}
