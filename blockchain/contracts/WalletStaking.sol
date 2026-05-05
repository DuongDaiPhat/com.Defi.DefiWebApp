// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WalletStaking
 * @dev Hợp đồng Staking chuyên nghiệp cho hệ thống ví điện tử.
 * Hỗ trợ nhiều pool với lãi suất (APR) và thời gian khóa khác nhau.
 */
contract WalletStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============================================================
    //  STRUCTS
    // ============================================================

    struct StakingPool {
        uint256 id;
        string  name;
        uint256 apr;            // APR theo basis points (100 = 1%, 10000 = 100%)
        uint256 lockDuration;   // Thời gian khóa (giây)
        uint256 penaltyRate;    // Phí rút sớm (basis points)
        uint256 minStake;       // Số lượng tối thiểu
        uint256 maxStake;       // Số lượng tối đa (0 = không giới hạn)
        uint256 totalStaked;    // Tổng đã stake trong pool
        bool    isActive;
    }

    struct StakeInfo {
        uint256 poolId;
        uint256 amount;         // Số lượng stake
        uint256 stakedAt;       // Thời điểm stake
        uint256 lastClaimAt;    // Lần claim cuối
        uint256 pendingReward;  // Reward tích lũy
        bool    isActive;
    }

    // ============================================================
    //  STATE VARIABLES
    // ============================================================

    IERC20 public immutable stakingToken;                          // Token để stake
    IERC20 public immutable rewardToken;                           // Token phát thưởng

    uint256 public constant BASIS_POINTS = 10_000;                 // Đơn vị % (10000 = 100%)
    uint256 public constant SECONDS_IN_YEAR = 365 days;            // Số giây trong 1 năm
    
    uint256 public totalRewardDebt;                                // Biến state để theo dõi tổng nợ reward                                  
    uint256 public totalStaked;                                    // Tổng token đã stake
    uint256 public rewardPoolBalance;                              // Số dư pool thưởng

    StakingPool[] public pools;                                    // Danh sách các pool staking

    mapping(address => mapping(uint256 => StakeInfo)) public userStakes;         // Thông tin stake của user
    mapping(address => uint256) public userStakeCount;             // Số lượt stake của user
    mapping(address => uint256) public totalRewardClaimed;         // Tổng reward đã nhận

    // ============================================================
    //  EVENTS
    // ============================================================

    event PoolAdded(uint256 indexed poolId, string name, uint256 apr, uint256 lockDuration);
    event PoolUpdated(uint256 indexed poolId, uint256 apr, bool isActive);
    event Staked(address indexed user, uint256 indexed poolId, uint256 stakeId, uint256 amount);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 penalty);
    event RewardClaimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event RewardDeposited(address indexed admin, uint256 amount);
    event EmergencyWithdrawn(address indexed user, uint256 indexed stakeId, uint256 amount);

    // ============================================================
    //  ERRORS
    // ============================================================

    error PoolNotFound();
    error PoolInactive();
    error AmountTooLow();
    error AmountTooHigh();
    error StakeNotActive();
    error InsufficientRewardPool();
    error TransferFailed();
    error StillLocked();
    error RewardPoolExhausted();

    // ============================================================
    //  CONSTRUCTOR
    // ============================================================

    constructor(address _stakingToken, address _rewardToken) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);

        // Khởi tạo các pool mặc định
        _addPool(unicode"Linh hoạt", 500, 0, 0, 1e18, 0);             // 5% APR, không khóa
        _addPool(unicode"Đồng", 1200, 30 days, 200, 10e18, 0);       // 12% APR, 30 ngày, 2% penalty
        _addPool(unicode"Bạc", 1800, 90 days, 500, 50e18, 0);        // 18% APR, 90 ngày, 5% penalty
        _addPool(unicode"Vàng", 2500, 180 days, 1000, 100e18, 0);    // 25% APR, 180 ngày, 10% penalty
    }

    // ============================================================
    //  ADMIN FUNCTIONS
    // ============================================================

    function addPool(
        string calldata name,
        uint256 apr,
        uint256 lockDuration,
        uint256 penaltyRate,
        uint256 minStake,
        uint256 maxStake
    ) external onlyOwner {
        _addPool(name, apr, lockDuration, penaltyRate, minStake, maxStake);
    }

    function _addPool(
        string memory name,
        uint256 apr,
        uint256 lockDuration,
        uint256 penaltyRate,
        uint256 minStake,
        uint256 maxStake
    ) internal {
        uint256 poolId = pools.length;
        pools.push(StakingPool({
            id: poolId,
            name: name,
            apr: apr,
            lockDuration: lockDuration,
            penaltyRate: penaltyRate,
            minStake: minStake,
            maxStake: maxStake,
            totalStaked: 0,
            isActive: true
        }));
        emit PoolAdded(poolId, name, apr, lockDuration);
    }

    function updatePool(uint256 poolId, uint256 apr, bool isActive) external onlyOwner {
        if (poolId >= pools.length) revert PoolNotFound();
        pools[poolId].apr = apr;
        pools[poolId].isActive = isActive;
        emit PoolUpdated(poolId, apr, isActive);
    }

    function depositReward(uint256 amount) external onlyOwner {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPoolBalance += amount;
        emit RewardDeposited(msg.sender, amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ============================================================
    //  STAKING FUNCTIONS
    // ============================================================
    function stake(uint256 poolId, uint256 amount) external nonReentrant whenNotPaused {
        if (poolId >= pools.length) revert PoolNotFound();  // check pool tồn tại
        StakingPool storage pool = pools[poolId];
        
        if (!pool.isActive) revert PoolInactive();  // check pool đang active
        if (amount < pool.minStake) revert AmountTooLow();  // check amount trong khoảng phù hợp
        if (pool.maxStake > 0 && amount > pool.maxStake) revert AmountTooHigh();

        // Tính toán phần thưởng dự kiến tối đa cho lượt stake này
        uint256 duration = pool.lockDuration > 0 ? pool.lockDuration : 365 days;
        uint256 estimatedReward = (amount * pool.apr * duration) / (SECONDS_IN_YEAR * BASIS_POINTS);

        // Kiểm tra xem pool thưởng hiện tại có đủ để trả cho tổng nợ cũ + nợ mới không
        if (totalRewardDebt + estimatedReward > rewardPoolBalance) {
            revert RewardPoolExhausted();
        }

        // Cập nhật nợ thưởng toàn hệ thống
        totalRewardDebt += estimatedReward;

        // Thực hiện chuyển token từ user vào contract
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        // Lưu thông tin stake
        uint256 stakeId = userStakeCount[msg.sender];
        userStakes[msg.sender][stakeId] = StakeInfo({
            poolId: poolId,
            amount: amount,
            stakedAt: block.timestamp,
            lastClaimAt: block.timestamp,
            pendingReward: 0,
            isActive: true
        });

        // Cập nhật các chỉ số thống kê
        userStakeCount[msg.sender]++;
        pool.totalStaked += amount;
        totalStaked += amount;

        emit Staked(msg.sender, poolId, stakeId, amount);
    }

    function unstake(uint256 stakeId) external nonReentrant whenNotPaused {
        StakeInfo storage stake_ = userStakes[msg.sender][stakeId];
        if (!stake_.isActive) revert StakeNotActive();

        StakingPool storage pool = pools[stake_.poolId];
        
        // Kiểm tra trạng thái rút sớm
        bool isEarly = block.timestamp < stake_.stakedAt + pool.lockDuration;
        
        // Tính toán Reward
        uint256 totalToClaim = 0;
        if (!isEarly) {
            // Chỉ tính lãi nếu người dùng rút đúng hạn hoặc pool linh hoạt (lockDuration = 0)
            uint256 reward = _calculateReward(msg.sender, stakeId);
            totalToClaim = stake_.pendingReward + reward;
        }

        // Giải phóng nợ dự kiến (Debt Release) để hồi lại hạn mức cho hệ thống
        uint256 duration = pool.lockDuration > 0 ? pool.lockDuration : 365 days;
        uint256 committedReward = (stake_.amount * pool.apr * duration) / (SECONDS_IN_YEAR * BASIS_POINTS);
        
        if (totalRewardDebt >= committedReward) {
            totalRewardDebt -= committedReward;
        }

        // Xử lý phí phạt (Penalty) nếu rút sớm
        uint256 penalty = 0;
        if (isEarly) {
            penalty = (stake_.amount * pool.penaltyRate) / BASIS_POINTS;
        }

        uint256 amountToReturn = stake_.amount - penalty;
        uint256 originalAmount = stake_.amount;

        // Cập nhật trạng thái (State Updates)
        pool.totalStaked -= originalAmount;
        totalStaked -= originalAmount;
        stake_.isActive = false;
        stake_.amount = 0;
        stake_.pendingReward = 0;

        stakingToken.safeTransfer(msg.sender, amountToReturn);

        // Trả reward nếu có 
        if (totalToClaim > 0) {
            if (rewardPoolBalance >= totalToClaim) {
                rewardPoolBalance -= totalToClaim;
                totalRewardClaimed[msg.sender] += totalToClaim;
                rewardToken.safeTransfer(msg.sender, totalToClaim);
                emit RewardClaimed(msg.sender, stakeId, totalToClaim);
            } else {
                revert InsufficientRewardPool(); 
            }
        }
        emit Unstaked(msg.sender, stakeId, originalAmount, penalty);
    }

    function claimReward(uint256 stakeId) external nonReentrant whenNotPaused {
        StakeInfo storage stake_ = userStakes[msg.sender][stakeId];
        if (!stake_.isActive) revert StakeNotActive();

        // Tính reward tích lũy từ lần claim/stake cuối đến hiện tại
        uint256 reward = _calculateReward(msg.sender, stakeId);
        uint256 totalToClaim = stake_.pendingReward + reward;

        if (totalToClaim == 0) return;
        
        // Kiểm tra thanh khoản của Pool thưởng
        if (rewardPoolBalance < totalToClaim) revert InsufficientRewardPool();

        // Vì người dùng đã nhận thưởng thực tế, ta trừ số này vào tổng nợ dự kiến
        if (totalRewardDebt >= totalToClaim) 
            totalRewardDebt -= totalToClaim;
        else 
            totalRewardDebt = 0; 
        

        // Cập nhật trạng thái người dùng và hệ thống
        stake_.pendingReward = 0;
        stake_.lastClaimAt = block.timestamp;
        
        rewardPoolBalance -= totalToClaim;
        totalRewardClaimed[msg.sender] += totalToClaim;

        // 4. Chuyển token và bắn event
        rewardToken.safeTransfer(msg.sender, totalToClaim);
        emit RewardClaimed(msg.sender, stakeId, totalToClaim);
    }

    // ============================================================
    //  VIEW FUNCTIONS
    // ============================================================

    function getPendingReward(address user, uint256 stakeId) external view returns (uint256) {
        StakeInfo storage stake_ = userStakes[user][stakeId];
        if (!stake_.isActive) return stake_.pendingReward;
        return stake_.pendingReward + _calculateReward(user, stakeId);
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

    function isLocked(address user, uint256 stakeId) external view returns (bool locked, uint256 remaining) {
        StakeInfo storage stake_ = userStakes[user][stakeId];
        StakingPool storage pool = pools[stake_.poolId];
        uint256 unlockTime = stake_.stakedAt + pool.lockDuration;
        if (block.timestamp >= unlockTime) {
            return (false, 0);
        }
        return (true, unlockTime - block.timestamp);
    }

    // ============================================================
    //  INTERNAL HELPERS
    // ============================================================

    function _calculateReward(address user, uint256 stakeId) internal view returns (uint256) {
        StakeInfo storage stake_ = userStakes[user][stakeId];
        StakingPool storage pool = pools[stake_.poolId];
        
        uint256 duration = block.timestamp - stake_.lastClaimAt;
        return (stake_.amount * pool.apr * duration) / (SECONDS_IN_YEAR * BASIS_POINTS);
    }
}
