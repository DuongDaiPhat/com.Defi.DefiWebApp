import { useState, useCallback, useEffect } from 'react';

// --- Global Mock Store ---
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

// Giả lập trạng thái Ethers Provider để test UI
// Thực tế sẽ dùng: const provider = new ethers.BrowserProvider(window.ethereum)
export function useWeb3Mock() {
  const [state, setState] = useState(globalState);

  useEffect(() => {
    const listener = () => setState(globalState);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Mock hàm connect wallet (Trả về Promise để UI bắt loading state)
  const connect = useCallback(async (walletProvider?: string) => {
    // Console log the selected wallet provider
    console.log(`Connecting to: ${walletProvider || 'MetaMask'}`);
    
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        updateGlobalState({
          isConnected: true,
          address: '0x4F4a1D8B4c256336B3dF620b12F5e7eb9645Ba5E',
          balance: '1.542'
        });
        resolve();
      }, 1000); // 1s loading
    });
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
