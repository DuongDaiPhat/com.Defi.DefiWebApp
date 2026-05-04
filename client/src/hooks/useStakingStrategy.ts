import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from './useWeb3';
import { StakingABI } from '../lib/abis/Staking.abi';
import { TokenABI } from '../lib/abis/Token.abi';
import { UserStrategyStake, StrategyStats, StrategyPoolData } from '../types/strategy.types';
import axios from 'axios';

const STAKING_ADDRESS = import.meta.env.VITE_STAKING_ADDRESS;
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useStakingStrategy() {
  const { provider, account } = useWeb3();
  const [pools, setPools] = useState<StrategyPoolData[]>([]);
  const [userStakes, setUserStakes] = useState<UserStrategyStake[]>([]);
  const [stats, setStats] = useState<StrategyStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // READ: Query from Server (Aggregated Data)
  const fetchStrategyData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Chạy song song requests
      const [statsRes, poolsRes] = await Promise.all([
        axios.get(`${API_URL}/api/strategy/stats`),
        axios.get(`${API_URL}/api/staking/pools`) // Vẫn dùng route cũ trên Controller cho Pools metadata
      ]);
      
      setStats(statsRes.data);
      setPools(poolsRes.data);

      if (account) {
        const stakesRes = await axios.get(`${API_URL}/api/strategy/user/${account}`);
        setUserStakes(stakesRes.data);
      }
    } catch (err) {
      console.error("Failed to fetch strategy data", err);
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  // WRITE: Stake to Strategy (using MetaMask)
  const stake = async (poolId: number, amount: string) => {
    if (!provider || !account) throw new Error("Wallet not connected");
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TokenABI, signer);
      const stakingContract = new ethers.Contract(STAKING_ADDRESS, StakingABI, signer);

      // 1. Approve
      const approveTx = await tokenContract.approve(STAKING_ADDRESS, amount);
      await approveTx.wait();

      // 2. Stake
      const tx = await stakingContract.stake(poolId, amount);
      const receipt = await tx.wait();

      // 3. Lấy log để tìm stakeId (thực tế cần parse log từ receipt)
      // Tạm thời để 0 hoặc gọi API Server backend fetch latest. Server có tracking riêng.
      
      // 4. Sync Server: Record
      await axios.post(`${API_URL}/api/strategy/record-stake`, {
        walletAddress: account,
        poolId,
        stakeId: 0, // Fallback -> Server backend sync missing
        assetsAtStake: amount,
        sharesReceived: amount, // Approximated
        transactionHash: receipt.hash
      }).catch(console.error);

      await fetchStrategyData();
    } finally {
      setIsLoading(false);
    }
  };

  // WRITE: Unstake
  const unstake = async (stakeId: number) => {
    if (!provider || !account) throw new Error("Wallet not connected");
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const stakingContract = new ethers.Contract(STAKING_ADDRESS, StakingABI, signer);

      const tx = await stakingContract.unstake(stakeId);
      const receipt = await tx.wait();

      await axios.post(`${API_URL}/api/strategy/record-unstake`, {
        walletAddress: account,
        stakeId,
        transactionHash: receipt.hash
      }).catch(console.error);

      await fetchStrategyData();
    } finally {
      setIsLoading(false);
    }
  };

  // WRITE: Emergency Withdraw (Loss penalty)
  const emergencyWithdraw = async (stakeId: number) => {
    if (!provider || !account) throw new Error("Wallet not connected");
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const stakingContract = new ethers.Contract(STAKING_ADDRESS, StakingABI, signer);

      const tx = await stakingContract.emergencyWithdraw(stakeId);
      const receipt = await tx.wait();

      await axios.post(`${API_URL}/api/strategy/record-emergency`, {
        walletAddress: account,
        stakeId,
        transactionHash: receipt.hash
      }).catch(console.error);

      await fetchStrategyData();
    } finally {
      setIsLoading(false);
    }
  };

  return {
    pools,
    userStakes,
    stats,
    isLoading,
    fetchStrategyData,
    stake,
    unstake,
    emergencyWithdraw
  };
}
