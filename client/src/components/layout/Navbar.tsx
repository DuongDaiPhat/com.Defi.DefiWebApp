import { ChevronDown, Menu, Wallet, Repeat, BarChart2, CreditCard, ArrowUpCircle } from 'lucide-react';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useWeb3 } from '../../hooks/useWeb3';
import { Button } from '../ui/Button';
import { ConnectWalletPopover } from '../ui/ConnectWalletPopover';
import { useClickOutside } from '../../hooks/useClickOutside';
import DefiLogo from '../../assets/defi-logo.png';

export function Navbar() {
  const { isConnected, formattedAddress, balance, connect, disconnect } = useWeb3();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isWalletPopoverOpen, setIsWalletPopoverOpen] = useState(false);
  const [isConnectedDropdownOpen, setIsConnectedDropdownOpen] = useState(false);

  // State for Navigation Dropdowns
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isConnected && location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [isConnected, location.pathname, navigate]);

  const isTradeActive = location.pathname === '/swap';
  const isExploreActive = location.pathname === '/dashboard';
  const isStakingActive = location.pathname === '/stake';

  const handleProtectedAction = (e: React.MouseEvent) => {
    if (!isConnected) {
      e.preventDefault();
      setIsWalletPopoverOpen(true);
    }
  };

  const handleMouseEnterMenu = (menuId: string) => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    setActiveMenu(menuId);
  };

  const handleMouseLeaveMenu = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 150); // 150ms delay to prevent accidental closing
  };

  const connectedDropdownRef = useClickOutside<HTMLDivElement>(() => setIsConnectedDropdownOpen(false));

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#111421]/90 border-b border-white/10 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.4)]">
      {/* Neon-Gold Accent Line */}
      <div className="absolute bottom-[-1px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--color-primary)]/20 to-transparent" />

      <div className="px-4 sm:px-6 lg:px-12">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-[var(--color-primary)]/10 blur-xl rounded-full" />
              <div className="w-9 h-9 flex items-center justify-center overflow-hidden relative z-10">
                <img src={DefiLogo} alt="DeFi Protocol" className="w-full h-full object-contain" />
              </div>
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-white">
              DeFi <span className="bg-gradient-to-r from-[var(--color-primary)] to-amber-500 bg-clip-text text-transparent">Protocol</span>
            </span>
          </div>

          {/* Desktop Links (Interactive Dropdowns) */}
          <div className="hidden md:flex items-center gap-2">

            {/* Trade Menu */}
            <div
              className="relative px-3 py-4"
              onMouseEnter={() => handleMouseEnterMenu('trade')}
              onMouseLeave={handleMouseLeaveMenu}
            >
              <button className={`flex items-center gap-1 text-[15px] font-semibold transition-all duration-200 ${activeMenu === 'trade' || isTradeActive ? 'text-white' : 'text-[#a1a1aa] hover:text-white'
                }`}>
                Trade <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMenu === 'trade' ? 'rotate-180' : ''}`} />
              </button>

              {(activeMenu === 'trade' || isTradeActive) && !activeMenu && (
                <motion.div layoutId="nav-active" className="absolute bottom-2 left-3 right-3 h-0.5 bg-[var(--color-primary)] rounded-full" />
              )}

              <AnimatePresence>
                {activeMenu === 'trade' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-0 top-full -mt-1 w-[260px] bg-[#111421]/95 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-2 z-50 flex flex-col gap-1.5 origin-top-left backdrop-blur-3xl"
                  >
                    <Link to="/swap" onClick={handleProtectedAction} className="flex items-center gap-3 px-3 py-3 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors group">
                      <Repeat className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                      <span className="font-semibold text-[15px]">Swap</span>
                    </Link>
                    <Link to="/swap?tab=limit" onClick={handleProtectedAction} className="flex items-center gap-3 px-3 py-3 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors group">
                      <BarChart2 className="w-5 h-5 text-[#a1a1aa] group-hover:text-white transition-colors rotate-90" />
                      <span className="font-semibold text-[15px]">Limit</span>
                    </Link>
                    <Link to="/swap?tab=buy" onClick={handleProtectedAction} className="flex items-center gap-3 px-3 py-3 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors group">
                      <CreditCard className="w-5 h-5 text-[#a1a1aa] group-hover:text-white transition-colors" />
                      <span className="font-semibold text-[15px]">Buy</span>
                    </Link>
                    <Link to="/swap?tab=sell" onClick={handleProtectedAction} className="flex items-center gap-3 px-3 py-3 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors group">
                      <ArrowUpCircle className="w-5 h-5 text-[#a1a1aa] group-hover:text-white transition-colors" />
                      <span className="font-semibold text-[15px]">Sell</span>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Explore Menu */}
            <div
              className="relative px-3 py-4"
              onMouseEnter={() => handleMouseEnterMenu('explore')}
              onMouseLeave={handleMouseLeaveMenu}
            >
              <button className={`flex items-center gap-1 text-[15px] font-semibold transition-all duration-200 ${activeMenu === 'explore' || isExploreActive ? 'text-white' : 'text-[#a1a1aa] hover:text-white'
                }`}>
                Explore <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMenu === 'explore' ? 'rotate-180' : ''}`} />
              </button>

              {(activeMenu === 'explore' || isExploreActive) && !activeMenu && (
                <motion.div layoutId="nav-active" className="absolute bottom-2 left-3 right-3 h-0.5 bg-[var(--color-primary)] rounded-full" />
              )}

              <AnimatePresence>
                {activeMenu === 'explore' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-0 top-full -mt-1 w-[220px] bg-[#111421]/95 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-2 z-50 flex flex-col gap-1 origin-top-left backdrop-blur-3xl"
                  >
                    <Link to="/dashboard?tab=tokens" onClick={handleProtectedAction} className="flex items-center px-3 py-3.5 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors">
                      <span className="font-semibold text-[15px]">Tokens</span>
                    </Link>
                    <Link to="/dashboard?tab=pools" onClick={handleProtectedAction} className="flex items-center px-3 py-3.5 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors">
                      <span className="font-semibold text-[15px]">Pools</span>
                    </Link>
                    <Link to="/dashboard?tab=transactions" onClick={handleProtectedAction} className="flex items-center px-3 py-3.5 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors">
                      <span className="font-semibold text-[15px]">Transactions</span>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Staking Menu */}
            <div
              className="relative px-3 py-4"
              onMouseEnter={() => handleMouseEnterMenu('staking')}
              onMouseLeave={handleMouseLeaveMenu}
            >
              <button className={`flex items-center gap-1 text-[15px] font-semibold transition-all duration-200 ${activeMenu === 'staking' || isStakingActive ? 'text-white' : 'text-[#a1a1aa] hover:text-white'
                }`}>
                Staking <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeMenu === 'staking' ? 'rotate-180' : ''}`} />
              </button>

              {(activeMenu === 'staking' || isStakingActive) && !activeMenu && (
                <motion.div layoutId="nav-active" className="absolute bottom-2 left-3 right-3 h-0.5 bg-[var(--color-primary)] rounded-full" />
              )}

              <AnimatePresence>
                {activeMenu === 'staking' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute left-0 top-full -mt-1 w-[220px] bg-[#111421]/95 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] p-2 z-50 flex flex-col gap-1 origin-top-left backdrop-blur-3xl"
                  >
                    <Link to="/stake" onClick={handleProtectedAction} className="flex items-center px-3 py-3.5 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors">
                      <span className="font-semibold text-[15px]">View positions</span>
                    </Link>
                    <Link to="/stake?tab=create" onClick={handleProtectedAction} className="flex items-center px-3 py-3.5 w-full rounded-xl hover:bg-white/5 text-[#a1a1aa] hover:text-white transition-colors">
                      <span className="font-semibold text-[15px]">Create position</span>
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* Wallet Action */}
          <div className="hidden md:flex items-center gap-4 relative">
            {isConnected ? (
              <div className="relative" ref={connectedDropdownRef}>
                <div className="flex items-center gap-3 bg-[var(--color-primary)]/10 backdrop-blur-md rounded-xl p-1.5 border border-amber-500/30 hover:border-amber-500 transition-all group-hover:bg-[var(--color-primary)]">
                  <div className="hidden lg:flex flex-col items-end px-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-0.5">Sepolia</span>
                    <span className="text-sm font-bold text-[var(--color-primary-light)] font-mono tracking-tighter group-hover:text-slate-900 leading-none">{balance}</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsConnectedDropdownOpen(!isConnectedDropdownOpen)}
                    className="gap-2 bg-white/5 hover:bg-[var(--color-primary)] text-white hover:text-slate-950 h-9 px-4 rounded-lg shadow-sm border border-white/10 hover:border-transparent transition-all active:scale-95 group"
                  >
                    <Wallet className="w-4 h-4 text-[var(--color-primary)] group-hover:text-slate-950 transition-colors" />
                    <span className="font-mono text-xs font-semibold">{formattedAddress}</span>
                    <ChevronDown className={`w-3 h-3 ml-1 transition-transform duration-300 ${isConnectedDropdownOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </div>

                {/* Profile/Disconnect Dropdown */}
                {isConnectedDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="absolute right-0 top-full mt-2 w-52 bg-[#111421]/95 border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-50 overflow-hidden flex flex-col gap-1 backdrop-blur-3xl"
                  >
                    <div className="px-3 py-2 text-sm text-[#a1a1aa] border-b border-white/5 mb-1">
                      <span className="text-white block font-medium mb-1">Connected Wallet</span>
                      {formattedAddress}
                    </div>
                    <button
                      onClick={() => { disconnect(); setIsConnectedDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm font-medium text-red-500 hover:bg-white/5 rounded-lg transition-colors"
                    >
                      Disconnect
                    </button>
                  </motion.div>
                )}
              </div>
            ) : (
              <div className="relative">
                <Button
                  onClick={() => setIsWalletPopoverOpen(!isWalletPopoverOpen)}
                  className={`relative group h-10 px-6 font-bold transition-all duration-300 overflow-hidden ${isWalletPopoverOpen
                      ? 'bg-[var(--color-primary)] text-slate-950 scale-95 shadow-[var(--glow-gold)]'
                      : 'bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)] hover:text-slate-950 transition-colors'
                    }`}
                >
                  <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--color-primary)] to-transparent group-hover:opacity-100 opacity-0 transition-opacity" />
                  <div className="flex items-center gap-2 relative z-10 font-display">
                    <Wallet className="w-4 h-4" />
                    Connect
                  </div>
                </Button>

                {/* The Dropdown Popover List */}
                <ConnectWalletPopover
                  isOpen={isWalletPopoverOpen}
                  onClose={() => setIsWalletPopoverOpen(false)}
                  onConnect={async (walletId, address) => {
                    await connect(walletId, address); // ← Nhận address
                  }}
                />
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-[var(--color-text-muted)] hover:text-white transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden glass border-t border-white/10 p-4 flex flex-col gap-4">
          <a href="#swap" className="block px-3 py-2 text-base font-medium rounded-md hover:bg-white/10">Swap</a>
          <a href="#stake" className="block px-3 py-2 text-base font-medium rounded-md hover:bg-white/10">Stake</a>

          <div className="pt-4 border-t border-white/10">
            {isConnected ? (
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center px-3">
                  <span className="text-sm text-[var(--color-text-muted)]">Balance</span>
                  <span className="font-semibold text-[var(--color-primary-light)]">{balance} SEP</span>
                </div>
                <Button variant="secondary" className="w-full justify-center" onClick={disconnect}>
                  Disconnect ({formattedAddress})
                </Button>
              </div>
            ) : (
              <Button className="w-full justify-center" onClick={() => connect()}>
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
