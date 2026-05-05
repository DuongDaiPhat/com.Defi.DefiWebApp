/**
 * formatters.ts
 * ============================================================
 * Tập trung tất cả hàm format số liệu on-chain ra UI.
 * Không bao giờ format trực tiếp trong components — luôn dùng file này.
 *
 * Nguồn gas estimates: gas_static_report.md (Phase 5 Report)
 * Run date: 2026-05-03, 131 passing tests
 * ============================================================
 */

import { formatUnits } from 'ethers';

// ============================================================
// Token Amounts
// ============================================================

/**
 * Format số thông thường với dấu phẩy phân cách hàng nghìn
 * @example formatNumber(1234.56) → "1,234.56"
 */
export const formatNumber = (num: number | string | undefined | null, decimals = 2): string => {
  if (num === undefined || num === null) return '0';
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(n);
};

/**
 * Format giá trị Wei (string hoặc bigint) sang ETH unit (chia cho 10^18)
 * @example formatWei("1000000000000000000") → "1.0000"
 */
export const formatWei = (wei: string | bigint | undefined | null, decimals = 4): string => {
  if (wei === undefined || wei === null) return '0';
  try {
    // Chuyển sang BigInt an toàn (bỏ phần thập phân nếu có trong chuỗi)
    const weiStr = typeof wei === 'string' ? wei.split('.')[0] : wei.toString();
    const val = BigInt(weiStr);
    const eth = formatUnits(val, 18);
    return formatNumber(eth, decimals);
  } catch (err) {
    console.error('formatWei error', err);
    return '0';
  }
};

/**
 * Format số lượng token từ wei (bigint) ra string đọc được
 * @example fmtToken(1234567890000000000000n, 'SKT') → "1,234.5678 SKT"
 */
export const fmtToken = (
  wei: bigint,
  symbol = '',
  decimals = 4
): string => {
  const raw = parseFloat(formatUnits(wei, 18));
  const formatted = raw.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return symbol ? `${formatted} ${symbol}` : formatted;
};

/**
 * Format số lượng token ngắn (dùng trong badges/pills)
 * @example fmtTokenShort(1234567890000000000000n, 'SKT') → "1.23K SKT"
 */
export const fmtTokenShort = (wei: bigint, symbol = ''): string => {
  const n = parseFloat(formatUnits(wei, 18));
  let formatted: string;
  if (n >= 1_000_000) {
    formatted = `${(n / 1_000_000).toFixed(2)}M`;
  } else if (n >= 1_000) {
    formatted = `${(n / 1_000).toFixed(2)}K`;
  } else {
    formatted = n.toFixed(4);
  }
  return symbol ? `${formatted} ${symbol}` : formatted;
};

/**
 * Format ETH balance (thường ít decimals hơn)
 * @example fmtEth(1500000000000000000n) → "1.5000 ETH"
 */
export const fmtEth = (wei: bigint, decimals = 4): string => {
  const n = parseFloat(formatUnits(wei, 18));
  return `${n.toFixed(decimals)} ETH`;
};

// ============================================================
// Prices & Rates
// ============================================================

/**
 * Format pricePerShare của Vault
 * Từ business doc: pricePerShare = convertToAssets(1e18)
 * @example fmtPricePerShare(1006711n * 10n**12n) → "1 dvSKT = 1.006711 SKT"
 */
export const fmtPricePerShare = (pricePerShare: bigint): string => {
  const price = parseFloat(formatUnits(pricePerShare, 18));
  return `1 dvSKT = ${price.toFixed(6)} SKT`;
};

/**
 * Format tỷ lệ phần trăm từ basis points (bps)
 * @example fmtBps(500n) → "5.00%"
 * @example fmtBps(100) → "1.00%"
 */
export const fmtBps = (bps: bigint | number): string => {
  return `${(Number(bps) / 100).toFixed(2)}%`;
};

/**
 * Format giá trị USD
 * @example fmtUSD(1234.5) → "$1,234.50"
 */
export const fmtUSD = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/**
 * Format % yield/APY với màu (return string và color hint)
 */
export const fmtYieldPct = (
  currentValue: bigint,
  initialValue: bigint
): { text: string; isPositive: boolean } => {
  if (initialValue === BigInt(0)) return { text: '0.00%', isPositive: true };
  const diff = currentValue - initialValue;
  const pct = (Number(formatUnits(diff, 18)) / Number(formatUnits(initialValue, 18))) * 100;
  const isPositive = pct >= 0;
  return {
    text: `${isPositive ? '+' : ''}${pct.toFixed(4)}%`,
    isPositive,
  };
};

// ============================================================
// Time & Lock Status
// ============================================================

/**
 * Format thời gian lock còn lại từ seconds
 * @example fmtLockRemaining(90061) → "1d 1h còn lại"
 * @example fmtLockRemaining(0) → "Đã mở khóa"
 */
export const fmtLockRemaining = (seconds: number): string => {
  if (seconds <= 0) return 'Đã mở khóa';
  const days  = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins  = Math.floor((seconds % 3600) / 60);
  if (days > 0)  return `${days}d ${hours}h còn lại`;
  if (hours > 0) return `${hours}h ${mins}m còn lại`;
  return `${mins}m còn lại`;
};

/**
 * Format % lock progress (đã qua bao nhiêu % so với total lock duration)
 * @returns số từ 0 → 100
 */
export const calcLockProgress = (
  stakedAt: Date,
  lockDurationSeconds: number
): number => {
  if (lockDurationSeconds === 0) return 100;
  const elapsedSeconds = (Date.now() - stakedAt.getTime()) / 1000;
  const progress = Math.min(100, (elapsedSeconds / lockDurationSeconds) * 100);
  return Math.round(progress);
};

/**
 * Format timestamp thành chuỗi ngày tháng
 * @example fmtDate(new Date()) → "04/05/2026, 14:09"
 */
export const fmtDate = (date: Date): string =>
  date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Format thời gian tương đối
 * @example fmtTimeAgo(new Date(Date.now() - 65000)) → "1 phút trước"
 */
export const fmtTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60)  return `${seconds} giây trước`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)  return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)    return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
};

// ============================================================
// Addresses
// ============================================================

/**
 * Rút gọn địa chỉ ví
 * @example fmtAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266") → "0xf39F...2266"
 */
export const fmtAddress = (addr: string): string =>
  `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/** Link đến Etherscan cho transaction */
export const fmtEtherscanTx = (hash: string): string => {
  const base = import.meta.env.VITE_ETHERSCAN_BASE_URL || 'https://sepolia.etherscan.io';
  return `${base}/tx/${hash}`;
};

/** Link đến Etherscan cho địa chỉ contract/wallet */
export const fmtEtherscanAddress = (addr: string): string => {
  const base = import.meta.env.VITE_ETHERSCAN_BASE_URL || 'https://sepolia.etherscan.io';
  return `${base}/address/${addr}`;
};

// ============================================================
// Gas Estimates
// Nguồn: gas_static_report.md — Phase 5 Report (2026-05-03)
// Giá trị AVG GAS từ 131 test cases passing
// ============================================================

/**
 * Ước tính gas trung bình (avg) cho từng operation.
 * Dùng để hiển thị "Est. Gas: ~0.00134 ETH" trước khi ký TX.
 *
 * Nguồn (gas_static_report.md):
 *   Strategy.stake()           avg 329,403 gas
 *   Strategy.unstake()         avg 117,031 gas
 *   Strategy.emergencyWithdraw avg 119,837 gas
 *   Strategy.harvest()         avg  86,445 gas
 *   Vault.deposit()            avg 132,403 gas
 *   Vault.depositWithPermit()  avg 168,460 gas
 *   Vault.redeem()             avg  43,950 gas
 *   Vault.withdraw()           avg  46,877 gas
 *   Vault.mint()               avg 136,993 gas
 */
export const GAS_ESTIMATES = {
  // Strategy (StakingStrategyController)
  strategyStake:            329_403n,
  strategyUnstake:          117_031n,
  strategyEmergencyWithdraw: 119_837n,
  strategyHarvest:           86_445n,

  // DefiVault (ERC-4626)
  vaultDeposit:             132_403n,
  vaultDepositWithPermit:   168_460n,
  vaultRedeem:               43_950n,
  vaultWithdraw:             46_877n,
  vaultMint:                136_993n,
} as const;

/**
 * Format ước tính chi phí gas ra ETH
 * @param gasUnits  Số gas units (từ GAS_ESTIMATES)
 * @param gasPriceGwei  Gas price Gwei hiện tại (default 10 Gwei)
 * @example fmtGasEstimate(GAS_ESTIMATES.strategyStake) → "~0.00329 ETH"
 */
export const fmtGasEstimate = (gasUnits: bigint, gasPriceGwei = 10): string => {
  const costEth = (Number(gasUnits) * gasPriceGwei) / 1e9;
  return `~${costEth.toFixed(5)} ETH`;
};

/**
 * Format số thập phân với dấu phẩy phân cách hàng nghìn (Alias cho formatNumber)
 */
export const formatDecimal = (num: number | string | undefined | null, decimals = 2): string => {
  return formatNumber(num, decimals);
};

/**
 * Parse chuỗi số sang kiểu số thực an toàn
 */
export const parseDecimal = (num: string | undefined | null): number => {
  if (!num) return 0;
  const n = parseFloat(num);
  return isNaN(n) ? 0 : n;
};

// ============================================================
// Rounding Rule Helpers (ERC-4626 Business Rule Display)
// ============================================================

/**
 * Trả về giải thích rounding rule cho từng operation.
 * Dùng để hiển thị tooltip trong UI giải thích tại sao có sự chênh lệch.
 */
export const getVaultRoundingNote = (action: 'deposit' | 'mint' | 'withdraw' | 'redeem'): string => {
  switch (action) {
    case 'deposit':
      return 'Shares nhận được làm tròn XUỐNG để bảo vệ vault khỏi sai số.';
    case 'mint':
      return 'Tài sản cần nạp làm tròn LÊN để đảm bảo vault nhận đủ.';
    case 'redeem':
      return 'Tài sản nhận được làm tròn XUỐNG để bảo vệ vault khỏi sai số.';
    case 'withdraw':
      return 'Shares cần đốt làm tròn LÊN để đảm bảo vault trả đủ tài sản.';
  }
};
