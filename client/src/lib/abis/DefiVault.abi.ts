export const DefiVaultABI = [
  // ERC20
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  
  // ERC4626 standard
  "function asset() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function convertToShares(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function previewMint(uint256 shares) view returns (uint256)",
  "function previewWithdraw(uint256 assets) view returns (uint256)",
  "function previewRedeem(uint256 shares) view returns (uint256)",
  
  "function deposit(uint256 assets, address receiver) returns (uint256 shares)",
  "function mint(uint256 shares, address receiver) returns (uint256 assets)",
  "function withdraw(uint256 assets, address receiver, address owner) returns (uint256 shares)",
  "function redeem(uint256 shares, address receiver, address owner) returns (uint256 assets)",
  
  // Custom
  "function depositWithSlippage(uint256 assets, address receiver, uint256 minShares) returns (uint256)",
  "function redeemWithSlippage(uint256 shares, address receiver, address owner, uint256 minAssets) returns (uint256)",
  "function paused() view returns (bool)"
];
