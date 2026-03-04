import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────
export interface Token {
  symbol: string;
  name: string;
  balance: number;
  usdPrice: number;
  icon: string; // emoji placeholder
}

export interface Transaction {
  id: string;
  hash: string;
  type: 'Swap' | 'Stake' | 'Unstake' | 'Claim';
  status: 'Success' | 'Failed' | 'Pending';
  from: string;
  to: string;
  amount: string;
  gasUsed: string;
  gasPrice: string;
  blockConfirmations: number;
  timestamp: number;
}

export interface StakingInfo {
  totalStaked: number;
  apy: number;
  pendingRewards: number;
  nextDistribution: number; // timestamp
}

export interface PricePoint {
  date: string;
  price: number;
  volume: number;
}

export interface AnalyticsData {
  priceHistory: PricePoint[];
  tvl: number;
  activeStakers: number;
  volume24h: number;
  gasFees: { type: string; avgGas: number }[];
}

// ─── Mock Data ──────────────────────────────────────────
const MOCK_TOKENS: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', balance: 5.234, usdPrice: 2450, icon: 'Ξ' },
  { symbol: 'WDFI', name: 'WebDeFi Token', balance: 1250, usdPrice: 1.85, icon: 'W' },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', hash: '0xa1b2c3d4e5f6789012345678901234567890abcd', type: 'Swap', status: 'Success', from: '0.5 ETH', to: '125 WDFI', amount: '0.5 ETH', gasUsed: '21000', gasPrice: '25 Gwei', blockConfirmations: 12, timestamp: Date.now() - 3600000 },
  { id: '2', hash: '0xb2c3d4e5f67890123456789012345678901234ef', type: 'Stake', status: 'Success', from: '200 WDFI', to: 'Staking Pool', amount: '200 WDFI', gasUsed: '45000', gasPrice: '30 Gwei', blockConfirmations: 8, timestamp: Date.now() - 7200000 },
  { id: '3', hash: '0xc3d4e5f678901234567890123456789012345678', type: 'Claim', status: 'Success', from: 'Rewards', to: 'Wallet', amount: '5.2 WDFI', gasUsed: '32000', gasPrice: '22 Gwei', blockConfirmations: 15, timestamp: Date.now() - 14400000 },
  { id: '4', hash: '0xd4e5f6789012345678901234567890123456789a', type: 'Swap', status: 'Failed', from: '1.0 ETH', to: '250 WDFI', amount: '1.0 ETH', gasUsed: '21000', gasPrice: '45 Gwei', blockConfirmations: 0, timestamp: Date.now() - 28800000 },
  { id: '5', hash: '0xe5f67890123456789012345678901234567890bc', type: 'Unstake', status: 'Success', from: 'Staking Pool', to: '100 WDFI', amount: '100 WDFI', gasUsed: '38000', gasPrice: '28 Gwei', blockConfirmations: 20, timestamp: Date.now() - 43200000 },
  { id: '6', hash: '0xf678901234567890123456789012345678901234', type: 'Swap', status: 'Pending', from: '0.3 ETH', to: '75 WDFI', amount: '0.3 ETH', gasUsed: '0', gasPrice: '35 Gwei', blockConfirmations: 1, timestamp: Date.now() - 60000 },
  { id: '7', hash: '0x1234567890abcdef1234567890abcdef12345678', type: 'Stake', status: 'Success', from: '300 WDFI', to: 'Staking Pool', amount: '300 WDFI', gasUsed: '48000', gasPrice: '20 Gwei', blockConfirmations: 25, timestamp: Date.now() - 86400000 },
  { id: '8', hash: '0x234567890abcdef1234567890abcdef123456789', type: 'Claim', status: 'Success', from: 'Rewards', to: 'Wallet', amount: '7.3 WDFI', gasUsed: '31000', gasPrice: '18 Gwei', blockConfirmations: 30, timestamp: Date.now() - 129600000 },
  { id: '9', hash: '0x34567890abcdef1234567890abcdef1234567890', type: 'Swap', status: 'Success', from: '2.0 ETH', to: '500 WDFI', amount: '2.0 ETH', gasUsed: '21000', gasPrice: '32 Gwei', blockConfirmations: 45, timestamp: Date.now() - 172800000 },
  { id: '10', hash: '0x4567890abcdef1234567890abcdef12345678901', type: 'Unstake', status: 'Success', from: 'Staking Pool', to: '50 WDFI', amount: '50 WDFI', gasUsed: '36000', gasPrice: '24 Gwei', blockConfirmations: 50, timestamp: Date.now() - 259200000 },
];

function generatePriceHistory(days: number): PricePoint[] {
  const data: PricePoint[] = [];
  let price = 1.5;
  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    price += (Math.random() - 0.48) * 0.15;
    price = Math.max(0.8, Math.min(3.0, price));
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      price: parseFloat(price.toFixed(2)),
      volume: Math.floor(Math.random() * 500000 + 100000),
    });
  }
  return data;
}

const MOCK_ANALYTICS: AnalyticsData = {
  priceHistory: generatePriceHistory(30),
  tvl: 2400000,
  activeStakers: 1247,
  volume24h: 856000,
  gasFees: [
    { type: 'Swap', avgGas: 0.0021 },
    { type: 'Stake', avgGas: 0.0035 },
    { type: 'Unstake', avgGas: 0.0030 },
    { type: 'Claim', avgGas: 0.0018 },
  ],
};

const CONTRACT_ADDRESSES = {
  token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  staking: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  swap: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
};

// ─── Hook ──────────────────────────────────────────────
export function useDashboardMock() {
  const [tokens] = useState<Token[]>(MOCK_TOKENS);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [staking, setStaking] = useState<StakingInfo>({
    totalStaked: 500,
    apy: 15.6,
    pendingRewards: 12.5,
    nextDistribution: Date.now() + 3600000 * 4, // 4 hours from now
  });
  const [analytics] = useState<AnalyticsData>(MOCK_ANALYTICS);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [networkStatus, setNetworkStatus] = useState<'connected' | 'disconnected'>('connected');

  // Simulated countdown
  const [countdown, setCountdown] = useState('');
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      const diff = staking.nextDistribution - Date.now();
      if (diff <= 0) {
        setCountdown('00:00:00');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [staking.nextDistribution]);

  // Portfolio
  const totalUSD = useMemo(() => 
    tokens.reduce((sum, t) => sum + t.balance * t.usdPrice, 0) + staking.totalStaked * 1.85 + staking.pendingRewards * 1.85,
  [tokens, staking.totalStaked, staking.pendingRewards]);

  const portfolioBreakdown = useMemo(() => [
    { name: 'ETH', value: tokens[0].balance * tokens[0].usdPrice, color: '#627EEA' },
    { name: 'WDFI', value: tokens[1].balance * tokens[1].usdPrice, color: '#f59e0b' },
    { name: 'Staked', value: staking.totalStaked * 1.85, color: '#8b5cf6' },
    { name: 'Rewards', value: staking.pendingRewards * 1.85, color: '#10b981' },
  ], [tokens, staking.totalStaked, staking.pendingRewards]);

  // Exchange rate
  const exchangeRate = 250; // 1 ETH = 250 WDFI
  const gasEstimate = 0.0021;

  // Swap
  const performSwap = useCallback(async (amount: number) => {
    setIsSwapping(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const newTx: Transaction = {
          id: String(Date.now()),
          hash: `0x${Math.random().toString(16).slice(2, 42)}`,
          type: 'Swap',
          status: 'Success',
          from: `${amount} ETH`,
          to: `${amount * exchangeRate} WDFI`,
          amount: `${amount} ETH`,
          gasUsed: '21000',
          gasPrice: '25 Gwei',
          blockConfirmations: 1,
          timestamp: Date.now(),
        };
        setTransactions(prev => [newTx, ...prev]);
        setIsSwapping(false);
        resolve();
      }, 2000);
    });
  }, [exchangeRate]);

  // Stake
  const performStake = useCallback(async (amount: number) => {
    setIsStaking(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setStaking(prev => ({ ...prev, totalStaked: prev.totalStaked + amount }));
        const newTx: Transaction = {
          id: String(Date.now()),
          hash: `0x${Math.random().toString(16).slice(2, 42)}`,
          type: 'Stake',
          status: 'Success',
          from: `${amount} WDFI`,
          to: 'Staking Pool',
          amount: `${amount} WDFI`,
          gasUsed: '45000',
          gasPrice: '30 Gwei',
          blockConfirmations: 1,
          timestamp: Date.now(),
        };
        setTransactions(prev => [newTx, ...prev]);
        setIsStaking(false);
        resolve();
      }, 2000);
    });
  }, []);

  // Unstake
  const performUnstake = useCallback(async (amount: number) => {
    setIsStaking(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setStaking(prev => ({ ...prev, totalStaked: Math.max(0, prev.totalStaked - amount) }));
        const newTx: Transaction = {
          id: String(Date.now()),
          hash: `0x${Math.random().toString(16).slice(2, 42)}`,
          type: 'Unstake',
          status: 'Success',
          from: 'Staking Pool',
          to: `${amount} WDFI`,
          amount: `${amount} WDFI`,
          gasUsed: '38000',
          gasPrice: '28 Gwei',
          blockConfirmations: 1,
          timestamp: Date.now(),
        };
        setTransactions(prev => [newTx, ...prev]);
        setIsStaking(false);
        resolve();
      }, 2000);
    });
  }, []);

  // Claim
  const claimRewards = useCallback(async () => {
    setIsClaiming(true);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const claimed = staking.pendingRewards;
        setStaking(prev => ({ ...prev, pendingRewards: 0 }));
        const newTx: Transaction = {
          id: String(Date.now()),
          hash: `0x${Math.random().toString(16).slice(2, 42)}`,
          type: 'Claim',
          status: 'Success',
          from: 'Rewards',
          to: 'Wallet',
          amount: `${claimed} WDFI`,
          gasUsed: '32000',
          gasPrice: '22 Gwei',
          blockConfirmations: 1,
          timestamp: Date.now(),
        };
        setTransactions(prev => [newTx, ...prev]);
        setIsClaiming(false);
        resolve();
      }, 1500);
    });
  }, [staking.pendingRewards]);

  // Faucet / Mint (mock)
  const requestFaucet = useCallback(async () => {
    return new Promise<string>((resolve) => {
      setTimeout(() => resolve('0.5 SepoliaETH sent to your wallet!'), 1500);
    });
  }, []);

  const mintTestTokens = useCallback(async () => {
    return new Promise<string>((resolve) => {
      setTimeout(() => resolve('100 WDFI minted to your wallet!'), 1500);
    });
  }, []);

  return useMemo(() => ({
    // Portfolio
    tokens,
    totalUSD,
    portfolioBreakdown,
    change24h: 3.42,

    // Swap
    exchangeRate,
    gasEstimate,
    slippage,
    setSlippage,
    isSwapping,
    performSwap,

    // Staking
    staking,
    isStaking,
    isClaiming,
    countdown,
    performStake,
    performUnstake,
    claimRewards,

    // Transactions
    transactions,

    // Analytics
    analytics,

    // Tools
    contractAddresses: CONTRACT_ADDRESSES,
    networkStatus,
    setNetworkStatus,
    requestFaucet,
    mintTestTokens,
  }), [
    tokens, totalUSD, portfolioBreakdown, exchangeRate, gasEstimate, slippage, isSwapping, performSwap,
    staking, isStaking, isClaiming, countdown, performStake, performUnstake, claimRewards,
    transactions, analytics, networkStatus, setNetworkStatus, requestFaucet, mintTestTokens
  ]);
}
