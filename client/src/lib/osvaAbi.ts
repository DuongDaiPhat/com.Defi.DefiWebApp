// ============================================================
//  OSVA Pool ABI — Minimal ABI for frontend interactions
// ============================================================

export const OSVA_POOL_ABI = [
  // View functions
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function reserve0() view returns (uint128)",
  "function reserve1() view returns (uint128)",
  "function oracleSigner() view returns (address)",
  "function MAX_ALPHA() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",

  // Swap
  "function swapOSVA(address _tokenIn, uint256 _amountIn, uint256 _minAmountOut, uint256 _alpha, uint256 _deadline, bytes _signature) returns (uint256 amountOut)",

  // Liquidity
  "function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 deadline) returns (uint256 amount0, uint256 amount1, uint256 shares)",
  "function removeLiquidity(uint256 shares, uint256 deadline) returns (uint256 amount0, uint256 amount1)",

  // Events
  "event Swap(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut, uint256 alpha)",
  "event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares)",
  "event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares)",
] as const;

// ============================================================
//  ERC-20 ABI — Minimal for token interactions
// ============================================================

export const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function totalSupply() view returns (uint256)",
] as const;

// ============================================================
//  Contract Addresses
// ============================================================

export const OSVA_POOL_ADDRESS = import.meta.env.VITE_OSVA_POOL_ADDRESS as string;

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_HEX = "0xaa36a7";
