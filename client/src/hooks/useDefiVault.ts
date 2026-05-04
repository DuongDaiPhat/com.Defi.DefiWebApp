import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from './useWeb3';
import { DefiVaultABI } from '../lib/abis/DefiVault.abi';
import { TokenABI } from '../lib/abis/Token.abi';
import { VaultInfo, VaultDepositPayload, VaultRedeemPayload } from '../types/vault.types';
import axios from 'axios';

const VAULT_ADDRESS = import.meta.env.VITE_DEFI_VAULT_ADDRESS;
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export function useDefiVault() {
  const { provider, account } = useWeb3();
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // READ: Query from Server (Fast, Cached, Synced with DB)
  const fetchVaultInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = account 
        ? `${API_URL}/api/vault/info?address=${account}`
        : `${API_URL}/api/vault/info`;
        
      const response = await axios.get(url);
      setVaultInfo(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch vault info');
    } finally {
      setIsLoading(false);
    }
  }, [account]);

  // WRITE: Deposit (SKT -> dvSKT) using MetaMask
  const deposit = async (payload: VaultDepositPayload) => {
    if (!provider || !account) throw new Error("Wallet not connected");
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TokenABI, signer);
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, DefiVaultABI, signer);

      // 1. Approve
      const approveTx = await tokenContract.approve(VAULT_ADDRESS, payload.amount);
      await approveTx.wait();

      // 2. Deposit (using custom slippage function from business doc)
      const tx = await vaultContract.depositWithSlippage(payload.amount, account, payload.minShares);
      const receipt = await tx.wait();

      // 3. Optional: Sync to Server right away
      await axios.post(`${API_URL}/api/vault/record`, {
        walletAddress: account,
        actionType: 'DEPOSIT',
        assets: payload.amount,
        shares: payload.minShares, // Approximation for log
        transactionHash: receipt.hash
      }).catch(console.error);

      await fetchVaultInfo();
      return receipt;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Deposit failed');
    } finally {
      setIsLoading(false);
    }
  };

  // WRITE: Redeem (dvSKT -> SKT) using MetaMask
  const redeem = async (payload: VaultRedeemPayload) => {
    if (!provider || !account) throw new Error("Wallet not connected");
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, DefiVaultABI, signer);

      // Redeem custom slippage function
      const tx = await vaultContract.redeemWithSlippage(payload.shares, account, account, payload.minAssets);
      const receipt = await tx.wait();

      // Sync to Server
      await axios.post(`${API_URL}/api/vault/record`, {
        walletAddress: account,
        actionType: 'REDEEM',
        assets: payload.minAssets,
        shares: payload.shares,
        transactionHash: receipt.hash
      }).catch(console.error);

      await fetchVaultInfo();
      return receipt;
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Redeem failed');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    vaultInfo,
    isLoading,
    error,
    fetchVaultInfo,
    deposit,
    redeem
  };
}
