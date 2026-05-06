import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { OSVA_POOL_ABI, ERC20_ABI, OSVA_POOL_ADDRESS } from '../lib/osvaAbi';

// ============================================================
//  Types
// ============================================================

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: bigint;
  allowance: bigint;
}

export interface PoolState {
  token0: TokenInfo | null;
  token1: TokenInfo | null;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  lpBalance: bigint;
  isLoading: boolean;
  error: string | null;
}

// ============================================================
//  Helper: get ethers provider/signer
// ============================================================

async function getProvider() {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  return new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

// ============================================================
//  useOsvaPool hook
// ============================================================

export function useOsvaPool(userAddress: string | null) {
  const [poolState, setPoolState] = useState<PoolState>({
    token0: null,
    token1: null,
    reserve0: 0n,
    reserve1: 0n,
    totalSupply: 0n,
    lpBalance: 0n,
    isLoading: false,
    error: null,
  });

  const fetchPoolState = useCallback(async () => {
    if (!OSVA_POOL_ADDRESS) {
      setPoolState(s => ({ ...s, error: 'VITE_OSVA_POOL_ADDRESS not configured' }));
      return;
    }

    setPoolState(s => ({ ...s, isLoading: true, error: null }));

    try {
      const provider = await getProvider();
      const pool = new ethers.Contract(OSVA_POOL_ADDRESS, OSVA_POOL_ABI, provider);

      const [addr0, addr1, r0, r1, ts] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.reserve0(),
        pool.reserve1(),
        pool.totalSupply(),
      ]);

      const lpBal = userAddress ? await pool.balanceOf(userAddress) : 0n;

      // Load token info for both tokens
      const [t0, t1] = await Promise.all([
        loadTokenInfo(provider, addr0, userAddress, OSVA_POOL_ADDRESS),
        loadTokenInfo(provider, addr1, userAddress, OSVA_POOL_ADDRESS),
      ]);

      setPoolState({
        token0: t0,
        token1: t1,
        reserve0: BigInt(r0.toString()),
        reserve1: BigInt(r1.toString()),
        totalSupply: BigInt(ts.toString()),
        lpBalance: BigInt(lpBal.toString()),
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPoolState(s => ({ ...s, isLoading: false, error: msg }));
    }
  }, [userAddress]);

  useEffect(() => {
    fetchPoolState();
  }, [fetchPoolState]);

  // ============================================================
  //  Output estimation — uses spec formula with BigInt
  // ============================================================

  /**
   * Estimate amountOut and minAmountOut for a given swap.
   * All values: BigInt in wei.
   */
  const estimateOutput = useCallback(
    (tokenIn: string, amountIn: bigint, alpha: bigint, slippagePct: number): { estimated: bigint; minimum: bigint } => {
      const { reserve0, reserve1, token0 } = poolState;

      if (reserve0 === 0n || reserve1 === 0n || amountIn === 0n) {
        return { estimated: 0n, minimum: 0n };
      }

      const isToken0 = token0?.address?.toLowerCase() === tokenIn.toLowerCase();
      const reserveIn = isToken0 ? reserve0 : reserve1;
      const reserveOut = isToken0 ? reserve1 : reserve0;

      // Step 3: Virtual reserves
      const virtualReserveIn = reserveIn + reserveIn * alpha;
      const virtualReserveOut = reserveOut + reserveOut * alpha;

      // Step 4: Amount with fee
      const amountInWithFee = (amountIn * 997n) / 1000n;
      const estimated = (virtualReserveOut * amountInWithFee) / (virtualReserveIn + amountInWithFee);

      // Step 5: Apply slippage (multiply by (100 - slippage) / 100, scaled ×100 to avoid float)
      const slippageBps = BigInt(Math.round(slippagePct * 100)); // e.g. 0.5% → 50
      const minimum = (estimated * (10000n - slippageBps)) / 10000n;

      return { estimated, minimum };
    },
    [poolState]
  );

  // ============================================================
  //  Allowance check + approve
  // ============================================================

  const ensureAllowance = useCallback(
    async (tokenAddress: string, amount: bigint): Promise<void> => {
      const provider = await getProvider();
      const signer = await provider.getSigner();
      const userAddr = await signer.getAddress();
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const current: bigint = await token.allowance(userAddr, OSVA_POOL_ADDRESS);

      if (current < amount) {
        const tx = await token.approve(OSVA_POOL_ADDRESS, ethers.MaxUint256);
        await tx.wait();
      }
    },
    []
  );

  return {
    ...poolState,
    fetchPoolState,
    estimateOutput,
    ensureAllowance,
  };
}

// ============================================================
//  Internal helper
// ============================================================

async function loadTokenInfo(
  provider: ethers.BrowserProvider,
  address: string,
  userAddress: string | null,
  spender: string
): Promise<TokenInfo> {
  const token = new ethers.Contract(address, ERC20_ABI, provider);
  const [name, symbol, decimals, balance, allowance] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
    userAddress ? token.balanceOf(userAddress) : 0n,
    userAddress ? token.allowance(userAddress, spender) : 0n,
  ]);
  return {
    address,
    name,
    symbol,
    decimals: Number(decimals),
    balance: BigInt(balance.toString()),
    allowance: BigInt(allowance.toString()),
  };
}
