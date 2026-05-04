package com.example.demo.application.service;

import com.example.demo.infrastructure.blockchain.Web3StrategyService;
import com.example.demo.infrastructure.blockchain.Web3VaultService;
import com.example.demo.infrastructure.persistence.entity.StrategyStakeRecord;
import com.example.demo.infrastructure.persistence.entity.StakingStatus;
import com.example.demo.domain.repository.StrategyStakeRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Application Service cho StakingStrategyController (Staking.sol mới).
 *
 * SCOPE:
 * - getStrategyPools()  → đọc pool config
 * - getUserStakes()     → đọc DB record + live yield từ on-chain
 * - recordStake()       → ghi DB sau khi TX stake confirm
 * - recordUnstake()     → cập nhật DB sau khi TX unstake confirm
 * - recordEmergency()   → cập nhật DB sau khi TX emergency confirm
 *
 * KEY DIFFERENCE vs StakingApplicationService (WalletStaking):
 * pendingYield = vault.previewRedeem(sharesReceived) - assetsAtStake (tính động)
 * KHÔNG lưu static apr hay tính theo công thức fixed rate.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class StrategyApplicationService {

    private final Web3StrategyService web3StrategyService;
    private final Web3VaultService    web3VaultService;
    private final StrategyStakeRecordRepository strategyRepo;

    // =========================================================
    // READ
    // =========================================================

    /** Tổng hợp global stats của Strategy protocol */
    public StrategyStatsResponse getStrategyStats() {
        StrategyStatsResponse stats = new StrategyStatsResponse();
        stats.totalDeployedToVault = web3StrategyService.getTotalDeployedToVault().toPlainString();
        stats.totalHarvested       = web3StrategyService.getTotalHarvested().toPlainString();
        stats.totalPenalties       = web3StrategyService.getTotalPenalties().toPlainString();
        stats.pricePerShare        = web3VaultService.getPricePerShare().toPlainString();
        stats.vaultPaused          = web3VaultService.isPaused();
        return stats;
    }

    /**
     * Lấy tất cả vị thế staking của user.
     *
     * Kết hợp:
     * 1. DB record (assetsAtStake, sharesReceived, metadata)
     * 2. On-chain: lock status từ Web3StrategyService
     * 3. On-chain: currentValue từ vault.previewRedeem(shares)
     *
     * Result: pendingYield = currentValue - assetsAtStake
     */
    public List<UserStrategyStakeResponse> getUserStakes(String walletAddress) {
        List<StrategyStakeRecord> records = strategyRepo.findByWalletAddressOrderByStakedAtDesc(
                walletAddress.toLowerCase());

        return records.stream().map(record -> {
            // Live data từ on-chain
            BigDecimal currentValue = web3VaultService.previewRedeem(record.getSharesReceived());
            BigDecimal pendingYield = currentValue.subtract(record.getAssetsAtStake())
                    .max(BigDecimal.ZERO);

            Web3StrategyService.LockStatus lockStatus = web3StrategyService.isLocked(
                    walletAddress, record.getStakeId());

            UserStrategyStakeResponse resp = new UserStrategyStakeResponse();
            resp.stakeId             = record.getStakeId();
            resp.poolId              = record.getPoolId();
            resp.assetsAtStake       = record.getAssetsAtStake().toPlainString();
            resp.sharesReceived      = record.getSharesReceived().toPlainString();
            resp.currentValue        = currentValue.toPlainString();
            resp.pendingYield        = pendingYield.toPlainString();
            resp.isActive            = record.getStatus() == StakingStatus.ACTIVE;
            resp.isLocked            = lockStatus.locked && resp.isActive;
            resp.lockRemainingSeconds = lockStatus.remainingSeconds;
            resp.stakedAt            = record.getStakedAt() != null ? record.getStakedAt().toString() : null;
            resp.status              = record.getStatus().toString();
            resp.stakeTransactionHash = record.getStakeTransactionHash();
            return resp;
        }).collect(Collectors.toList());
    }

    // =========================================================
    // WRITE — log only
    // =========================================================

    /** Client gọi sau khi TX stake confirm. Ghi record vào DB. */
    public void recordStake(RecordStrategyStakeRequest request) {
        if (request.transactionHash != null && !request.transactionHash.isEmpty() &&
                strategyRepo.existsByStakeTransactionHash(request.transactionHash)) {
            log.warn("Strategy stake already recorded for txHash: {}", request.transactionHash);
            return;
        }

        StrategyStakeRecord record = StrategyStakeRecord.builder()
                .walletAddress(request.walletAddress.toLowerCase())
                .poolId(request.poolId)
                .stakeId(request.stakeId)
                .assetsAtStake(safeParse(request.assetsAtStake))
                .sharesReceived(safeParse(request.sharesReceived))
                .stakedAt(LocalDateTime.now())
                .stakeTransactionHash(request.transactionHash)
                .status(StakingStatus.ACTIVE)
                .build();

        strategyRepo.save(record);
        log.info("Recorded strategy stake: poolId={}, stakeId={}, wallet={}",
                request.poolId, request.stakeId, request.walletAddress);
    }

    /** Client gọi sau khi TX unstake (bình thường, sau lock) confirm. */
    public void recordUnstake(RecordStrategyUnstakeRequest request) {
        strategyRepo.findByWalletAddressAndStakeId(
                request.walletAddress.toLowerCase(), request.stakeId)
                .ifPresentOrElse(record -> {
                    record.setStatus(StakingStatus.UNSTAKED);
                    record.setUnstakeTransactionHash(request.transactionHash);
                    strategyRepo.save(record);
                    log.info("Recorded strategy unstake: stakeId={}", request.stakeId);
                }, () -> log.warn("Strategy stake record not found for stakeId={}", request.stakeId));
    }

    /** Client gọi sau khi TX emergencyWithdraw confirm. */
    public void recordEmergencyWithdraw(RecordStrategyEmergencyRequest request) {
        strategyRepo.findByWalletAddressAndStakeId(
                request.walletAddress.toLowerCase(), request.stakeId)
                .ifPresentOrElse(record -> {
                    record.setStatus(StakingStatus.EMERGENCY_WITHDRAWN);
                    record.setUnstakeTransactionHash(request.transactionHash);
                    strategyRepo.save(record);
                    log.info("Recorded strategy emergency withdraw: stakeId={}", request.stakeId);
                }, () -> log.warn("Strategy stake record not found for emergency stakeId={}", request.stakeId));
    }

    // =========================================================
    // Helper
    // =========================================================

    private BigDecimal safeParse(String value) {
        if (value == null || value.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(value); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }

    // =========================================================
    // DTOs
    // =========================================================

    public static class StrategyStatsResponse {
        public String  totalDeployedToVault = "0";
        public String  totalHarvested       = "0";
        public String  totalPenalties       = "0";
        public String  pricePerShare        = "0";
        public boolean vaultPaused          = false;
    }

    public static class UserStrategyStakeResponse {
        public Long    stakeId;
        public Integer poolId;
        public String  assetsAtStake;       // SKT principal
        public String  sharesReceived;      // dvSKT giữ bởi Strategy
        public String  currentValue;        // SKT hiện tại (previewRedeem)
        public String  pendingYield;        // SKT lãi chưa rút
        public boolean isActive;
        public boolean isLocked;
        public Long    lockRemainingSeconds;
        public String  stakedAt;
        public String  status;
        public String  stakeTransactionHash;
    }

    public static class RecordStrategyStakeRequest {
        public String  walletAddress;
        public Integer poolId;
        public Long    stakeId;
        public String  assetsAtStake;   // SKT nạp vào (decimal string)
        public String  sharesReceived;  // dvSKT nhận được (decimal string)
        public String  transactionHash;
    }

    public static class RecordStrategyUnstakeRequest {
        public String walletAddress;
        public Long   stakeId;
        public String transactionHash;
    }

    public static class RecordStrategyEmergencyRequest {
        public String walletAddress;
        public Long   stakeId;
        public String transactionHash;
    }
}
