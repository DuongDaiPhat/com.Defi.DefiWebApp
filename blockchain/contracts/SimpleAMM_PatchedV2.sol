// SPDX-License-Identifier: MIT
pragma solidity 0.8.35;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimpleAmm is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token0;
    IERC20 public immutable token1;

    // G006: Nén 2 biến reserve vào 1 slot duy nhất (256-bit)
    uint128 public reserve0;
    uint128 public reserve1;

    uint256 private constant MINIMUM_LIQUIDITY = 1e3;

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event Swap(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);

    // Security: Chặn MEV Bot ngâm giao dịch (Sandwich Attack)
    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "AMM: EXPIRED_TRANSACTION");
        _;
    }

    // G004: payable constructor tiết kiệm gas
    constructor(address _token0, address _token1) payable ERC20("Simple AMM LP Token", "SAMM-LP") {
        require(_token0 != address(0) && _token1 != address(0), "AMM: ZERO_ADDRESS");
        require(_token0 != _token1, "AMM: IDENTICAL_ADDRESSES");
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 deadline)
        external
        nonReentrant
        ensure(deadline)
        returns (uint256 amount0, uint256 amount1, uint256 shares)
    {
        require(amount0Desired > 0 && amount1Desired > 0, "AMM: Zero desired amount");

        // G011: Cache memory
        uint256 _reserve0 = reserve0;
        uint256 _reserve1 = reserve1;

        if (_reserve0 == 0 && _reserve1 == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            shares = _sqrt(amount0 * amount1);
            require(shares > MINIMUM_LIQUIDITY, "AMM: Insufficient initial liquidity");
            shares -= MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY);
        } else {
            uint256 _totalSupply = totalSupply();
            require(_totalSupply > 0, "AMM: Zero total supply");

            uint256 amount1Optimal = _mulDiv(amount0Desired, _reserve1, _reserve0);
            if (amount1Optimal <= amount1Desired) {
                amount0 = amount0Desired;
                amount1 = amount1Optimal;
            } else {
                uint256 amount0Optimal = _mulDiv(amount1Desired, _reserve0, _reserve1);
                require(amount0Optimal <= amount0Desired, "AMM: Insufficient token0 desired");
                amount0 = amount0Optimal;
                amount1 = amount1Desired;
            }

            uint256 shares0 = _mulDiv(amount0, _totalSupply, _reserve0);
            uint256 shares1 = _mulDiv(amount1, _totalSupply, _reserve1);
            shares = shares0 < shares1 ? shares0 : shares1;
        }

        require(shares != 0, "AMM: Zero shares");

        // Security: Xử lý Fee-on-Transfer Tokens bằng cách tính số dư thực nhận
        uint256 balance0Before = token0.balanceOf(address(this));
        token0.safeTransferFrom(msg.sender, address(this), amount0);
        uint256 actualAmount0 = token0.balanceOf(address(this)) - balance0Before;

        uint256 balance1Before = token1.balanceOf(address(this));
        token1.safeTransferFrom(msg.sender, address(this), amount1);
        uint256 actualAmount1 = token1.balanceOf(address(this)) - balance1Before;

        // Ép kiểu về uint128 (an toàn với các số liệu Testnet/Mainnet thông thường)
        reserve0 = uint128(_reserve0 + actualAmount0);
        reserve1 = uint128(_reserve1 + actualAmount1);

        _mint(msg.sender, shares);
        emit LiquidityAdded(msg.sender, actualAmount0, actualAmount1, shares);
    }

    function removeLiquidity(uint256 shares, uint256 deadline)
        external
        nonReentrant
        ensure(deadline)
        returns (uint256 amount0, uint256 amount1)
    {
        require(shares != 0, "AMM: Zero shares");

        uint256 _totalSupply = totalSupply();
        uint256 _reserve0   = reserve0;
        uint256 _reserve1   = reserve1;

        require(_totalSupply != 0, "AMM: Zero total supply");

        amount0 = _mulDiv(shares, _reserve0, _totalSupply);
        amount1 = _mulDiv(shares, _reserve1, _totalSupply);

        require(amount0 != 0 && amount1 != 0, "AMM: Zero return amounts");

        _burn(msg.sender, shares);

        reserve0 = uint128(_reserve0 - amount0);
        reserve1 = uint128(_reserve1 - amount1);

        token0.safeTransfer(msg.sender, amount0);
        token1.safeTransfer(msg.sender, amount1);

        emit LiquidityRemoved(msg.sender, amount0, amount1, shares);
    }

    function swap(address _tokenIn, uint256 _amountIn, uint256 _minAmountOut, uint256 deadline)
        external
        nonReentrant
        ensure(deadline)
        returns (uint256 amountOut)
    {
        require(_amountIn != 0, "AMM: Zero amountIn");
        require(_tokenIn != address(0), "AMM: Zero token address");
        require(_tokenIn == address(token0) || _tokenIn == address(token1), "AMM: Invalid token");

        bool isToken0   = _tokenIn == address(token0);
        IERC20 tokenIn  = isToken0 ? token0 : token1;
        IERC20 tokenOut = isToken0 ? token1 : token0;

        uint256 reserveIn  = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;

        require(reserveIn != 0 && reserveOut != 0, "AMM: Empty pool");

        // B1: Kéo token vào và tính lượng THỰC NHẬN (chống Tax Token)
        uint256 balanceInBefore = tokenIn.balanceOf(address(this));
        tokenIn.safeTransferFrom(msg.sender, address(this), _amountIn);
        uint256 actualAmountIn = tokenIn.balanceOf(address(this)) - balanceInBefore;

        // B2 & B3: Phí 0.3% & Công thức Constant Product
        uint256 amountInWithFee = (actualAmountIn * 997) / 1000;
        amountOut = _mulDiv(reserveOut, amountInWithFee, reserveIn + amountInWithFee);

        // B4: Check Slippage
        require(amountOut >= _minAmountOut, "AMM: Slippage exceeded");
        require(amountOut != 0, "AMM: Zero output amount");

        // B5: Trả tokenOut
        tokenOut.safeTransfer(msg.sender, amountOut);

        // B6: Update Reserves theo lượng tiền TỔNG thực tế pool nhận (chứa cả fee)
        if (isToken0) {
            reserve0 = uint128(reserveIn  + actualAmountIn);
            reserve1 = uint128(reserveOut - amountOut);
        } else {
            reserve1 = uint128(reserveIn  + actualAmountIn);
            reserve0 = uint128(reserveOut - amountOut);
        }

        emit Swap(msg.sender, _tokenIn, actualAmountIn, amountOut);
    }

    // G008: Bit-shift thay cho phép chia
    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = (y >> 1) + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) >> 1;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _mulDiv(uint256 a, uint256 b, uint256 denominator) private pure returns (uint256 result) {
        require(denominator != 0, "AMM: Division by zero");
        result = (a * b) / denominator;
    }
}