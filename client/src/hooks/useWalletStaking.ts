import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import type { UserStake, LockStatus } from '../types/staking.types';
import { apiClient } from '../lib/api';

// Minimal ABI for WalletStaking contract - adjust address as needed
const WALLET_STAKING_ABI = [
  'function stake(uint256 poolId, uint256 amount) external',
  'function unstake(uint256 stakeId) external',
  'function claimReward(uint256 stakeId) external',
  'function getPendingReward(address user, uint256 stakeId) external view returns (uint256)',
  'function getAllPools() external view returns (tuple(uint256 id, string name, uint256 apr, uint256 lockDuration, uint256 penaltyRate, uint256 minStake, uint256 maxStake, uint256 totalStaked, bool isActive)[])',
  'function userStakes(address user, uint256 stakeId) external view returns (uint256 poolId, uint256 amount, uint256 stakedAt, uint256 lastClaimAt, uint256 pendingReward, bool isActive)',
  'function userStakeCount(address user) external view returns (uint256)',
  'function isLocked(address user, uint256 stakeId) external view returns (bool locked, uint256 remaining)',
  'function getPool(uint256 poolId) external view returns (tuple(uint256 id, string name, uint256 apr, uint256 lockDuration, uint256 penaltyRate, uint256 minStake, uint256 maxStake, uint256 totalStaked, bool isActive))',
  'event Staked(address indexed user, uint256 indexed poolId, uint256 stakeId, uint256 amount)',
  'event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 penalty)',
  'event RewardClaimed(address indexed user, uint256 indexed stakeId, uint256 reward)',
  'event EmergencyWithdrawn(address indexed user, uint256 indexed stakeId, uint256 amount)',
];

// Get contract address from environment variable
const WALLET_STAKING_ADDRESS = import.meta.env.VITE_WALLET_STAKING_ADDRESS || '';
const STAKING_TOKEN_ADDRESS = import.meta.env.VITE_STAKING_TOKEN_ADDRESS || '';

// ERC20 ABI for approve
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
];

interface UseWalletStakingState {
  isLoading: boolean;
  error: string | null;
  userStakes: UserStake[];
}

interface UseWalletStakingReturn extends UseWalletStakingState {
  stake: (poolId: number, amount: string) => Promise<string>; // returns tx hash
  unstake: (stakeId: number) => Promise<string>;
  claimReward: (stakeId: number) => Promise<string>;
  getUserStakes: () => Promise<void>;
  getPendingReward: (stakeId: number) => Promise<string>;
  checkLockStatus: (stakeId: number) => Promise<LockStatus>;
}

export function useWalletStaking(userAddress: string | null): UseWalletStakingReturn {
  const [userStakes, setUserStakes] = useState<UserStake[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContract = useCallback(async () => {
    if (!userAddress || !window.ethereum) {
      throw new Error('Wallet not connected');
    }
    if (!WALLET_STAKING_ADDRESS) {
      throw new Error('Contract address not configured');
    }
    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();
    return new ethers.Contract(WALLET_STAKING_ADDRESS, WALLET_STAKING_ABI, signer);
  }, [userAddress]);

  const getTokenContract = useCallback(async () => {
    if (!window.ethereum) throw new Error('Wallet not connected');
    if (!STAKING_TOKEN_ADDRESS) throw new Error('Token address not configured');
    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();
    return new ethers.Contract(STAKING_TOKEN_ADDRESS, ERC20_ABI, signer);
  }, []);

  const approveTokens = useCallback(
    async (amount: bigint) => {
      try {
        const tokenContract = await getTokenContract();
        const tx = await tokenContract.approve(WALLET_STAKING_ADDRESS, amount);
        await tx.wait();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Approval failed';
        throw new Error(`Token approval failed: ${msg}`);
      }
    },
    [getTokenContract]
  );

  const stake = useCallback(
    async (poolId: number, amount: string): Promise<string> => {
      try {
        setIsLoading(true);
        setError(null);

        const contract = await getContract();
        const amountWei = ethers.parseUnits(amount, 18);

        // Check allowance and approve if needed
        const tokenContract = await getTokenContract();
        const allowance = await tokenContract.allowance(userAddress, WALLET_STAKING_ADDRESS);
        if (allowance < amountWei) {
          await approveTokens(amountWei);
        }

        // Call stake function
        const tx = await contract.stake(poolId, amountWei);
        const receipt = await tx.wait();

        // Record stake action on server
        try {
          await apiClient.post('/api/staking/record-stake', {
            walletAddress: userAddress,
            poolId,
            amount,
            transactionHash: receipt.hash,
          });
        } catch (apiErr) {
          console.warn('Failed to record stake on server:', apiErr);
        }

        // Refresh user stakes
        await getUserStakes();

        return receipt.hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stake transaction failed';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [getContract, getTokenContract, userAddress, approveTokens]
  );

  const unstake = useCallback(
    async (stakeId: number): Promise<string> => {
      try {
        setIsLoading(true);
        setError(null);

        const contract = await getContract();
        const tx = await contract.unstake(stakeId);
        const receipt = await tx.wait();

        // Record unstake action on server
        try {
          await apiClient.post('/api/staking/record-unstake', {
            walletAddress: userAddress,
            stakeId,
            transactionHash: receipt.hash,
          });
        } catch (apiErr) {
          console.warn('Failed to record unstake on server:', apiErr);
        }

        await getUserStakes();
        return receipt.hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unstake transaction failed';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [getContract, userAddress]
  );

  const claimReward = useCallback(
    async (stakeId: number): Promise<string> => {
      try {
        setIsLoading(true);
        setError(null);

        const contract = await getContract();
        const tx = await contract.claimReward(stakeId);
        const receipt = await tx.wait();

        // Record claim action on server
        try {
          await apiClient.post('/api/staking/record-claim', {
            walletAddress: userAddress,
            stakeId,
            transactionHash: receipt.hash,
          });
        } catch (apiErr) {
          console.warn('Failed to record claim on server:', apiErr);
        }

        await getUserStakes();
        return receipt.hash;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Claim transaction failed';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [getContract, userAddress]
  );

  const getUserStakes = useCallback(async () => {
    if (!userAddress) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get data from server (which combines DB history + contract realtime data)
      const response = await apiClient.get(`/api/staking/user/${userAddress}`);
      setUserStakes(response.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch user stakes';
      setError(msg);
      console.error('Error fetching user stakes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress]);

  const getPendingReward = useCallback(
    async (stakeId: number): Promise<string> => {
      try {
        const contract = await getContract();
        const reward = await contract.getPendingReward(userAddress, stakeId);
        return ethers.formatUnits(reward, 18);
      } catch (err) {
        console.error('Error getting pending reward:', err);
        throw err;
      }
    },
    [getContract, userAddress]
  );

  const checkLockStatus = useCallback(
    async (stakeId: number): Promise<LockStatus> => {
      try {
        const contract = await getContract();
        const [locked, remaining] = await contract.isLocked(userAddress, stakeId);
        return {
          locked,
          remainingTime: Number(remaining),
        };
      } catch (err) {
        console.error('Error checking lock status:', err);
        throw err;
      }
    },
    [getContract, userAddress]
  );

  // Fetch user stakes on component mount or when address changes
  useEffect(() => {
    if (userAddress) {
      getUserStakes();
    }
  }, [userAddress, getUserStakes]);

  return {
    userStakes,
    isLoading,
    error,
    stake,
    unstake,
    claimReward,
    getUserStakes,
    getPendingReward,
    checkLockStatus,
  };
}
