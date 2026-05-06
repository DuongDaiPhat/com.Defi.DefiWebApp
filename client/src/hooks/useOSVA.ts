import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from './useWeb3';
import { OSVAPoolABI } from '../lib/abis/OSVAPool.abi';
import { TokenABI } from '../lib/abis/Token.abi';
import {
  getOSVAQuote,
  makeFallbackQuote,
  OSVAQuoteError,
  type OSVAQuote,
} from '../lib/osvaApi';

// ── Config ─────────────────────────────────────────────────────────────
export const OSVA_POOL_ADDRESS = '0xbd2B2030c82DD76bbEe0F361525Ac36b5A6d6484';

// ── Types ──────────────────────────────────────────────────────────────
export interface PoolState {
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

export interface SwapResult {
  amountOut: bigint;
  appliedAlpha: bigint;
  txHash: string;
}

export interface LiquidityResult {
  amount0: bigint;
  amount1: bigint;
  shares: bigint;
  txHash: string;
}

export interface SwapQuoteState {
  quote: OSVAQuote | null;
  isFallback: boolean;
  fallbackReason: string;
  estimatedOut: bigint;
  minAmountOut: bigint;
}

// ── OSVA formula (pure BigInt, no floating point) ─────────────────────
/**
 * estimatedOut = virtualReserveOut * amountInWithFee / (virtualReserveIn + amountInWithFee)
 * - virtualReserveX = reserveX + reserveX * alpha  = reserveX * (1 + alpha)
 * - amountInWithFee = amountIn * 997 / 1000
 * - alpha is a plain integer (0–100), same as on-chain
 */
export function computeOSVAOut(
  reserveIn: bigint,
  reserveOut: bigint,
  amountIn: bigint,
  alpha: number,
): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amountIn === 0n) return 0n;
  const a = BigInt(alpha);
  const virtualIn  = reserveIn  + reserveIn  * a;   // reserveIn  * (1 + alpha)
  const virtualOut = reserveOut + reserveOut * a;   // reserveOut * (1 + alpha)
  const amountWithFee = (amountIn * 997n) / 1000n;
  return (virtualOut * amountWithFee) / (virtualIn + amountWithFee);
}

export function computeMinAmountOut(estimatedOut: bigint, slippagePct: number): bigint {
  // slippagePct is e.g. 0.5, 1, 3
  const numerator   = BigInt(Math.round((100 - slippagePct) * 100));
  return (estimatedOut * numerator) / 10000n;
}

// ── Hook ───────────────────────────────────────────────────────────────
export function useOSVA() {
  const { provider, address: account } = useWeb3();

  const [poolState, setPoolState]       = useState<PoolState | null>(null);
  const [userLpBalance, setUserLpBalance] = useState<bigint>(0n);
  const [token0Balance, setToken0Balance] = useState<bigint>(0n);
  const [token1Balance, setToken1Balance] = useState<bigint>(0n);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // ── Pool state loader ─────────────────────────────────────────────
  const fetchPoolState = useCallback(async () => {
    if (!provider) return;
    try {
      const pool = new ethers.Contract(OSVA_POOL_ADDRESS, OSVAPoolABI, provider);
      const [t0, t1, r0, r1, ts] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.reserve0(),
        pool.reserve1(),
        pool.totalSupply(),
      ]);

      // Fetch token symbols
      const token0Contract = new ethers.Contract(t0, TokenABI, provider);
      const token1Contract = new ethers.Contract(t1, TokenABI, provider);
      const [sym0, sym1] = await Promise.all([
        token0Contract.symbol().catch(() => 'TK0'),
        token1Contract.symbol().catch(() => 'TK1'),
      ]);

      setPoolState({
        token0: t0,
        token1: t1,
        token0Symbol: sym0,
        token1Symbol: sym1,
        reserve0: BigInt(r0.toString()),
        reserve1: BigInt(r1.toString()),
        totalSupply: BigInt(ts.toString()),
      });

      // Update user balances too when pool state refreshes
      if (account) {
        const pool2 = new ethers.Contract(OSVA_POOL_ADDRESS, OSVAPoolABI, provider);
        const tk0   = new ethers.Contract(t0, TokenABI, provider);
        const tk1   = new ethers.Contract(t1, TokenABI, provider);
        const [lp, b0, b1] = await Promise.all([
          pool2.balanceOf(account),
          tk0.balanceOf(account),
          tk1.balanceOf(account),
        ]);
        setUserLpBalance(BigInt(lp.toString()));
        setToken0Balance(BigInt(b0.toString()));
        setToken1Balance(BigInt(b1.toString()));
      }
    } catch (err) {
      console.error('[useOSVA] fetchPoolState error', err);
    }
  }, [provider, account]);

  useEffect(() => {
    fetchPoolState();
  }, [fetchPoolState]);

  // ── Quote + swap estimate ─────────────────────────────────────────
  /**
   * Fetches a backend quote and returns computed swap state.
   * Automatically falls back to V2 mode (alpha=0) on any backend error.
   */
  const fetchSwapQuote = useCallback(
    async (
      tokenInAddress: string,
      amountInWei: bigint,
      slippagePct: number,
    ): Promise<SwapQuoteState> => {
      if (!account || !poolState || amountInWei === 0n) {
        return { quote: null, isFallback: false, fallbackReason: '', estimatedOut: 0n, minAmountOut: 0n };
      }

      const isToken0In = tokenInAddress.toLowerCase() === poolState.token0.toLowerCase();
      const reserveIn  = isToken0In ? poolState.reserve0 : poolState.reserve1;
      const reserveOut = isToken0In ? poolState.reserve1 : poolState.reserve0;

      let quote: OSVAQuote;
      let isFallback = false;
      let fallbackReason = '';

      try {
        quote = await getOSVAQuote(account, tokenInAddress, amountInWei.toString());
      } catch (err) {
        isFallback = true;
        if (err instanceof OSVAQuoteError) {
          if (err.kind === 'network') fallbackReason = 'Backend offline — chế độ Fallback V2';
          else if (err.kind === 'oracle_not_ready') fallbackReason = 'Oracle đang khởi động — Fallback V2';
          else fallbackReason = err.message;
        } else {
          fallbackReason = 'Lỗi không xác định — Fallback V2';
        }
        quote = makeFallbackQuote();
      }

      const estimatedOut = computeOSVAOut(reserveIn, reserveOut, amountInWei, quote.alpha);
      const minAmountOut = computeMinAmountOut(estimatedOut, slippagePct);

      return { quote, isFallback, fallbackReason, estimatedOut, minAmountOut };
    },
    [account, poolState],
  );

  // ── Swap execution ────────────────────────────────────────────────
  const executeSwap = useCallback(
    async (
      tokenInAddress: string,
      amountInWei: bigint,
      swapQuote: SwapQuoteState,
    ): Promise<SwapResult> => {
      if (!provider || !account) throw new Error('Wallet not connected');
      if (!swapQuote.quote) throw new Error('No quote available');

      setIsLoading(true);
      setError(null);
      try {
        const signer   = await provider.getSigner();
        const pool     = new ethers.Contract(OSVA_POOL_ADDRESS, OSVAPoolABI, signer);
        const tokenIn  = new ethers.Contract(tokenInAddress, TokenABI, signer);

        // Check allowance and approve if needed
        const allowance: bigint = BigInt((await tokenIn.allowance(account, OSVA_POOL_ADDRESS)).toString());
        if (allowance < amountInWei) {
          const approveTx = await tokenIn.approve(OSVA_POOL_ADDRESS, amountInWei);
          await approveTx.wait();
        }

        const { alpha, deadline, signature } = swapQuote.quote;
        const minOut = swapQuote.minAmountOut;

        const tx = await pool.swapOSVA(
          tokenInAddress,
          amountInWei,
          minOut,
          BigInt(alpha),
          BigInt(deadline),
          signature,
        );
        const receipt = await tx.wait();

        // Decode Swap event
        const swapEvent = receipt.logs
          .map((log: any) => { try { return pool.interface.parseLog(log); } catch { return null; } })
          .find((e: any) => e?.name === 'Swap');

        const amountOut   = swapEvent ? BigInt(swapEvent.args.amountOut.toString()) : 0n;
        const appliedAlpha = swapEvent ? BigInt(swapEvent.args.alpha.toString()) : BigInt(alpha);

        await fetchPoolState();
        return { amountOut, appliedAlpha, txHash: receipt.hash };
      } finally {
        setIsLoading(false);
      }
    },
    [provider, account, fetchPoolState],
  );

  // ── Add Liquidity ─────────────────────────────────────────────────
  const addLiquidity = useCallback(
    async (amount0Wei: bigint, amount1Wei: bigint): Promise<LiquidityResult> => {
      if (!provider || !account || !poolState) throw new Error('Not ready');

      setIsLoading(true);
      setError(null);
      try {
        const signer   = await provider.getSigner();
        const pool     = new ethers.Contract(OSVA_POOL_ADDRESS, OSVAPoolABI, signer);
        const tk0      = new ethers.Contract(poolState.token0, TokenABI, signer);
        const tk1      = new ethers.Contract(poolState.token1, TokenABI, signer);

        // Approve both tokens
        const [allow0, allow1] = await Promise.all([
          tk0.allowance(account, OSVA_POOL_ADDRESS),
          tk1.allowance(account, OSVA_POOL_ADDRESS),
        ]);
        if (BigInt(allow0.toString()) < amount0Wei) {
          const t = await tk0.approve(OSVA_POOL_ADDRESS, amount0Wei); await t.wait();
        }
        if (BigInt(allow1.toString()) < amount1Wei) {
          const t = await tk1.approve(OSVA_POOL_ADDRESS, amount1Wei); await t.wait();
        }

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
        const tx = await pool.addLiquidity(amount0Wei, amount1Wei, deadline);
        const receipt = await tx.wait();

        const ev = receipt.logs
          .map((log: any) => { try { return pool.interface.parseLog(log); } catch { return null; } })
          .find((e: any) => e?.name === 'LiquidityAdded');

        await fetchPoolState();
        return {
          amount0: ev ? BigInt(ev.args.amount0.toString()) : amount0Wei,
          amount1: ev ? BigInt(ev.args.amount1.toString()) : amount1Wei,
          shares:  ev ? BigInt(ev.args.shares.toString())  : 0n,
          txHash: receipt.hash,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [provider, account, poolState, fetchPoolState],
  );

  // ── Remove Liquidity ──────────────────────────────────────────────
  const removeLiquidity = useCallback(
    async (sharesWei: bigint): Promise<LiquidityResult> => {
      if (!provider || !account) throw new Error('Wallet not connected');

      setIsLoading(true);
      setError(null);
      try {
        const signer  = await provider.getSigner();
        const pool    = new ethers.Contract(OSVA_POOL_ADDRESS, OSVAPoolABI, signer);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

        const tx      = await pool.removeLiquidity(sharesWei, deadline);
        const receipt = await tx.wait();

        const ev = receipt.logs
          .map((log: any) => { try { return pool.interface.parseLog(log); } catch { return null; } })
          .find((e: any) => e?.name === 'LiquidityRemoved');

        await fetchPoolState();
        return {
          amount0: ev ? BigInt(ev.args.amount0.toString()) : 0n,
          amount1: ev ? BigInt(ev.args.amount1.toString()) : 0n,
          shares:  sharesWei,
          txHash: receipt.hash,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [provider, account, fetchPoolState],
  );

  // ── Preview helpers ───────────────────────────────────────────────
  /** Estimate token amounts returned for a given LP share amount */
  const estimateRemoval = useCallback(
    (sharesWei: bigint): { amount0: bigint; amount1: bigint } => {
      if (!poolState || poolState.totalSupply === 0n) return { amount0: 0n, amount1: 0n };
      return {
        amount0: (sharesWei * poolState.reserve0) / poolState.totalSupply,
        amount1: (sharesWei * poolState.reserve1) / poolState.totalSupply,
      };
    },
    [poolState],
  );

  /** Compute token1 amount proportional to amount0 for addLiquidity preview */
  const estimateToken1ForToken0 = useCallback(
    (amount0Wei: bigint): bigint => {
      if (!poolState || poolState.reserve0 === 0n) return 0n;
      return (amount0Wei * poolState.reserve1) / poolState.reserve0;
    },
    [poolState],
  );

  /** Compute token0 amount proportional to amount1 */
  const estimateToken0ForToken1 = useCallback(
    (amount1Wei: bigint): bigint => {
      if (!poolState || poolState.reserve1 === 0n) return 0n;
      return (amount1Wei * poolState.reserve0) / poolState.reserve1;
    },
    [poolState],
  );

  return {
    poolState,
    userLpBalance,
    token0Balance,
    token1Balance,
    isLoading,
    error,
    fetchPoolState,
    fetchSwapQuote,
    executeSwap,
    addLiquidity,
    removeLiquidity,
    estimateRemoval,
    estimateToken1ForToken0,
    estimateToken0ForToken1,
  };
}
