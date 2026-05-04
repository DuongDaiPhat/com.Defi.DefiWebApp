import { useState, useCallback, useEffect } from 'react';
import { useWeb3 } from './useWeb3';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface DashboardStats {
  totalBalanceUSD: string;    // Appx USD for dashboard view
  yieldEarnedUSD: string;
  activeStakesCount: number;
  vaultStatus: {
    pricePerShare: string;
    totalAssets: string;
    paused: boolean;
  };
  sktTokenBalance: string;
}

/**
 * Custom hook load Data tổng quan cho DashboardPage
 * Thay thế data mock bằng API aggregate
 */
export function useDashboard() {
  const { account, tokenBalance } = useWeb3();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    if (!account) return;
    try {
      setIsLoading(true);

      // Tạm thời gọi song song 2 API từ Server vì ta chưa có /api/portfolio aggregation
      const [vaultVal, strategyVal] = await Promise.all([
        axios.get(`${API_URL}/api/vault/info?address=${account}`),
        axios.get(`${API_URL}/api/strategy/user/${account}`)
      ]);

      const vaultData = vaultVal.data;
      const strategyStakes: any[] = strategyVal.data || [];

      // Calculate aggregate fields (Giả lập: 1 SKT = $0.1 USD)
      const SKT_PRICE_USD = 0.10;
      
      const totalSKTInStrategy = strategyStakes.reduce((acc, curr) => acc + parseFloat(curr.currentValue || 0), 0);
      const totalSKTInVault = parseFloat(vaultData.userAssetValue || 0);
      const totalSKTWallet = parseFloat(tokenBalance);

      const totalSKT = totalSKTInStrategy + totalSKTInVault + totalSKTWallet;
      
      const yieldEarnedSKT = strategyStakes.reduce((acc, curr) => acc + parseFloat(curr.pendingYield || 0), 0);
      const activeStakes = strategyStakes.filter(s => s.status === 'ACTIVE').length;

      setStats({
        totalBalanceUSD: (totalSKT * SKT_PRICE_USD).toFixed(2),
        yieldEarnedUSD: (yieldEarnedSKT * SKT_PRICE_USD).toFixed(2),
        activeStakesCount: activeStakes,
        vaultStatus: {
          pricePerShare: vaultData.pricePerShare,
          totalAssets: vaultData.totalAssets,
          paused: vaultData.paused
        },
        sktTokenBalance: tokenBalance
      });

    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [account, tokenBalance]);

  useEffect(() => {
    if (account) {
      fetchDashboardData();
    }
  }, [account, fetchDashboardData]);

  return {
    stats,
    isLoading,
    refresh: fetchDashboardData
  };
}
