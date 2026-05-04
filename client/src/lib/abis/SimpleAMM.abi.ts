export const SimpleAMMABI = [
  // Views
  "function getReserves() view returns (uint256 _reserve0, uint256 _reserve1, uint32 _blockTimestampLast)",
  "function reserve0() view returns (uint256)",
  "function reserve1() view returns (uint256)",
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256 amountOut)",
  
  // Actions
  "function swap(uint256 amountIn, uint256 amountOutMin, bool zeroForOne) returns (uint256 amountOut)",
  "function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min) returns (uint256 amount0, uint256 amount1, uint256 liquidity)",
  "function removeLiquidity(uint256 liquidity, uint256 amount0Min, uint256 amount1Min) returns (uint256 amount0, uint256 amount1)"
];
