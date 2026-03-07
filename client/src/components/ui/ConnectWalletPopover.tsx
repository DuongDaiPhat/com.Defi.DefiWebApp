import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, QrCode, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import metamaskLogo from '../../assets/metamask-logo.png';
import rabbyLogo from '../../assets/rabby-wallet-logo.svg';

export interface ConnectWalletPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletId: string, address: string) => Promise<void>;
}

const WALLETS = [
  { id: 'rabby', name: 'Rabby Wallet', detected: true, iconPath: '/mock-icons/rabby.svg' },
  { id: 'metamask', name: 'MetaMask', detected: true, iconPath: '/mock-icons/metamask.svg' },
  { id: 'walletconnect', name: 'WalletConnect', detected: false, iconPath: '/mock-icons/walletconnect.svg' },
  { id: 'coinbase', name: 'Coinbase Wallet', detected: false, iconPath: '/mock-icons/coinbase.svg' },
];

export function ConnectWalletPopover({ isOpen, onClose, onConnect }: ConnectWalletPopoverProps) {
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [showOtherWallets, setShowOtherWallets] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  const popoverRef = useClickOutside<HTMLDivElement>(() => {
    if (!connectingWallet) onClose();
  });

  // Thêm listener cho thay đổi account
  const addWalletListener = () => {
    if (!window.ethereum) return;

    // Lắng nghe khi user thay đổi account hoặc logout
    window.ethereum.on('accountsChanged', async (accounts: string[]) => {
      console.log('Accounts changed:', accounts);
      
      if (accounts.length === 0) {
        // User logout từ MetaMask
        setWalletAddress(null);
        onClose();
      } else if (accounts[0] !== walletAddress) {
        // User switch sang account khác
        setWalletAddress(accounts[0]);
        try {
          await onConnect('metamask', accounts[0]);
        } catch (error) {
          console.error('Account change failed:', error);
        }
      }
    });

    // Lắng nghe khi chain thay đổi (optional)
    window.ethereum.on('chainChanged', () => {
      console.log('Chain changed, reloading...');
      window.location.reload();
    });
  };

  // Auto-connect khi component mount
  useEffect(() => {
    const autoConnect = async () => {
      if (!window.ethereum) return;
      
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts'
        });
        
        if (accounts.length > 0) {
          setWalletAddress(accounts[0]);
          await onConnect('metamask', accounts[0]);
        }
      } catch (error) {
        console.error('Auto-connect failed:', error);
      }
    };
    
    autoConnect();
    addWalletListener(); // Thêm listener
    
    // Cleanup listener khi unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners?.();
      }
    };
  }, [onConnect]);

  const connectMetamaskWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }
    try {
      setConnectingWallet('metamask');
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      setWalletAddress(accounts[0]);
      await onConnect('metamask', accounts[0]); // ← Fix typo 'metammask' -> 'metamask'
    } catch (err) {
      console.error(err);
    } finally {
      setConnectingWallet(null);
    }
  };

  const handleWalletClick = async (walletId: string) => {
    setConnectingWallet(walletId);
    try {
      await onConnect(walletId, walletAddress || '');
    } catch (e) {
      console.error(e);
    } finally {
      setConnectingWallet(null);
      onClose();
    }
  };

  const MockWalletIcon = ({ id }: { id: string }) => {
    switch (id) {
      case 'metamask':
        return (
          <div className="w-10 h-10 rounded-[10px] bg-white flex shrink-0 border border-white/10 items-center justify-center p-1.5 shadow-inner">
            <img src={metamaskLogo} alt="MetaMask" className="w-full h-full object-contain" />
          </div>
        );
      case 'rabby':
        return (
          <div className="w-10 h-10 rounded-[10px] bg-[#8697FF] flex shrink-0 border border-white/10 items-center justify-center p-1.5 shadow-inner">
            <img src={rabbyLogo} alt="Rabby Wallet" className="w-full h-full object-contain" />
          </div>
        );
      case 'walletconnect':
        return (
          <div className="w-10 h-10 rounded-[10px] bg-[#3B99FC] flex shrink-0 border border-white/10 items-center justify-center p-2 shadow-inner">
             <svg viewBox="0 0 40 25" className="w-full h-auto text-white" fill="currentColor">
               <path d="M8.82869 6.22307C14.9961 0.288296 25.0039 0.288296 31.1713 6.22307L32.259 7.26992C32.7483 7.74088 32.7483 8.50444 32.259 8.9754L30.1337 11.0207C29.889 11.2562 29.4923 11.2562 29.2476 11.0207L28.6012 10.3986C23.8569 5.83296 16.1627 5.83296 11.4184 10.3986L10.7524 11.0396C10.5077 11.2751 10.111 11.2751 9.86634 11.0396L7.74097 8.99423C7.25166 8.52327 7.25166 8.75971 7.74097 7.28875L8.82869 6.22307ZM38.4872 13.5135L39.6106 14.5947C40.1298 15.0945 40.1298 15.9048 39.6106 16.4046L31.3341 24.3703C30.8149 24.8701 29.973 24.8701 29.4538 24.3703L20.0097 15.2811L10.5462 24.3703C10.027 24.8701 9.18509 24.8701 8.66589 24.3703L0.389441 16.4046C-0.129814 15.9048 -0.129814 15.0945 0.389441 14.5947L1.51278 13.5135C2.03204 13.0137 2.87391 13.0137 3.39317 13.5135L10.0051 19.8776C10.2647 20.1274 10.6857 20.1274 10.9453 19.8776L19.0601 12.0673C19.5793 11.5675 20.4212 11.5675 20.9405 12.0673L29.0553 19.8776C29.3149 20.1274 29.7358 20.1274 29.9954 19.8776L36.6074 13.5135C37.1266 13.0137 37.9685 13.0137 38.4872 13.5135Z"/>
             </svg>
          </div>
        );
      case 'coinbase':
        return (
          <div className="w-10 h-10 rounded-[10px] bg-[#0052FF] flex shrink-0 border border-white/10 items-center justify-center p-1.5 shadow-inner">
            <svg viewBox="0 0 24 24" className="w-full h-full text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
            </svg>
          </div>
        );
      default:
        return <div className="w-10 h-10 rounded-[10px] bg-gray-600 flex shrink-0 border border-white/10" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute right-0 top-full mt-3 w-[360px] bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden origin-top-right flex flex-col"
        >
          {/* Header */}
          <div className="flex justify-between items-center px-5 flex-shrink-0 pt-5 pb-3">
            <h3 className="font-semibold text-white/90 text-[15px]">
              {walletAddress? `Connected: ${walletAddress?.substring(0,6)}...${walletAddress?.substring(walletAddress.length - 4)}` : 'Connect Your Wallet'}
            </h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors" disabled={!!connectingWallet}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 pb-5 overflow-hidden max-h-[70vh] space-y-3">
            
            {/* Primary Recommended Block */}
            <button
              onClick={() => connectMetamaskWallet()}
              disabled={!!connectingWallet}
              className={`w-full relative overflow-hidden group rounded-[14px] bg-gradient-to-r from-yellow-500 to-orange-500 p-[1px] text-left transition-transform ${connectingWallet === 'metamask' ? 'scale-[0.98] opacity-80' : 'active:scale-[0.98]'}`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 to-orange-500 opacity-100 transition-opacity" />
              <div className="relative flex items-center justify-between bg-gradient-to-r from-yellow-500/90 to-orange-500/90 hover:from-yellow-400 hover:to-orange-400 px-4 py-3.5 rounded-[13px] transition-colors">
                <div className="flex items-center gap-3">
                  <MockWalletIcon id="metamask" />
                  <div>
                    <div className="font-semibold text-white text-[15px]">Get MetaMask</div>
                    <div className="text-white/80 text-[13px] mt-0.5">Available on iOS, Android, and Chrome</div>
                  </div>
                </div>
                {connectingWallet === 'metamask' && (
                  <Loader2 className="w-5 h-5 text-white animate-spin mr-2" />
                )}
              </div>
            </button>

            {/* Scan QR block */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-[14px] bg-[#27272a] hover:bg-[#3f3f46] transition-colors text-left active:scale-[0.98]"
              disabled={!!connectingWallet}
            >
               <div className="w-10 h-10 rounded-[10px] bg-[#3f3f46] flex flex-col items-center justify-center shrink-0 border border-white/5">
                 <QrCode className="w-5 h-5 text-[#f59e0b]" />
               </div>
               <div>
                 <div className="font-semibold text-white text-[15px]">DefiProtocol Mobile</div>
                 <div className="text-[#a1a1aa] text-[13px] mt-0.5">Scan QR code to connect</div>
               </div>
            </button>

            {/* Divider as Toggle Button */}
            <div className="flex items-center gap-4 py-2">
              <div className="h-[1px] flex-1 bg-white/10" />
              <button 
                onClick={() => setShowOtherWallets(!showOtherWallets)}
                className="text-[#a1a1aa] text-[13px] font-medium flex items-center gap-1 group hover:text-white transition-colors outline-none"
              >
                Other wallets 
                <span className="relative w-3 h-3 flex items-center justify-center">
                  <span className="absolute w-full h-[1.5px] bg-current"></span>
                  <span className={`absolute h-full w-[1.5px] bg-current transition-transform duration-300 ${showOtherWallets ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100'}`}></span>
                </span>
              </button>
              <div className="h-[1px] flex-1 bg-white/10" />
            </div>

            {/* Wallet List Expander */}
            <AnimatePresence>
              {showOtherWallets && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 pb-1">
                    {WALLETS.map((wallet) => (
                      <button
                        key={wallet.id}
                        onClick={() => handleWalletClick(wallet.id)}
                        disabled={!!connectingWallet && connectingWallet !== wallet.id}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-[12px] transition-colors ${connectingWallet === wallet.id ? 'bg-[#3f3f46]' : 'hover:bg-[#27272a] active:scale-[0.99]'} ${!!connectingWallet && connectingWallet !== wallet.id ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <MockWalletIcon id={wallet.id} />
                          <span className="font-semibold text-white text-[16px]">{wallet.name}</span>
                        </div>
                        
                        {connectingWallet === wallet.id ? (
                          <Loader2 className="w-5 h-5 text-[#f59e0b] animate-spin" />
                        ) : wallet.detected ? (
                          <span className="text-[#a1a1aa] text-[13px] font-medium">Detected</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
