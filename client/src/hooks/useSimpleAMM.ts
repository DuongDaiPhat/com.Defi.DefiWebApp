import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useWeb3 } from './useWeb3';
import { SimpleAMMABI } from '../lib/abis/SimpleAMM.abi';
import { TokenABI } from '../lib/abis/Token.abi';
import axios from 'axios';

const AMM_ADDRESS = import.meta.env.VITE_SIMPLE_AMM_ADDRESS;
const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface AMMInfo {
  reserve0: string; // ETH (Mock)
  reserve1: string; // SKT
  priceRatio: string;
}

export function useSimpleAMM() {
  const { provider, account } = useWeb3();
  const [ammInfo, setAmmInfo] = useState<AMMInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // READ: Query reserve info from Server
  const fetchAMMInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`${API_URL}/api/amm/info`);
      setAmmInfo(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // GET QUOTE: Server endpoint
  const getQuote = async (amountIn: string, direction: 'eth_to_skt' | 'skt_to_eth') => {
    try {
      const res = await axios.get(`${API_URL}/api/amm/quote?amountIn=${amountIn}&direction=${direction}`);
      return res.data;
    } catch (err) {
      console.error("Quote error", err);
      return "0";
    }
  };

  // WRITE: Swap
  const swap = async (amountIn: string, minOut: string, isEthToSkt: boolean) => {
    if (!provider || !account) throw new Error("Wallet not connected");
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const ammContract = new ethers.Contract(AMM_ADDRESS, SimpleAMMABI, signer);

      let tx;
      if (isEthToSkt) {
        // Swap Native ETH -> SKT (token1)
        // Assume SimpleAMM swap có fallback nhận msg.value nếu zeroForOne = true
        tx = await ammContract.swap(amountIn, minOut, true, { value: amountIn });
      } else {
        // Swap SKT -> ETH
        const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TokenABI, signer);
        const approveTx = await tokenContract.approve(AMM_ADDRESS, amountIn);
        await approveTx.wait();

        tx = await ammContract.swap(amountIn, minOut, false);
      }

      const receipt = await tx.wait();
      await fetchAMMInfo(); // Refresh reserve
      return receipt;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    ammInfo,
    isLoading,
    fetchAMMInfo,
    getQuote,
    swap
  };
}
