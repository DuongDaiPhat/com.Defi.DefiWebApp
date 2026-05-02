import { useState, useEffect } from 'react';
import { StakingPool } from '../types/staking.types';
import { apiClient } from '../lib/api';

interface UseStakingPoolReturn {
  pools: StakingPool[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useStakingPool(): UseStakingPoolReturn {
  const [pools, setPools] = useState<StakingPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPools = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/api/staking/pools');
      setPools(response.data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch pools';
      setError(errorMsg);
      console.error('Error fetching staking pools:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools();
    // Refresh pools every 30 seconds to keep data fresh
    const interval = setInterval(fetchPools, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    pools,
    loading,
    error,
    refetch: fetchPools,
  };
}

/**
 * Hook to fetch a specific pool by ID
 */
export function useStakingPoolDetail(poolId: number) {
  const [pool, setPool] = useState<StakingPool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPool = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiClient.get(`/api/staking/pools/${poolId}`);
        setPool(response.data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch pool';
        setError(errorMsg);
        console.error(`Error fetching pool ${poolId}:`, err);
      } finally {
        setLoading(false);
      }
    };

    if (poolId >= 0) {
      fetchPool();
    }
  }, [poolId]);

  return { pool, loading, error };
}
