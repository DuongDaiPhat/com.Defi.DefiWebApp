// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IDefiVault.sol";
import "./interfaces/IStrategy.sol";

/**
 * @title StakingStrategyController
 * @dev Strategy Controller kết nối với DefiVault (ERC4626) để tạo ra dynamic yield.
 *
 * Kiến trúc Strategy-Vault (Yearn V2/V3 style):
 *   User → stake() → Strategy giữ token → deposit vào Vault → nhận Shares
 *   User → unstake() → Strategy redeem Shares từ Vault → nhận Assets (gốc + yield)
 *   Owner → harvest() → donate realized gain vào Vault → pricePerShare tăng
 *
 * So sánh với WalletStaking.sol (baseline):
 *   - WalletStaking: Fixed APR, token nằm trong contract, claimReward() riêng biệt.
 *   - StakingStrategyController: Dynamic yield qua pricePerShare, token nằm trong Vault.
 *
 * KHÔNG chỉnh sửa WalletStaking.sol — file đó chỉ dùng làm baseline cho NCKH.
 */
contract StakingStrategyController is Ownable, ReentrancyGuard, Pausable, IStrategy {
    using SafeERC20 for IERC20;

    // ============================================================
    //  STRUCTS
    // ============================================================

    struct StakingPool {
        uint256 id;
        string  name;
        uint256 lockDuration;   // Thời gian khóa (giây)
        uint256 penaltyRate;    // Phí rút sớm (basis points, 100 = 1%)
        uint256 minStake;       // Số lượng tối thiểu
        uint256 maxStake;       // Số lượng tối đa (0 = không giới hạn)
        uint256 totalStaked;    // Tổng principal đang active trong pool (tracking only)
        bool    isActive;
    }

    struct StakeInfo {
        uint256 poolId;
        uint256 shares;         // Vault shares đại diện cho position (principal + yield)
        uint256 assetsAtStake;  // Snapshot principal lúc stake (để tính yield delta và penalty)
        uint256 stakedAt;       // Thời điểm stake
        bool    isActive;
    }

    // ============================================================
    //  STATE VARIABLES
    // ============================================================

    IERC20     public immutable stakingToken; // == vault.asset()
    IDefiVault private immutable _vault;      // ERC4626 Vault — use vault() getter

    uint256 public constant BASIS_POINTS = 10_000;

    /// @dev Tracking principal đang active — chỉ dùng monitoring, KHÔNG dùng tài chính.
    uint256 public totalStaked;
    uint256 public totalDeployedToVault;

    /// @dev Tracking thống kê cho NCKH
    uint256 public totalHarvested;
    uint256 public totalPenalties;

    StakingPool[] public pools;

    // user => stakeId => StakeInfo
    mapping(address => mapping(uint256 => StakeInfo)) public userStakes;
    // user => tổng số lần stake
    mapping(address => uint256) public userStakeCount;

    // ============================================================
    //  EVENTS
    // ============================================================

    event PoolAdded(uint256 indexed poolId, string name, uint256 lockDuration);
    event PoolUpdated(uint256 indexed poolId, bool isActive);
    event Staked(address indexed user, uint256 indexed poolId, uint256 stakeId, uint256 amount);
    event VaultDeposited(address indexed user, uint256 stakeId, uint256 assets, uint256 shares);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 assets, uint256 penalty);
    event VaultRedeemed(address indexed user, uint256 stakeId, uint256 shares, uint256 assets);
    event YieldGenerated(address indexed user, uint256 stakeId, uint256 yield);
    event PenaltyCollected(address indexed user, uint256 stakeId, uint256 penalty);
    event EmergencyWithdrawn(address indexed user, uint256 indexed stakeId, uint256 assets);
    event Harvested(uint256 rewardAmount);

    // ============================================================
    //  ERRORS
    // ============================================================

    error PoolNotFound();
    error PoolInactive();
    error AmountTooLow();
    error AmountTooHigh();
    error StakeNotActive();
    error HarvestAmountZero();
    error TokenMismatch();

    // ============================================================
    //  CONSTRUCTOR
    // ============================================================

    /**
     * @param _stakingToken Token dùng để stake — phải bằng vault.asset().
     * @param vaultAddress_ Địa chỉ ERC4626 DefiVault.
     */
    constructor(address _stakingToken, address vaultAddress_) Ownable(msg.sender) {
        if (IDefiVault(vaultAddress_).asset() != _stakingToken) revert TokenMismatch();

        stakingToken = IERC20(_stakingToken);
        _vault = IDefiVault(vaultAddress_);

        // Khởi tạo các pool mặc định (bỏ APR vì yield đến từ Vault)
        _addPool(unicode"Linh hoạt",  0,        0,          1e18,   0);       // Không khóa, không penalty
        _addPool(unicode"Đồng",       30 days,  200,        10e18,  0);       // 30 ngày, 2% penalty
        _addPool(unicode"Bạc",        90 days,  500,        50e18,  0);       // 90 ngày, 5% penalty
        _addPool(unicode"Vàng",       180 days, 1000,       100e18, 0);       // 180 ngày, 10% penalty
    }

    // ============================================================
    //  ISTRATEGY INTERFACE
    // ============================================================

    /// @inheritdoc IStrategy
    function vault() external view returns (address) {
        return address(_vault);
    }

    /// @inheritdoc IStrategy
    function totalDeployed() external view returns (uint256) {
        return totalDeployedToVault;
    }

    // ============================================================
    //  ADMIN FUNCTIONS
    // ============================================================

    function addPool(
        string calldata name,
        uint256 lockDuration,
        uint256 penaltyRate,
        uint256 minStake,
        uint256 maxStake
    ) external onlyOwner {
        _addPool(name, lockDuration, penaltyRate, minStake, maxStake);
    }

    function _addPool(
        string memory name,
        uint256 lockDuration,
        uint256 penaltyRate,
        uint256 minStake,
        uint256 maxStake
    ) internal {
        uint256 poolId = pools.length;
        pools.push(StakingPool({
            id:           poolId,
            name:         name,
            lockDuration: lockDuration,
            penaltyRate:  penaltyRate,
            minStake:     minStake,
            maxStake:     maxStake,
            totalStaked:  0,
            isActive:     true
        }));
        emit PoolAdded(poolId, name, lockDuration);
    }

    function updatePool(uint256 poolId, bool isActive) external onlyOwner {
        if (poolId >= pools.length) revert PoolNotFound();
        pools[poolId].isActive = isActive;
        emit PoolUpdated(poolId, isActive);
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ============================================================
    //  HARVEST — inject yield vào Vault
    // ============================================================

    /**
     * @notice Owner/Keeper inject realized gain vào Vault để tăng pricePerShare.
     * @dev QUAN TRỌNG: Dùng safeTransfer thẳng vào Vault address (donation/realized gain),
     *      KHÔNG gọi vault.deposit() vì sẽ mint thêm shares cho Strategy và làm sai accounting.
     *      Kết quả: totalAssets tăng, totalSupply giữ nguyên → pricePerShare tăng cho mọi staker.
     * @param rewardAmount Lượng stakingToken để donate vào Vault.
     */
    function harvest(uint256 rewardAmount) external override onlyOwner nonReentrant {
        if (rewardAmount == 0) revert HarvestAmountZero();

        // Owner transfer token vào Strategy
        stakingToken.safeTransferFrom(msg.sender, address(this), rewardAmount);

        // Donate trực tiếp vào Vault — tăng totalAssets không tăng totalSupply
        stakingToken.safeTransfer(address(_vault), rewardAmount);

        totalHarvested += rewardAmount;
        emit Harvested(rewardAmount);
    }

    // ============================================================
    //  STAKING FUNCTIONS
    // ============================================================

    /**
     * @notice Stake token vào pool. Token sẽ được deposit vào Vault, Strategy giữ Shares.
     * @param poolId ID của pool muốn stake.
     * @param amount Lượng stakingToken muốn stake.
     */
    function stake(uint256 poolId, uint256 amount) external nonReentrant whenNotPaused {
        if (poolId >= pools.length) revert PoolNotFound();
        StakingPool storage pool = pools[poolId];
        if (!pool.isActive) revert PoolInactive();
        if (amount < pool.minStake) revert AmountTooLow();
        if (pool.maxStake > 0 && amount > pool.maxStake) revert AmountTooHigh();

        // Nhận token từ user
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Approve Vault rồi deposit — Strategy nhận Shares
        stakingToken.forceApprove(address(_vault), amount);
        uint256 sharesReceived = _vault.deposit(amount);

        // Lưu position với shares (thay vì raw amount)
        uint256 stakeId = userStakeCount[msg.sender];
        userStakes[msg.sender][stakeId] = StakeInfo({
            poolId:       poolId,
            shares:       sharesReceived,
            assetsAtStake: amount,
            stakedAt:     block.timestamp,
            isActive:     true
        });

        userStakeCount[msg.sender]++;
        pool.totalStaked       += amount;
        totalStaked            += amount;
        totalDeployedToVault   += amount;

        emit Staked(msg.sender, poolId, stakeId, amount);
        emit VaultDeposited(msg.sender, stakeId, amount, sharesReceived);
    }

    /**
     * @notice Unstake và nhận lại assets từ Vault (gốc + yield, trừ penalty nếu rút sớm).
     * @param stakeId ID của lần stake muốn rút.
     */
    function unstake(uint256 stakeId) external nonReentrant whenNotPaused {
        StakeInfo storage stake_ = userStakes[msg.sender][stakeId];
        if (!stake_.isActive) revert StakeNotActive();

        StakingPool storage pool = pools[stake_.poolId];

        // Cache values trước khi cập nhật state
        uint256 sharesToRedeem = stake_.shares;
        uint256 principal      = stake_.assetsAtStake;
        bool isEarlyWithdraw   = block.timestamp < stake_.stakedAt + pool.lockDuration;

        // CEI: cập nhật state TRƯỚC external call để chống reentrancy
        stake_.isActive      = false;
        stake_.shares        = 0;
        stake_.assetsAtStake = 0;
        pool.totalStaked     -= principal;
        totalStaked          -= principal;
        totalDeployedToVault -= principal;

        // Redeem shares từ Vault → nhận assets (gốc + yield)
        uint256 assetsReturned = _vault.redeem(sharesToRedeem);

        // Tính yield
        uint256 yieldAmount = assetsReturned > principal ? assetsReturned - principal : 0;

        // Tính penalty (trên principal snapshot, cap theo assetsReturned để không underflow nếu Vault loss)
        uint256 rawPenalty = isEarlyWithdraw
            ? (principal * pool.penaltyRate) / BASIS_POINTS
            : 0;
        uint256 penalty = rawPenalty > assetsReturned ? assetsReturned : rawPenalty;

        totalPenalties += penalty;

        uint256 toReturn = assetsReturned - penalty;
        stakingToken.safeTransfer(msg.sender, toReturn);

        emit VaultRedeemed(msg.sender, stakeId, sharesToRedeem, assetsReturned);
        if (yieldAmount > 0) emit YieldGenerated(msg.sender, stakeId, yieldAmount);
        if (penalty > 0)     emit PenaltyCollected(msg.sender, stakeId, penalty);
        emit Unstaked(msg.sender, stakeId, assetsReturned, penalty);
    }

    /**
     * @notice Rút khẩn cấp — bỏ qua lock, áp penalty đầy đủ theo pool.
     * @dev Không check whenNotPaused để user luôn có thể rút trong trường hợp khẩn cấp.
     * @param stakeId ID của lần stake muốn rút khẩn cấp.
     */
    function emergencyWithdraw(uint256 stakeId) external nonReentrant {
        StakeInfo storage stake_ = userStakes[msg.sender][stakeId];
        if (!stake_.isActive) revert StakeNotActive();

        StakingPool storage pool = pools[stake_.poolId];

        // Cache trước khi update state
        uint256 sharesToRedeem = stake_.shares;
        uint256 principal      = stake_.assetsAtStake;

        // CEI: cập nhật state TRƯỚC external call
        stake_.isActive      = false;
        stake_.shares        = 0;
        stake_.assetsAtStake = 0;
        pool.totalStaked     -= principal;
        totalStaked          -= principal;
        totalDeployedToVault -= principal;

        // Redeem từ Vault
        uint256 assetsReturned = _vault.redeem(sharesToRedeem);

        // Áp penalty đầy đủ theo pool (cap theo assetsReturned)
        uint256 rawPenalty = (principal * pool.penaltyRate) / BASIS_POINTS;
        uint256 penalty    = rawPenalty > assetsReturned ? assetsReturned : rawPenalty;

        totalPenalties += penalty;

        uint256 toReturn = assetsReturned - penalty;
        stakingToken.safeTransfer(msg.sender, toReturn);

        if (penalty > 0) emit PenaltyCollected(msg.sender, stakeId, penalty);
        emit EmergencyWithdrawn(msg.sender, stakeId, assetsReturned);
    }

    // ============================================================
    //  VIEW FUNCTIONS
    // ============================================================

    /**
     * @notice Lượng yield đang pending của một position (chưa nhận).
     * @dev yield = previewRedeem(shares) - assetsAtStake. Trả 0 nếu Vault bị loss.
     */
    function getPendingYield(address user, uint256 stakeId) external view returns (uint256) {
        StakeInfo storage stake_ = userStakes[user][stakeId];
        if (!stake_.isActive) return 0;

        uint256 currentValue = _vault.previewRedeem(stake_.shares);
        return currentValue > stake_.assetsAtStake
            ? currentValue - stake_.assetsAtStake
            : 0;
    }

    /**
     * @notice Giá trị hiện tại (assets) của một position theo pricePerShare hiện tại.
     */
    function getStakeValue(address user, uint256 stakeId) external view returns (uint256) {
        StakeInfo storage stake_ = userStakes[user][stakeId];
        if (!stake_.isActive) return 0;
        return _vault.previewRedeem(stake_.shares);
    }

    /**
     * @notice Tổng assets đang nằm trong Vault (totalAssets của Vault).
     * @dev Convenience wrapper để frontend/test dễ query.
     */
    function totalVaultAssets() external view returns (uint256) {
        return _vault.totalAssets();
    }

    function getPool(uint256 poolId) external view returns (StakingPool memory) {
        if (poolId >= pools.length) revert PoolNotFound();
        return pools[poolId];
    }

    function getAllPools() external view returns (StakingPool[] memory) {
        return pools;
    }

    function poolCount() external view returns (uint256) {
        return pools.length;
    }

    /**
     * @notice Kiểm tra xem position có đang bị khóa không và còn bao lâu.
     */
    function isLocked(address user, uint256 stakeId) external view returns (bool locked, uint256 remaining) {
        StakeInfo storage stake_ = userStakes[user][stakeId];
        if (!stake_.isActive) return (false, 0);

        StakingPool storage pool = pools[stake_.poolId];
        uint256 unlockTime = stake_.stakedAt + pool.lockDuration;
        if (block.timestamp >= unlockTime) {
            return (false, 0);
        }
        return (true, unlockTime - block.timestamp);
    }
}
