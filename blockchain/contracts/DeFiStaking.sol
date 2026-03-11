// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title DeFiStaking
 * @dev Hợp đồng staking DeFi với các tính năng:
 *   - Stake token ERC20 để nhận reward
 *   - APR (Annual Percentage Rate) có thể điều chỉnh
 *   - Lock period (thời gian khóa) tùy chọn theo gói
 *   - Phần thưởng tích lũy theo giây (per-second accrual)
 *   - Emergency withdraw với penalty
 *   - Nhiều gói staking (pools)
 */
contract DeFiStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================================
    //  STRUCTS
    // ============================================================

    struct StakingPool {
        uint256 id;
        string  name;
        uint256 apr;            // APR tính theo basis points (100 = 1%, 10000 = 100%)
        uint256 lockDuration;   // Thời gian khóa (giây), 0 = không khóa
        uint256 penaltyRate;    // Phạt khi rút sớm (basis points)
        uint256 minStake;       // Số token tối thiểu để stake
        uint256 maxStake;       // 0 = unlimited
        uint256 totalStaked;    // Tổng đã stake vào pool này
        bool    isActive;
    }

    struct StakeInfo {
        uint256 poolId;
        uint256 amount;         // Số token đã stake
        uint256 stakedAt;       // Timestamp lúc stake
        uint256 lastClaimAt;    // Timestamp lần claim reward cuối
        uint256 pendingReward;  // Reward đã tích lũy nhưng chưa claim
        bool    isActive;
    }

    // ============================================================
    //  STATE VARIABLES
    // ============================================================

    IERC20  public immutable stakingToken;   // Token dùng để stake
    IERC20  public immutable rewardToken;    // Token dùng để trả reward

    uint256 public constant BASIS_POINTS   = 10_000;
    uint256 public constant SECONDS_IN_YEAR = 365 days;

    uint256 public totalStaked;             // Tổng toàn bộ token đang được stake
    uint256 public rewardPool;             // Số reward còn lại trong contract

    StakingPool[] public pools;

    // staker => stakeId => StakeInfo
    mapping(address => mapping(uint256 => StakeInfo)) public stakes;
    // staker => số lượng stake hiện tại
    mapping(address => uint256) public stakeCount;
    // staker => tổng reward đã nhận
    mapping(address => uint256) public totalRewardClaimed;

    // ============================================================
    //  EVENTS
    // ============================================================

    event PoolCreated(uint256 indexed poolId, string name, uint256 apr, uint256 lockDuration);
    event PoolUpdated(uint256 indexed poolId, uint256 newApr, bool isActive);
    event Staked(address indexed user, uint256 indexed poolId, uint256 stakeId, uint256 amount);
    event Unstaked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 penalty);
    event RewardClaimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event RewardDeposited(address indexed depositor, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed stakeId, uint256 amount);

    // ============================================================
    //  CONSTRUCTOR
    // ============================================================

    constructor(address _stakingToken, address _rewardToken) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken  != address(0), "Invalid reward token");
        stakingToken = IERC20(_stakingToken);
        rewardToken  = IERC20(_rewardToken);

        // Tạo sẵn 3 pool mặc định khi deploy
        _createPool("Flexible",  500,  0,         0,    1 ether, 0);           // 5% APR, không khóa
        _createPool("Silver",    1200, 30 days,   500,  10 ether, 0);          // 12% APR, 30 ngày
        _createPool("Gold",      2000, 90 days,   1000, 50 ether, 0);          // 20% APR, 90 ngày
    }

    // ============================================================
    //  POOL MANAGEMENT (Owner only)
    // ============================================================

    function createPool(
        string calldata name,
        uint256 apr,
        uint256 lockDuration,
        uint256 penaltyRate,
        uint256 minStake,
        uint256 maxStake
    ) external onlyOwner {
        _createPool(name, apr, lockDuration, penaltyRate, minStake, maxStake);
    }

    function _createPool(
        string memory name,
        uint256 apr,
        uint256 lockDuration,
        uint256 penaltyRate,
        uint256 minStake,
        uint256 maxStake
    ) internal {
        require(apr > 0 && apr <= 50_000, "APR: 0.01% - 500%");
        require(penaltyRate <= 5_000,     "Penalty max 50%");

        uint256 id = pools.length;
        pools.push(StakingPool({
            id:           id,
            name:         name,
            apr:          apr,
            lockDuration: lockDuration,
            penaltyRate:  penaltyRate,
            minStake:     minStake,
            maxStake:     maxStake,
            totalStaked:  0,
            isActive:     true
        }));
        emit PoolCreated(id, name, apr, lockDuration);
    }

    function updatePool(uint256 poolId, uint256 newApr, bool isActive) external onlyOwner {
        require(poolId < pools.length, "Pool not found");
        require(newApr > 0 && newApr <= 50_000, "Invalid APR");
        pools[poolId].apr      = newApr;
        pools[poolId].isActive = isActive;
        emit PoolUpdated(poolId, newApr, isActive);
    }

    /// @dev Owner nạp reward token vào contract để trả cho stakers
    function depositReward(uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must > 0");
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        rewardPool += amount;
        emit RewardDeposited(msg.sender, amount);
    }

    // ============================================================
    //  STAKING FUNCTIONS
    // ============================================================

    /**
     * @dev Stake token vào pool
     * @param poolId ID của pool
     * @param amount Số lượng token stake
     */
    function stake(uint256 poolId, uint256 amount) external nonReentrant {
        require(poolId < pools.length,  "Pool not found");
        StakingPool storage pool = pools[poolId];
        require(pool.isActive,          "Pool is not active");
        require(amount >= pool.minStake, "Below minimum stake");
        require(pool.maxStake == 0 || amount <= pool.maxStake, "Exceeds max stake");

        // Transfer token từ user vào contract
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 stakeId = stakeCount[msg.sender];
        stakes[msg.sender][stakeId] = StakeInfo({
            poolId:        poolId,
            amount:        amount,
            stakedAt:      block.timestamp,
            lastClaimAt:   block.timestamp,
            pendingReward: 0,
            isActive:      true
        });

        stakeCount[msg.sender]++;
        pool.totalStaked += amount;
        totalStaked      += amount;

        emit Staked(msg.sender, poolId, stakeId, amount);
    }

    /**
     * @dev Rút token và claim toàn bộ reward
     * @param stakeId ID của lần stake
     */
    function unstake(uint256 stakeId) external nonReentrant {
        StakeInfo storage info = stakes[msg.sender][stakeId];
        require(info.isActive,  "Stake not active");
        require(info.amount > 0, "Nothing to unstake");

        StakingPool storage pool = pools[info.poolId];

        // Tính và cộng dồn reward trước khi unstake
        uint256 reward = _calculateReward(msg.sender, stakeId);
        info.pendingReward += reward;
        info.lastClaimAt    = block.timestamp;

        uint256 penalty = 0;
        bool    isEarly = block.timestamp < info.stakedAt + pool.lockDuration;

        if (isEarly && pool.penaltyRate > 0) {
            penalty = (info.amount * pool.penaltyRate) / BASIS_POINTS;
        }

        uint256 returnAmount = info.amount - penalty;

        // Cập nhật state trước khi transfer (Checks-Effects-Interactions)
        pool.totalStaked -= info.amount;
        totalStaked      -= info.amount;
        info.isActive     = false;
        info.amount       = 0;

        // Trả token gốc (trừ penalty)
        stakingToken.safeTransfer(msg.sender, returnAmount);

        // Trả reward
        uint256 totalReward = info.pendingReward;
        if (totalReward > 0 && rewardPool >= totalReward) {
            info.pendingReward         = 0;
            rewardPool                -= totalReward;
            totalRewardClaimed[msg.sender] += totalReward;
            rewardToken.safeTransfer(msg.sender, totalReward);
        }

        emit Unstaked(msg.sender, stakeId, returnAmount, penalty);
        if (totalReward > 0) emit RewardClaimed(msg.sender, stakeId, totalReward);
    }

    /**
     * @dev Claim reward mà không rút token gốc
     * @param stakeId ID của lần stake
     */
    function claimReward(uint256 stakeId) external nonReentrant {
        StakeInfo storage info = stakes[msg.sender][stakeId];
        require(info.isActive,  "Stake not active");

        uint256 reward = _calculateReward(msg.sender, stakeId) + info.pendingReward;
        require(reward > 0, "No reward to claim");
        require(rewardPool >= reward, "Reward pool insufficient");

        info.pendingReward  = 0;
        info.lastClaimAt    = block.timestamp;
        rewardPool         -= reward;
        totalRewardClaimed[msg.sender] += reward;

        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardClaimed(msg.sender, stakeId, reward);
    }

    /**
     * @dev Emergency withdraw — rút ngay không nhận reward, có penalty
     */
    function emergencyWithdraw(uint256 stakeId) external nonReentrant {
        StakeInfo storage info = stakes[msg.sender][stakeId];
        require(info.isActive,  "Stake not active");

        StakingPool storage pool = pools[info.poolId];
        uint256 penalty = (info.amount * pool.penaltyRate) / BASIS_POINTS;
        uint256 returnAmount = info.amount - penalty;

        pool.totalStaked -= info.amount;
        totalStaked      -= info.amount;
        info.isActive     = false;
        info.amount       = 0;
        info.pendingReward = 0;

        stakingToken.safeTransfer(msg.sender, returnAmount);
        emit EmergencyWithdraw(msg.sender, stakeId, returnAmount);
    }

    // ============================================================
    //  VIEW FUNCTIONS
    // ============================================================

    /**
     * @dev Tính reward chưa claim của một stake
     */
    function pendingReward(address user, uint256 stakeId) external view returns (uint256) {
        StakeInfo storage info = stakes[user][stakeId];
        if (!info.isActive) return info.pendingReward;
        return _calculateReward(user, stakeId) + info.pendingReward;
    }

    function getPool(uint256 poolId) external view returns (StakingPool memory) {
        require(poolId < pools.length, "Pool not found");
        return pools[poolId];
    }

    function getAllPools() external view returns (StakingPool[] memory) {
        return pools;
    }

    function getStake(address user, uint256 stakeId) external view returns (StakeInfo memory) {
        return stakes[user][stakeId];
    }

    /// @dev Lấy tất cả các stake đang active của một user
    function getUserActiveStakes(address user)
        external view
        returns (uint256[] memory stakeIds, StakeInfo[] memory infos)
    {
        uint256 count = stakeCount[user];
        uint256 activeCount = 0;
        for (uint256 i = 0; i < count; i++) {
            if (stakes[user][i].isActive) activeCount++;
        }

        stakeIds = new uint256[](activeCount);
        infos    = new StakeInfo[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < count; i++) {
            if (stakes[user][i].isActive) {
                stakeIds[idx] = i;
                infos[idx]    = stakes[user][i];
                idx++;
            }
        }
    }

    /// @dev Kiểm tra stake có bị khóa không
    function isLocked(address user, uint256 stakeId) external view returns (bool, uint256 remainingSeconds) {
        StakeInfo storage info = stakes[user][stakeId];
        StakingPool storage pool = pools[info.poolId];
        uint256 unlockTime = info.stakedAt + pool.lockDuration;
        if (block.timestamp >= unlockTime) return (false, 0);
        return (true, unlockTime - block.timestamp);
    }

    function poolCount() external view returns (uint256) {
        return pools.length;
    }

    // ============================================================
    //  INTERNAL HELPERS
    // ============================================================

    /**
     * @dev Tính reward tích lũy từ lastClaimAt đến hiện tại
     * Formula: reward = amount * APR * elapsed / (SECONDS_IN_YEAR * BASIS_POINTS)
     */
    function _calculateReward(address user, uint256 stakeId) internal view returns (uint256) {
        StakeInfo storage info = stakes[user][stakeId];
        if (!info.isActive || info.amount == 0) return 0;

        StakingPool storage pool = pools[info.poolId];
        uint256 elapsed = block.timestamp - info.lastClaimAt;

        return (info.amount * pool.apr * elapsed) / (SECONDS_IN_YEAR * BASIS_POINTS);
    }
}
