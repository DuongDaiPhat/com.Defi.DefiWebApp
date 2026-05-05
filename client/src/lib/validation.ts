/**
 * validation.ts
 * ============================================================
 * Tập trung toàn bộ validation logic cho UI.
 * Mọi form/action phải gọi các hàm này trước khi submit.
 *
 * Nguyên tắc:
 * - fail-fast: trả về lỗi đầu tiên ngay lập tức
 * - Không bao giờ throw exception ra ngoài, chỉ trả ValidationResult
 * - warning ≠ error: warning hiển thị nhưng vẫn cho phép submit
 * ============================================================
 */

import { parseUnits, formatUnits } from 'ethers';
import type { StrategyPoolData as StrategyPool, UserStrategyStake as StrategyStake } from '../types/strategy.types';

// ============================================================
// Core Type
// ============================================================

export interface ValidationResult {
  ok: boolean;
  message?: string;  // Lỗi chặn — hiển thị đỏ, disable button
  warning?: string;  // Cảnh báo — hiển thị vàng, vẫn cho phép submit
}

/** Trả về lỗi đầu tiên trong danh sách (fail-fast) */
export const firstFail = (results: ValidationResult[]): ValidationResult => {
  return results.find(r => !r.ok) ?? { ok: true };
};

// ============================================================
// A. Network & Wallet Guards
// — Phải là checks ĐẦU TIÊN trong mọi validator composite
// ============================================================

/** Wallet phải được kết nối */
export const requireWallet = (isConnected: boolean): ValidationResult => {
  if (!isConnected) {
    return { ok: false, message: 'Vui lòng kết nối ví MetaMask trước khi thực hiện giao dịch' };
  }
  return { ok: true };
};

/** Phải đang ở đúng mạng (Sepolia) */
export const requireCorrectNetwork = (chainId: number | null): ValidationResult => {
  const required = Number(import.meta.env.VITE_CHAIN_ID || 11155111);
  if (chainId === null) {
    return { ok: false, message: 'Không thể đọc chainId. Kiểm tra lại kết nối ví.' };
  }
  if (chainId !== required) {
    const name = import.meta.env.VITE_NETWORK_NAME || 'Sepolia';
    return {
      ok: false,
      message: `Sai mạng. Vui lòng chuyển sang ${name} (ChainId: ${required}) trong MetaMask.`,
    };
  }
  return { ok: true };
};

/** Contract address phải được cấu hình */
export const requireContractAddress = (address: string | undefined, name = 'Contract'): ValidationResult => {
  if (!address || address.trim().length === 0) {
    return { ok: false, message: `${name} chưa được cấu hình. Liên hệ admin.` };
  }
  return { ok: true };
};

// ============================================================
// B. Amount Primitives
// ============================================================

/** Số lượng phải dương và hợp lệ */
export const validatePositiveAmount = (value: string, label = 'Số lượng'): ValidationResult => {
  if (!value || value.trim() === '') {
    return { ok: false, message: `Vui lòng nhập ${label}` };
  }
  const n = parseFloat(value);
  if (isNaN(n) || !isFinite(n)) {
    return { ok: false, message: `${label} không hợp lệ` };
  }
  if (n <= 0) {
    return { ok: false, message: `${label} phải lớn hơn 0` };
  }
  return { ok: true };
};

/** Số dư ví phải đủ cho lượng cần dùng */
export const validateSufficientBalance = (
  amount: string,
  balance: bigint,
  symbol = 'token',
  decimals = 18
): ValidationResult => {
  try {
    const amountWei = parseUnits(amount, decimals);
    if (amountWei > balance) {
      const maxFormatted = parseFloat(formatUnits(balance, decimals)).toFixed(4);
      return {
        ok: false,
        message: `Số dư không đủ. Tối đa: ${maxFormatted} ${symbol}`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Số lượng không hợp lệ (lỗi parse)' };
  }
};

/** Shares phải không vượt số shares user đang nắm giữ */
export const validateSufficientShares = (
  shares: string,
  userShareBalance: bigint
): ValidationResult => {
  try {
    const sharesWei = parseUnits(shares, 18);
    if (sharesWei > userShareBalance) {
      const maxFormatted = parseFloat(formatUnits(userShareBalance, 18)).toFixed(4);
      return {
        ok: false,
        message: `Shares không đủ. Tối đa: ${maxFormatted} dvSKT`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Số lượng shares không hợp lệ' };
  }
};

// ============================================================
// C. Vault (ERC-4626) Validators
// ============================================================

/** Vault không được bị Paused */
export const validateVaultNotPaused = (paused: boolean): ValidationResult => {
  if (paused) {
    return {
      ok: false,
      message: '⚠️ Vault đang ở chế độ khẩn cấp (Paused). Tất cả giao dịch bị tạm dừng. Liên hệ admin.',
    };
  }
  return { ok: true };
};

/** Lượng nạp không vượt maxDeposit của Vault */
export const validateVaultMaxDeposit = (amount: string, maxDeposit: bigint): ValidationResult => {
  if (maxDeposit === BigInt(0)) return { ok: true }; // maxDeposit = 0 nghĩa là không giới hạn
  try {
    const amountWei = parseUnits(amount, 18);
    if (amountWei > maxDeposit) {
      const maxFormatted = parseFloat(formatUnits(maxDeposit, 18)).toFixed(4);
      return {
        ok: false,
        message: `Vault giới hạn nạp tối đa ${maxFormatted} SKT mỗi lần giao dịch`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Số lượng không hợp lệ' };
  }
};

/** Lượng rút không vượt maxWithdraw của Vault */
export const validateVaultMaxWithdraw = (amount: string, maxWithdraw: bigint): ValidationResult => {
  if (maxWithdraw === BigInt(0)) return { ok: true };
  try {
    const amountWei = parseUnits(amount, 18);
    if (amountWei > maxWithdraw) {
      const maxFormatted = parseFloat(formatUnits(maxWithdraw, 18)).toFixed(4);
      return {
        ok: false,
        message: `Vault giới hạn rút tối đa ${maxFormatted} SKT mỗi lần giao dịch`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Số lượng không hợp lệ' };
  }
};

/** Lượng shares redeem không vượt maxRedeem */
export const validateVaultMaxRedeem = (shares: string, maxRedeem: bigint): ValidationResult => {
  if (maxRedeem === BigInt(0)) return { ok: true };
  try {
    const sharesWei = parseUnits(shares, 18);
    if (sharesWei > maxRedeem) {
      const maxFormatted = parseFloat(formatUnits(maxRedeem, 18)).toFixed(4);
      return {
        ok: false,
        message: `Vault giới hạn redeem tối đa ${maxFormatted} dvSKT mỗi lần giao dịch`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, message: 'Số lượng không hợp lệ' };
  }
};

/**
 * Unified entry point for Vault Action Panel (Deposit/Redeem)
 * Trả về { isValid, error } để tương thích với VaultActionPanel.tsx
 */
export const validateVaultInput = (
  amount: string,
  balance: string,
  mode: 'DEPOSIT' | 'REDEEM'
): { isValid: boolean; error: string | null } => {
  const amountRes = validatePositiveAmount(amount, mode === 'DEPOSIT' ? 'SKT' : 'shares');
  if (!amountRes.ok) return { isValid: false, error: amountRes.message || null };

  try {
    const amountWei = parseUnits(amount, 18);
    const balanceWei = BigInt(balance);

    if (amountWei > balanceWei) {
      return { 
        isValid: false, 
        error: `Số dư không đủ. Tối đa: ${parseFloat(formatUnits(balanceWei, 18)).toFixed(4)} ${mode === 'DEPOSIT' ? 'SKT' : 'dvSKT'}` 
      };
    }
  } catch {
    return { isValid: false, error: 'Số lượng không hợp lệ' };
  }

  return { isValid: true, error: null };
};

// --- Composite Vault Validators ---

export interface VaultDepositParams {
  isConnected: boolean;
  chainId: number | null;
  paused: boolean;
  amount: string;
  userSktBalance: bigint;
  maxDeposit: bigint;
}

/** Validate toàn bộ trước khi deposit vào Vault */
export const validateVaultDeposit = (p: VaultDepositParams): ValidationResult =>
  firstFail([
    requireWallet(p.isConnected),
    requireCorrectNetwork(p.chainId),
    validateVaultNotPaused(p.paused),
    validatePositiveAmount(p.amount, 'Số SKT'),
    validateSufficientBalance(p.amount, p.userSktBalance, 'SKT'),
    validateVaultMaxDeposit(p.amount, p.maxDeposit),
  ]);

export interface VaultRedeemParams {
  isConnected: boolean;
  chainId: number | null;
  paused: boolean;
  shares: string;
  userShareBalance: bigint;
  maxRedeem: bigint;
}

/** Validate toàn bộ trước khi redeem shares từ Vault */
export const validateVaultRedeem = (p: VaultRedeemParams): ValidationResult =>
  firstFail([
    requireWallet(p.isConnected),
    requireCorrectNetwork(p.chainId),
    validateVaultNotPaused(p.paused),
    validatePositiveAmount(p.shares, 'Số dvSKT'),
    validateSufficientShares(p.shares, p.userShareBalance),
    validateVaultMaxRedeem(p.shares, p.maxRedeem),
  ]);

export interface VaultWithdrawParams {
  isConnected: boolean;
  chainId: number | null;
  paused: boolean;
  assets: string;
  maxWithdraw: bigint;
  /** maxShares user cần đốt (tính từ previewWithdraw với slippage ceil) */
  requiredShares: bigint;
  userShareBalance: bigint;
}

/** Validate cho Vault withdraw (muốn rút đúng X SKT, đốt Y shares) */
export const validateVaultWithdraw = (p: VaultWithdrawParams): ValidationResult =>
  firstFail([
    requireWallet(p.isConnected),
    requireCorrectNetwork(p.chainId),
    validateVaultNotPaused(p.paused),
    validatePositiveAmount(p.assets, 'Số SKT muốn rút'),
    validateVaultMaxWithdraw(p.assets, p.maxWithdraw),
    // Shares cần đốt phải không vượt số shares đang có
    (() => {
      if (p.requiredShares > p.userShareBalance) {
        const needed = parseFloat(formatUnits(p.requiredShares, 18)).toFixed(4);
        const have   = parseFloat(formatUnits(p.userShareBalance, 18)).toFixed(4);
        return {
          ok: false,
          message: `Không đủ shares để rút. Cần ${needed} dvSKT, đang có ${have} dvSKT`,
        };
      }
      return { ok: true };
    })(),
  ]);

export interface VaultMintParams {
  isConnected: boolean;
  chainId: number | null;
  paused: boolean;
  shares: string;
  /** Tài sản cần nạp (tính từ previewMint với slippage ceil) */
  requiredAssets: bigint;
  userSktBalance: bigint;
  maxMint: bigint;
}

/** Validate cho Vault mint (muốn nhận đúng Y dvSKT, nạp X SKT) */
export const validateVaultMint = (p: VaultMintParams): ValidationResult =>
  firstFail([
    requireWallet(p.isConnected),
    requireCorrectNetwork(p.chainId),
    validateVaultNotPaused(p.paused),
    validatePositiveAmount(p.shares, 'Số dvSKT muốn nhận'),
    // maxMint check
    (() => {
      if (p.maxMint === BigInt(0)) return { ok: true };
      try {
        const sharesWei = parseUnits(p.shares, 18);
        if (sharesWei > p.maxMint) {
          const maxFormatted = parseFloat(formatUnits(p.maxMint, 18)).toFixed(4);
          return { ok: false, message: `Vault giới hạn mint tối đa ${maxFormatted} dvSKT` };
        }
      } catch {/* handled below */}
      return { ok: true };
    })(),
    // Tài sản cần thiết phải không vượt balance
    (() => {
      if (p.requiredAssets > p.userSktBalance) {
        const needed = parseFloat(formatUnits(p.requiredAssets, 18)).toFixed(4);
        const have   = parseFloat(formatUnits(p.userSktBalance, 18)).toFixed(4);
        return {
          ok: false,
          message: `Cần ${needed} SKT để mint, nhưng chỉ có ${have} SKT`,
        };
      }
      return { ok: true };
    })(),
  ]);

// ============================================================
// D. Strategy Staking Validators
// ============================================================

export interface StakeParams {
  isConnected: boolean;
  chainId: number | null;
  pool: StrategyPool | null;
  amount: string;
  userSktBalance: bigint;
}

/** Validate toàn bộ trước khi stake vào Strategy pool */
export const validateStake = (p: StakeParams): ValidationResult =>
  firstFail([
    requireWallet(p.isConnected),
    requireCorrectNetwork(p.chainId),
    (() => !p.pool
      ? { ok: false, message: 'Vui lòng chọn một pool staking' }
      : { ok: true }
    )(),
    (() => p.pool && !p.pool.isActive
      ? { ok: false, message: 'Pool này hiện không hoạt động. Chọn pool khác.' }
      : { ok: true }
    )(),
    validatePositiveAmount(p.amount, 'Số SKT'),
    validateSufficientBalance(p.amount, p.userSktBalance, 'SKT'),
    // minStake
    (() => {
      if (!p.pool) return { ok: true };
      try {
        const amountWei = parseUnits(p.amount, 18);
        if (amountWei < BigInt(p.pool.minStake)) {
          const minFormatted = parseFloat(formatUnits(p.pool.minStake, 18)).toFixed(2);
          return { ok: false, message: `Số tiền tối thiểu để stake là ${minFormatted} SKT` };
        }
      } catch { /* handled by validatePositiveAmount */ }
      return { ok: true };
    })(),
    // maxStake (0 = không giới hạn)
    (() => {
      if (!p.pool || p.pool.maxStake === '0') return { ok: true };
      try {
        const amountWei = parseUnits(p.amount, 18);
        if (amountWei > BigInt(p.pool.maxStake)) {
          const maxFormatted = parseFloat(formatUnits(p.pool.maxStake, 18)).toFixed(2);
          return { ok: false, message: `Số tiền tối đa mỗi vị thế là ${maxFormatted} SKT` };
        }
      } catch { /* ignore */ }
      return { ok: true };
    })(),
  ]);

export interface UnstakeParams {
  isConnected: boolean;
  chainId: number | null;
  stake: StrategyStake | null;
}

/** Validate trước khi unstake bình thường (sẽ bị chặn nếu đang locked) */
export const validateUnstake = (p: UnstakeParams): ValidationResult =>
  firstFail([
    requireWallet(p.isConnected),
    requireCorrectNetwork(p.chainId),
    (() => !p.stake ? { ok: false, message: 'Không tìm thấy vị thế staking' } : { ok: true })(),
    (() => p.stake && !p.stake.isActive ? { ok: false, message: 'Vị thế này đã kết thúc (inactive)' } : { ok: true })(),
    (() => {
      if (!p.stake || !p.stake.isLocked) return { ok: true };
      const remaining = p.stake.lockRemainingSeconds;
      const days  = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      return {
        ok: false,
        message: `Vị thế đang bị khóa (còn ${days}d ${hours}h). Dùng "Rút Khẩn Cấp" nếu cần (có phí phạt).`,
      };
    })(),
  ]);

/** Tạo nội dung cảnh báo cho Emergency Withdraw — BẮT BUỘC hiển thị trước khi confirm */
export const getEmergencyWithdrawWarning = (stake: StrategyStake): {
  penaltyFormatted: string;
  netPayoutFormatted: string;
  principalFormatted: string;
  currentValueFormatted: string;
  confirmMessage: string;
} => {
  const principalFormatted   = parseFloat(formatUnits(stake.assetsAtStake, 18)).toFixed(4);
  const currentValueFormatted = parseFloat(formatUnits(stake.currentValue, 18)).toFixed(4);
  const penaltyFormatted     = parseFloat(formatUnits(stake.penaltyAmount, 18)).toFixed(4);
  const netPayoutFormatted   = parseFloat(formatUnits(stake.netPayout, 18)).toFixed(4);

  const confirmMessage = [
    `⚠️ CẢNH BÁO: RÚT TIỀN TRƯỚC HẠN`,
    ``,
    `Tiền gốc ban đầu:  ${principalFormatted} SKT`,
    `Giá trị hiện tại:  ${currentValueFormatted} SKT`,
    `Phí phạt rút sớm:  ${penaltyFormatted} SKT`,
    `Bạn thực nhận:     ${netPayoutFormatted} SKT`,
    ``,
    `Nhấn OK để xác nhận rút sớm và chấp nhận mất phí phạt.`,
  ].join('\n');

  return { penaltyFormatted, netPayoutFormatted, principalFormatted, currentValueFormatted, confirmMessage };
};

// ============================================================
// E. Swap / AMM Validators
// ============================================================

export interface SwapParams {
  isConnected: boolean;
  chainId: number | null;
  amountIn: string;
  userBalance: bigint;
  reserveIn: bigint;
  reserveOut: bigint;
  slippageBps: number;
}

/** Validate trước khi swap trên SimpleAMM */
export const validateSwap = (p: SwapParams): ValidationResult => {
  // Tính price impact trước (dùng lại trong warning check)
  let impactBps = 0;
  try {
    if (p.amountIn && p.reserveIn > BigInt(0)) {
      const amountWei = parseUnits(p.amountIn, 18);
      impactBps = Number(amountWei * BigInt(10000) / p.reserveIn);
    }
  } catch { /* ignore */ }

  return firstFail([
    requireWallet(p.isConnected),
    requireCorrectNetwork(p.chainId),
    validatePositiveAmount(p.amountIn, 'Số lượng swap'),
    validateSufficientBalance(p.amountIn, p.userBalance, 'token'),
    // Liquidity check
    (() => {
      if (p.reserveOut === BigInt(0)) {
        return { ok: false, message: 'Pool không có thanh khoản để swap' };
      }
      return { ok: true };
    })(),
    // Price impact quá cao (> 15% = block)
    (() => {
      if (impactBps > 1500) {
        return {
          ok: false,
          message: `Price impact quá cao: ${(impactBps / 100).toFixed(1)}% (tối đa 15%). Giảm số lượng swap.`,
        };
      }
      // Warning nếu 5% < impact ≤ 15%
      if (impactBps > 500) {
        return {
          ok: true,
          warning: `Price impact cao: ${(impactBps / 100).toFixed(1)}%. Giao dịch có thể bị trượt giá đáng kể.`,
        };
      }
      return { ok: true };
    })(),
    // Slippage hợp lệ
    validateSlippage(p.slippageBps),
    // Không swap quá 25% thanh khoản pool một lần
    (() => {
      try {
        const amountWei = parseUnits(p.amountIn, 18);
        if (p.reserveIn > BigInt(0) && amountWei > p.reserveIn / BigInt(4)) {
          return {
            ok: false,
            message: 'Số lượng swap quá lớn so với thanh khoản pool. Chia nhỏ giao dịch.',
          };
        }
      } catch { /* ignore */ }
      return { ok: true };
    })(),
  ]);
};

// ============================================================
// F. Slippage Validator (dùng độc lập hoặc trong composite)
// ============================================================

/** Validate slippage tolerance */
export const validateSlippage = (bps: number): ValidationResult => {
  const maxBps = Number(import.meta.env.VITE_MAX_SLIPPAGE_BPS || 3000);
  if (bps < 0) {
    return { ok: false, message: 'Slippage không được âm' };
  }
  if (bps > maxBps) {
    return { ok: false, message: `Slippage tối đa là ${maxBps / 100}%` };
  }
  if (bps > 1000) {
    return { ok: true, warning: `Slippage ${bps / 100}% rất cao. Giao dịch dễ bị MEV front-run.` };
  }
  return { ok: true };
};

// ============================================================
// G. Slippage Math Helpers (ERC-4626 Rounding Rules)
// ============================================================

/**
 * Tính minShares khi deposit (làm tròn XUỐNG để bảo vệ vault)
 * User nhận tối thiểu: previewDeposit(amount) * (1 - slippage)
 */
export const applySlippageFloor = (amount: bigint, slippageBps: number): bigint => {
  if (slippageBps < 0 || slippageBps >= 10000) throw new Error('Invalid slippage');
  return (amount * BigInt(10000 - slippageBps)) / BigInt(10000);
};

/**
 * Tính maxAssets khi mint/withdraw (làm tròn LÊN để bảo vệ vault)
 * User trả tối đa: previewMint(shares) * (1 + slippage)
 */
export const applySlippageCeil = (amount: bigint, slippageBps: number): bigint => {
  if (slippageBps < 0 || slippageBps >= 10000) throw new Error('Invalid slippage');
  return (amount * BigInt(10000 + slippageBps)) / BigInt(10000);
};
