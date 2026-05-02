package com.example.demo.presentation.controller;

import com.example.demo.application.service.StakingApplicationService;
import com.example.demo.application.dto.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * REST Controller for Wallet Staking endpoints
 */
@RestController
@RequestMapping("/api/staking")
@RequiredArgsConstructor
public class StakingController {

    private final StakingApplicationService stakingApplicationService;

    /**
     * Get all available staking pools
     * GET /api/staking/pools
     */
    @GetMapping("/pools")
    public List<StakingPoolDTO> getAllPools() {
        return stakingApplicationService.getAvailablePools();
    }

    /**
     * Get a specific staking pool by ID
     * GET /api/staking/pools/{poolId}
     */
    @GetMapping("/pools/{poolId}")
    public StakingPoolDTO getPool(@PathVariable Integer poolId) {
        return stakingApplicationService.getPoolById(poolId);
    }

    /**
     * Get user's staking positions
     * GET /api/staking/user/{walletAddress}
     */
    @GetMapping("/user/{walletAddress}")
    public List<UserStakeDTO> getUserStakes(@PathVariable String walletAddress) {
        return stakingApplicationService.getUserStakes(walletAddress);
    }

    /**
     * Get user's staking statistics
     * GET /api/staking/user/{walletAddress}/stats
     */
    @GetMapping("/user/{walletAddress}/stats")
    public StakingStatsDTO getUserStats(@PathVariable String walletAddress) {
        return stakingApplicationService.getStakingStats(walletAddress);
    }

    /**
     * Get user's staking history
     * GET /api/staking/history/{walletAddress}
     */
    @GetMapping("/history/{walletAddress}")
    public List<StakingHistoryDTO> getStakingHistory(@PathVariable String walletAddress) {
        return stakingApplicationService.getStakingHistory(walletAddress);
    }

    /**
     * Record a stake action (called by client after successful tx)
     * POST /api/staking/record-stake
     */
    @PostMapping("/record-stake")
    public void recordStake(@RequestBody RecordStakeRequest request) {
        StakingActionDTO action = new StakingActionDTO(
            "STAKE",
            request.getWalletAddress(),
            request.getPoolId(),
            null,
            request.getAmount(),
            null,
            request.getTransactionHash()
        );
        stakingApplicationService.recordStakeAction(action);
    }

    /**
     * Record an unstake action
     * POST /api/staking/record-unstake
     */
    @PostMapping("/record-unstake")
    public void recordUnstake(@RequestBody RecordUnstakeRequest request) {
        StakingActionDTO action = new StakingActionDTO(
            "UNSTAKE",
            request.getWalletAddress(),
            0,
            request.getStakeId(),
            null,
            null,
            request.getTransactionHash()
        );
        stakingApplicationService.recordUnstakeAction(action);
    }

    /**
     * Record a claim reward action
     * POST /api/staking/record-claim
     */
    @PostMapping("/record-claim")
    public void recordClaim(@RequestBody RecordClaimRequest request) {
        StakingActionDTO action = new StakingActionDTO(
            "CLAIM",
            request.getWalletAddress(),
            0,
            request.getStakeId(),
            null,
            null,
            request.getTransactionHash()
        );
        stakingApplicationService.recordClaimAction(action);
    }

    // ==================== Request DTOs ====================

    public static class RecordStakeRequest {
        private String walletAddress;
        private Integer poolId;
        private String amount;
        private String transactionHash;

        public RecordStakeRequest() {}

        public String getWalletAddress() { return walletAddress; }
        public void setWalletAddress(String walletAddress) { this.walletAddress = walletAddress; }

        public Integer getPoolId() { return poolId; }
        public void setPoolId(Integer poolId) { this.poolId = poolId; }

        public String getAmount() { return amount; }
        public void setAmount(String amount) { this.amount = amount; }

        public String getTransactionHash() { return transactionHash; }
        public void setTransactionHash(String transactionHash) { this.transactionHash = transactionHash; }
    }

    public static class RecordUnstakeRequest {
        private String walletAddress;
        private Long stakeId;
        private String transactionHash;

        public RecordUnstakeRequest() {}

        public String getWalletAddress() { return walletAddress; }
        public void setWalletAddress(String walletAddress) { this.walletAddress = walletAddress; }

        public Long getStakeId() { return stakeId; }
        public void setStakeId(Long stakeId) { this.stakeId = stakeId; }

        public String getTransactionHash() { return transactionHash; }
        public void setTransactionHash(String transactionHash) { this.transactionHash = transactionHash; }
    }

    public static class RecordClaimRequest {
        private String walletAddress;
        private Long stakeId;
        private String transactionHash;

        public RecordClaimRequest() {}

        public String getWalletAddress() { return walletAddress; }
        public void setWalletAddress(String walletAddress) { this.walletAddress = walletAddress; }

        public Long getStakeId() { return stakeId; }
        public void setStakeId(Long stakeId) { this.stakeId = stakeId; }

        public String getTransactionHash() { return transactionHash; }
        public void setTransactionHash(String transactionHash) { this.transactionHash = transactionHash; }
    }

    public static class RecordEmergencyWithdrawRequest {
        private String walletAddress;
        private Long stakeId;
        private String transactionHash;

        public RecordEmergencyWithdrawRequest() {}

        public String getWalletAddress() { return walletAddress; }
        public void setWalletAddress(String walletAddress) { this.walletAddress = walletAddress; }

        public Long getStakeId() { return stakeId; }
        public void setStakeId(Long stakeId) { this.stakeId = stakeId; }

        public String getTransactionHash() { return transactionHash; }
        public void setTransactionHash(String transactionHash) { this.transactionHash = transactionHash; }
    }
}
