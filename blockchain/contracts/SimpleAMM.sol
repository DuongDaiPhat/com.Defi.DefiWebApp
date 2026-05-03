// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SimpleAMM is ERC20, ReentrancyGuard {
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint256 public reserve0;
    uint256 public reserve1;

    // Minimum liquidity to lock upon first provision to prevent division by zero and ensure permanent minimum value
    uint256 public constant MINIMUM_LIQUIDITY = 10**3;

    event LiquidityAdded(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event LiquidityRemoved(address indexed provider, uint256 amount0, uint256 amount1, uint256 shares);
    event Swap(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _token0, address _token1) ERC20("Simple AMM LP Token", "SAMM-LP") {
        require(_token0 != _token1, "SimpleAMM: IDENTICAL_ADDRESSES");
        require(_token0 != address(0) && _token1 != address(0), "SimpleAMM: ZERO_ADDRESS");
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    /**
     * @dev Thêm thanh khoản vào pool. Hệ thống sẽ tự tính toán số lượng chính xác để giữ nguyên tỷ lệ của pool hiện tại.
     * @param amount0Desired Số lượng token0 user muốn nạp.
     * @param amount1Desired Số lượng token1 user muốn nạp.
     */
    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1, uint256 shares)
    {
        if (reserve0 == 0 && reserve1 == 0) {
            amount0 = amount0Desired;
            amount1 = amount1Desired;
            // Công thức tính LP share ban đầu dựa trên trung bình nhân
            shares = _sqrt(amount0 * amount1);
            
            // Khóa vĩnh viễn 1 lượng nhỏ LP token đầu tiên để chống tấn công lạm phát
            shares -= MINIMUM_LIQUIDITY;
            _mint(address(1), MINIMUM_LIQUIDITY);
        } else {
            // Pool đã có thanh khoản -> phải nạp theo tỷ lệ hiện hành (reserve0 / reserve1)
            uint256 amount1Optimal = (amount0Desired * reserve1) / reserve0;
            if (amount1Optimal <= amount1Desired) {
                // Thoả mãn điều kiện token1 cung cấp
                amount0 = amount0Desired;
                amount1 = amount1Optimal;
            } else {
                // Không đủ token1 tối ưu -> ưu tiên xài lượng amount1Desired của token1, tính lại token0
                uint256 amount0Optimal = (amount1Desired * reserve0) / reserve1;
                require(amount0Optimal <= amount0Desired, "AMM: Lacking token0 desired");
                amount0 = amount0Optimal;
                amount1 = amount1Desired;
            }
            
            // Tính số LP token sinh ra tỷ lệ với lượng góp vốn (ưu tiên tỷ lệ thấp hơn để đảm bảo an toàn cho LP khác)
            uint256 shares0 = (amount0 * totalSupply()) / reserve0;
            uint256 shares1 = (amount1 * totalSupply()) / reserve1;
            shares = shares0 < shares1 ? shares0 : shares1;
        }

        require(shares > 0, "AMM: Shares = 0");

        // Chuyển tiền từ ví user vào hợp đồng
        require(token0.transferFrom(msg.sender, address(this), amount0), "Transfer 0 failed");
        require(token1.transferFrom(msg.sender, address(this), amount1), "Transfer 1 failed");

        // Cập nhật State
        reserve0 += amount0;
        reserve1 += amount1;

        // Phát LP token cho user
        _mint(msg.sender, shares);

        emit LiquidityAdded(msg.sender, amount0, amount1, shares);
    }

    /**
     * @dev Rút thanh khoản từ pool. User đốt LP token để lấy lại cả 2 loại token. 
     */
    function removeLiquidity(uint256 shares) 
        external 
        nonReentrant 
        returns (uint256 amount0, uint256 amount1) 
    {
        require(shares > 0, "AMM: Shares = 0");
        uint256 _totalSupply = totalSupply();
        
        // Tính ra lượng tiền tương ứng rút về dựa theo số share user sở hữu trong totalSupply
        amount0 = (shares * reserve0) / _totalSupply;
        amount1 = (shares * reserve1) / _totalSupply;

        require(amount0 > 0 && amount1 > 0, "AMM: Returns = 0");

        // Đốt LP token của user
        _burn(msg.sender, shares);

        // Update reserves
        reserve0 -= amount0;
        reserve1 -= amount1;

        // Trả tiền cho user
        require(token0.transfer(msg.sender, amount0), "Transfer 0 failed");
        require(token1.transfer(msg.sender, amount1), "Transfer 1 failed");

        emit LiquidityRemoved(msg.sender, amount0, amount1, shares);
    }

    /**
     * @dev Hoán đổi (Swap) token.
     * @param _tokenIn Địa chỉ của loại token muốn bán đi.
     * @param _amountIn Số lượng tokenIn bán đi.
     * @param _minAmountOut Số token tối thiểu muốn nhận lại (để phòng trượt giá Slippage).
     */
    function swap(address _tokenIn, uint256 _amountIn, uint256 _minAmountOut) 
        external 
        nonReentrant 
        returns (uint256 amountOut) 
    {
        require(_amountIn > 0, "AMM: AmountIn = 0");
        require(_tokenIn == address(token0) || _tokenIn == address(token1), "AMM: Invalid token");

        // B1: Xác định tokenIn và tokenOut để ánh xạ chuẩn với reserve
        bool isToken0 = _tokenIn == address(token0);
        IERC20 tokenIn = isToken0 ? token0 : token1;
        IERC20 tokenOut = isToken0 ? token1 : token0;
        uint256 reserveIn = isToken0 ? reserve0 : reserve1;
        uint256 reserveOut = isToken0 ? reserve1 : reserve0;

        require(reserveIn > 0 && reserveOut > 0, "AMM: Empty Pool");

        // B2: Chuyển token từ ví người dùng vào Contract AMM
        // Ở bước này, pool sẽ thu luôn (ví dụ) 0.3% phí swap (được mô phỏng luôn trong code bên dưới)
        require(tokenIn.transferFrom(msg.sender, address(this), _amountIn), "Transfer in failed");

        // B3: Tính phí giao dịch (vd: áp dụng fee 0.3%) 
        // 0.3% phí -> Lượng tiền thực sự mang đi nhân chéo là lượng tiền đã trừ phí
        // amountInWithFee = _amountIn * 997 / 1000
        uint256 amountInWithFee = (_amountIn * 997) / 1000;

        // B4: Áp dụng công thức Constant Product Formula: x * y = k
        // NewReserveIn = ReserveIn + amountInWithFee
        // (ReserveIn + amountInWithFee) * (ReserveOut - AmountOut) = ReserveIn * ReserveOut
        // => AmountOut = (ReserveOut * amountInWithFee) / (ReserveIn + amountInWithFee)
        amountOut = (reserveOut * amountInWithFee) / (reserveIn + amountInWithFee);
        
        // B5: Kiểm tra Slippage limit (mức trượt giá) 
        require(amountOut >= _minAmountOut, "AMM: Insufficient output amount (Slippage)");

        // B6: Trả tokenOut ra cho người dùng
        require(tokenOut.transfer(msg.sender, amountOut), "Transfer out failed");

        // B7: Cập nhật biến trạng thái (Reserve) của Pool
        // Số tiền thực tế reserve cộng thêm sẽ lớn hơn amountInWithFee vì phần chênh lệch (fee) ở lại trong pool chia đều cho LP provider.
        if (isToken0) {
            reserve0 += _amountIn;      
            reserve1 -= amountOut;      
        } else {
            reserve1 += _amountIn;      
            reserve0 -= amountOut;      
        }

        emit Swap(msg.sender, _tokenIn, _amountIn, amountOut);
    }

    // Helper library - Hàm phụ trợ tính Căn bậc 2
    function _sqrt(uint y) private pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
