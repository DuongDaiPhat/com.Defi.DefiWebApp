import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { apiClient } from '../lib/api';

import { TokenABI } from '../lib/abis/Token.abi';

type Web3State = {
    isConnected: boolean;
    address: string | null;
    balance: string; // ETH
    tokenBalance: string; // SKT
    chainId: number | null;
    isWrongNetwork: boolean;
};

let globalState: Web3State = {
    isConnected: false,
    address: null,
    balance: '0.00',
    tokenBalance: '0.00',
    chainId: null,
    isWrongNetwork: false,
};

let cachedProvider: ethers.BrowserProvider | null = null;

const listeners = new Set<() => void>();

function notify() {
    listeners.forEach(listener => listener());
}

function updateGlobalState(newState: Partial<Web3State>) {
    globalState = { ...globalState, ...newState };
    notify();
}

export function useWeb3() {
    const [state, setState] = useState(globalState);

    useEffect(() => {
        const listener = () => setState(globalState);
        listeners.add(listener);

        const checkConnection = async () => {
            if (window.ethereum) {
                const provider = new ethers.BrowserProvider(window.ethereum as any);
                cachedProvider = provider;
                const accounts = await provider.listAccounts();
                const network = await provider.getNetwork();
                const chainId = Number(network.chainId);
                const isWrongNetwork = chainId !== 11155111; // Sepolia
                
                if (accounts.length > 0) {
                    const address = await accounts[0].getAddress();
                    const balanceInWei = await provider.getBalance(address);
                    const balance = ethers.formatEther(balanceInWei);
                    
                    let tokenBalance = '0.00';
                    try {
                        const tokenAddress = import.meta.env.VITE_TOKEN_ADDRESS;
                        if (tokenAddress) {
                            const tokenContract = new ethers.Contract(tokenAddress, TokenABI, provider);
                            const tkBal = await tokenContract.balanceOf(address);
                            tokenBalance = parseFloat(ethers.formatEther(tkBal)).toFixed(4);
                        }
                    } catch (err) {
                        console.error('Cannot fetch SKT token balance', err);
                    }

                    updateGlobalState({ 
                        isConnected: true, 
                        address, 
                        balance: parseFloat(balance).toFixed(4),
                        tokenBalance,
                        chainId,
                        isWrongNetwork
                    });
                } else {
                    updateGlobalState({ chainId, isWrongNetwork });
                }
            }
        };
        checkConnection();

        // Handle account change
        if (window.ethereum) {
            (window.ethereum as any).on('accountsChanged', (accounts: string[]) => {
                if (accounts.length === 0) {
                    updateGlobalState({ isConnected: false, address: null, balance: '0.00' });
                } else {
                    checkConnection();
                }
            });
        }

        return () => {
            listeners.delete(listener);
        };
    }, []);

    const connect = useCallback(async (walletProvider?: string, walletAddress?: string) => {
        try {
            if (!window.ethereum) {
                alert("Metamask is not installed!");
                return;
            }

            const provider = new ethers.BrowserProvider(window.ethereum as any);

            // Request account access
            const accounts = await provider.send("eth_requestAccounts", []);
            const address = accounts[0];

            // Call Restful API with axios instance
            try {
                const response = await apiClient.post('/auth/nonce', {
                    walletAddress: address
                });
                const nonce = response.data;
                console.log("Received nonce from server for wallet", address, ":", nonce);

                // Optional: sign message
                // const signer = await provider.getSigner();
                // const signature = await signer.signMessage(nonce);
                // console.log("Signature:", signature);

            } catch (apiError) {
                console.error("Error connecting to backend API. Is the server running?", apiError);
                alert("Error connecting to Backend Server. Check console for details.");
            }

            // Get balance
            const balanceInWei = await provider.getBalance(address);
            const balance = ethers.formatEther(balanceInWei);
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);

            updateGlobalState({
                isConnected: true,
                address: address,
                balance: parseFloat(balance).toFixed(4),
                chainId,
                isWrongNetwork: chainId !== 11155111
            });

        } catch (error) {
            console.error("User denied account access or error occurred", error);
        }
    }, []);

    const disconnect = useCallback(() => {
        updateGlobalState({
            isConnected: false,
            address: null,
            balance: '0.00'
        });
    }, []);

    const formatAddress = (addr: string) => {
        return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
    };

    return {
        ...state,
        provider: cachedProvider,
        formattedAddress: state.address ? formatAddress(state.address) : null,
        connect,
        disconnect
    };
}
