export interface VaultInfo {
  totalAssets: string;      // SKT in wei format
  totalSupply: string;      // dvSKT in wei format
  pricePerShare: string;    // SKT per 1 dvSKT
  paused: boolean;
  userShares?: string;      // current user's dvSKT balance
  userAssetValue?: string;  // SKT value of user's shares (previewRedeem result)
}

// Thêm các interface call payload
export interface VaultDepositPayload {
    amount: string;     // Lượng SKT muốn deposit
    minShares: string;  // Tránh slippage
}

export interface VaultRedeemPayload {
    shares: string;     // Lượng dvSKT muốn redeem
    minAssets: string;  // Lượng SKT tối thiểu nhận được (Slippage)
}

export interface DefiVaultAction {
  type: 'DEPOSIT' | 'MINT' | 'WITHDRAW' | 'REDEEM';
  assets: string;
  shares: string;
  hash: string;
}
