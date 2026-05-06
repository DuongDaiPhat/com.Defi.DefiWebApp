import { apiClient } from './api';
import axios from 'axios';

// ── Types ─────────────────────────────────────────────────────────────

export interface OSVAQuote {
  alpha: number;       // 0–100
  deadline: number;    // unix timestamp (seconds)
  signature: string;   // 0x-prefixed hex, 65 bytes
  signerAddress: string;
}

export interface OSVAStatus {
  systemReady: boolean;
  currentAlpha: number;
  sigma: string;          // decimal string e.g. "0.01"
  depthFactor: string;    // decimal string e.g. "1.0"
  imbalanceRatio: string; // decimal string e.g. "1.0"
  reserve0: string;       // wei string
  reserve1: string;       // wei string
  lastUpdated: string;    // ISO-8601
  oracleSignerAddress: string;
}

export type QuoteErrorKind = 'validation' | 'oracle_not_ready' | 'network' | 'unknown';

export class OSVAQuoteError extends Error {
  constructor(public readonly kind: QuoteErrorKind, message: string) {
    super(message);
    this.name = 'OSVAQuoteError';
  }
}

// ── API Functions ─────────────────────────────────────────────────────

/**
 * Fetches an OSVA signed quote from the backend.
 * @param user        Wallet address (0x-prefixed)
 * @param tokenIn     Address of the input token (0x-prefixed)
 * @param amountIn    Amount in wei as a BigInt string
 */
export async function getOSVAQuote(
  user: string,
  tokenIn: string,
  amountIn: string,
): Promise<OSVAQuote> {
  try {
    const res = await apiClient.get<{ status: string; data: OSVAQuote }>('/api/v1/osva/quote', {
      params: { user, tokenIn, amountIn },
    });
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const message: string =
        err.response?.data?.message ?? err.message ?? 'Unknown error';

      if (status === 400) throw new OSVAQuoteError('validation', message);
      if (status === 503) throw new OSVAQuoteError('oracle_not_ready', message);
      if (!err.response)  throw new OSVAQuoteError('network', 'Backend không phản hồi');
      throw new OSVAQuoteError('unknown', message);
    }
    throw new OSVAQuoteError('unknown', String(err));
  }
}

/**
 * Fetches current OSVA system status.
 * Polling every 10–15 seconds is recommended.
 */
export async function getOSVAStatus(): Promise<OSVAStatus> {
  try {
    const res = await apiClient.get<{ status: string; data: OSVAStatus }>(
      '/api/v1/osva/status',
    );
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && !err.response) {
      throw new OSVAQuoteError('network', 'Backend không phản hồi');
    }
    throw err;
  }
}

// ── Fallback helpers ──────────────────────────────────────────────────

/** Build a Fallback-V2 quote (alpha=0, empty signature, deadline = now + 5 min) */
export function makeFallbackQuote(): OSVAQuote {
  return {
    alpha: 0,
    deadline: Math.floor(Date.now() / 1000) + 300,
    signature: '0x',
    signerAddress: '',
  };
}
