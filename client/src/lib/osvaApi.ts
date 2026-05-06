import apiClient from './api';

// ============================================================
//  Types
// ============================================================

export interface OsvaQuoteData {
  alpha: number;
  deadline: number;
  signature: string;
  signerAddress: string;
}

export interface OsvaStatusData {
  systemReady: boolean;
  currentAlpha: number;
  sigma: string;
  depthFactor: string;
  imbalanceRatio: string;
  reserve0: string;
  reserve1: string;
  lastUpdated: string;
  oracleSignerAddress: string;
}

// ============================================================
//  GET /api/v1/osva/quote
// ============================================================

export async function fetchOsvaQuote(
  user: string,
  tokenIn: string,
  amountInWei: string
): Promise<OsvaQuoteData> {
  const { data } = await apiClient.get('/v1/osva/quote', {
    params: { user, tokenIn, amountIn: amountInWei },
  });

  if (data.status !== 'success') {
    throw new Error(data.message || 'Quote request failed');
  }

  return data.data as OsvaQuoteData;
}

// ============================================================
//  GET /api/v1/osva/status
// ============================================================

export async function fetchOsvaStatus(): Promise<OsvaStatusData> {
  const { data } = await apiClient.get('/v1/osva/status');

  if (data.status !== 'success') {
    throw new Error(data.message || 'Status request failed');
  }

  return data.data as OsvaStatusData;
}
