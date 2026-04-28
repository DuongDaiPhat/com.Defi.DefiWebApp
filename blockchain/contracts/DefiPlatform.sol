// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                      DeFiPlatform                           ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  Hợp đồng cho phép user gửi (stake) và rút (unstake)        ║
 * ║  token ERC-20. Tích hợp 3 lớp bảo mật:                     ║
 * ║   • ReentrancyGuard — chặn tấn công gọi lại hàm            ║
 * ║   • Pausable        — tạm dừng khẩn cấp toàn bộ hệ thống   ║
 * ║   • Ownable         — phân quyền admin cho Owner            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
contract DeFiPlatform is ReentrancyGuard, Pausable, Ownable {

    // SafeERC20 bọc các hàm transfer/transferFrom của IERC20
    // → tự động xử lý token không trả về bool (tránh silent fail)
    using SafeERC20 for IERC20;

    // Địa chỉ token ERC-20 dùng để stake — không thể thay đổi sau deploy
    IERC20 public immutable stakingToken;

    // Tổng lượng token đang được lock trong hợp đồng (tất cả user cộng lại)
    uint256 public totalStaked;
    bool public emergencyMode;

    // Số dư stake của từng user
    // stakeBalance[0xABC...] = 500 → user 0xABC đang stake 500 token
    mapping(address => uint256) public stakeBalance;

    // Thời điểm (unix timestamp) user stake lần gần nhất
    // Dùng để tính reward hoặc enforce thời gian lock-up sau này
    mapping(address => uint256) public lastStakeTime;

    // =============================================================
    //  EVENTS — ghi log lên blockchain để frontend/dApp theo dõi
    // =============================================================

    // Phát ra khi user stake thành công
    event Staked(address indexed user, uint256 amount, uint256 newBalance);

    // Phát ra khi user unstake thành công
    event Unstaked(address indexed user, uint256 amount, uint256 newBalance);

    // Phát ra khi Owner rút khẩn cấp toàn bộ token
    event EmergencyWithdrawn(address indexed owner, uint256 amount);

    // =============================================================
    //  CUSTOM ERRORS — tiết kiệm gas hơn revert string thông thường
    // =============================================================

    // Lỗi khi user truyền _amount = 0
    error ZeroAmount();

    // Lỗi khi user unstake nhiều hơn số dư đang có
    // VD: stake 100, unstake 150 → revert InsufficientStakeBalance(150, 100)
    error InsufficientStakeBalance(uint256 requested, uint256 available);

    /**
     * @param _stakingToken  Địa chỉ hợp đồng ERC-20 sẽ được dùng để stake
     *
     * Ví dụ deploy (Hardhat):
     *   const platform = await DeFiPlatform.deploy(token.target);
     */
    constructor(address _stakingToken) Ownable(msg.sender) {
        require(_stakingToken != address(0), "DeFiPlatform: zero token address");
        stakingToken = IERC20(_stakingToken);
    }

    /**
     * @notice  Gửi token vào hợp đồng để stake.
     * ─────────────────────────────────────────────────────────────
     * Trước khi gọi hàm này, user phải approve đủ token:
     *   await token.approve(platform.target, amount)
     *
     * Bảo mật:
     *   • nonReentrant  — khóa hàm, tránh bị gọi lại trước khi hoàn tất
     *   • whenNotPaused — từ chối nếu Owner đã pause hợp đồng
     *
     * Luồng xử lý (CEI pattern — Checks → Effects → Interactions):
     *   1. CHECK      — kiểm tra _amount > 0
     *   2. EFFECTS    — cập nhật số dư trong mapping TRƯỚC
     *   3. INTERACTION — sau đó mới chuyển token vào hợp đồng
     *   ⚠️  Thứ tự này rất quan trọng: nếu đảo lại, hacker có thể
     *       lợi dụng re-entrancy để rút tiền nhiều lần.
     *
     * @param _amount  Số token muốn stake (đơn vị: wei, tức 10^-18 SKT)
     */
    function stake(uint256 _amount)
        external
        nonReentrant
        whenNotPaused
    {
        // Không cho stake 0 token 
        if (_amount == 0) revert ZeroAmount();

        // Cập nhật state trước khi chuyển token
        stakeBalance[msg.sender] += _amount;   // tăng số dư của user
        totalStaked              += _amount;   // tăng tổng toàn hợp đồng
        lastStakeTime[msg.sender] = block.timestamp; // ghi lại thời điểm stake

        // Kéo token từ ví user vào hợp đồng
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        // Ghi log để frontend lắng nghe sự kiện
        emit Staked(msg.sender, _amount, stakeBalance[msg.sender]);
    }

    /**
     * @notice  Rút token đã stake về ví của mình.
     * ─────────────────────────────────────────────────────────────
     * Bảo mật: nonReentrant + whenNotPaused (giống hàm stake)
     * Luồng:   CEI pattern — giảm số dư TRƯỚC, transfer SAU.
     *
     * @param _amount  Số token muốn rút (không được vượt quá số dư đang stake)
     */
    function unstake(uint256 _amount)
        external
        nonReentrant
        whenNotPaused
    {
        // Không cho rút 0 token
        if (_amount == 0) revert ZeroAmount();

        // Không cho rút nhiều hơn số dư đang stake
        uint256 userBalance = stakeBalance[msg.sender];
        if (_amount > userBalance)
            revert InsufficientStakeBalance(_amount, userBalance);

        // Trừ số dư trước khi chuyển token ra ngoài
        stakeBalance[msg.sender] -= _amount;  // giảm số dư của user
        totalStaked              -= _amount;  // giảm tổng toàn hợp đồng

        // Chuyển token về ví user
        stakingToken.safeTransfer(msg.sender, _amount);

        emit Unstaked(msg.sender, _amount, stakeBalance[msg.sender]);
    }

    // =============================================================
    //  ADMIN FUNCTIONS — chỉ Owner mới được gọi
    // =============================================================

    /**
     * @notice  Tạm dừng toàn bộ stake / unstake.
     * Dùng khi: phát hiện lỗ hổng, đang nâng cấp, hoặc xử lý sự cố.
     * Khi pause: mọi lệnh stake/unstake đều bị từ chối tự động.
     */
    function pause() external onlyOwner {
        _pause(); // hàm nội bộ của OpenZeppelin Pausable
    }

    /**
     * @notice  Mở lại hợp đồng sau khi đã xử lý xong sự cố.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice  Rút toàn bộ token về ví Owner trong tình huống khẩn cấp.
     * ─────────────────────────────────────────────────────────────
     * ⚠️  Điều kiện bắt buộc: hợp đồng phải đang ở trạng thái PAUSED.
     *     (Tránh Owner lạm dụng khi hệ thống đang hoạt động bình thường)
     *
     * Sau khi gọi: totalStaked reset về 0, toàn bộ token chuyển cho Owner.
     * Lưu ý: stakeBalance của từng user vẫn còn trong mapping —
     *         cần xử lý hoàn tiền off-chain hoặc qua cơ chế riêng.
     */
    function emergencyWithdraw() external onlyOwner whenPaused {
        uint256 balance = stakingToken.balanceOf(address(this));
        require(balance > 0, "DeFiPlatform: nothing to withdraw");

        totalStaked = 0; // reset tổng về 0
        emergencyMode = true;

        stakingToken.safeTransfer(owner(), balance);
        emit EmergencyWithdrawn(owner(), balance);
    }

    // =============================================================
    //  VIEW FUNCTIONS — đọc dữ liệu, không tốn gas khi gọi off-chain
    // =============================================================

    /**
     * @notice  Trả về số token đang stake của một địa chỉ bất kỳ.
     * @param   _user  Địa chỉ cần truy vấn
     * @return  Số token (đơn vị wei)
     *
     * Lưu ý: public mapping `stakeBalance` đã tự sinh getter,
     *        hàm này chỉ là alias rõ nghĩa hơn cho frontend.
     */
    function getStakeBalance(address _user) external view returns (uint256) {
        return stakeBalance[_user];
    }

    /**
     * @notice  Kiểm tra hợp đồng có đang bị tạm dừng không.
     * @return  true = đang pause | false = hoạt động bình thường
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
}
