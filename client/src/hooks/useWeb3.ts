import { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { apiClient } from '../lib/api';

type Web3State = {
    isConnected: boolean;
    address: string | null;
    balance: string;
};

let globalState: Web3State = {
    isConnected: false,
    address: null,
    balance: '0.00',
};

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
                const accounts = await provider.listAccounts();
                if (accounts.length > 0) {
                    const address = await accounts[0].getAddress();
                    const balanceInWei = await provider.getBalance(address);
                    const balance = ethers.formatEther(balanceInWei);
                    updateGlobalState({ isConnected: true, address, balance: parseFloat(balance).toFixed(4) });
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

            updateGlobalState({
                isConnected: true,
                address: address,
                balance: parseFloat(balance).toFixed(4)
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
        formattedAddress: state.address ? formatAddress(state.address) : null,
        connect,
        disconnect
    };
}
