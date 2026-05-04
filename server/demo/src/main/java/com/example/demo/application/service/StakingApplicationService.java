package com.example.demo.application.service;

import com.example.demo.application.dto.*;
import com.example.demo.application.dto.StakingActionDTO;
import com.example.demo.infrastructure.blockchain.Web3StakingService;
import com.example.demo.infrastructure.persistence.entity.*;
import com.example.demo.domain.repository.WalletStakingRecordRepository;
import com.example.demo.domain.repository.StakingPoolRepository;
import com.example.demo.domain.repository.ClaimHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Application Service for Staking operations
 * Handles business logic and coordination between repositories and Web3 service
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class StakingApplicationService {

    private final WalletStakingRecordRepository walletStakingRecordRepository;
    private final StakingPoolRepository stakingPoolRepository;
    private final ClaimHistoryRepository claimHistoryRepository;
    private final Web3StakingService web3StakingService;

    /**
     * Get all available staking pools
     */
    public List<StakingPoolDTO> getAvailablePools() {
        try {
            List<StakingPoolCache> cachedPools = stakingPoolRepository.findAllByOrderByPoolIdAsc();
            
            return cachedPools.stream()
                .map(pool -> new StakingPoolDTO(
                    pool.getPoolId(),
                    pool.getName(),
                    pool.getApr(),
                    pool.getLockDuration(),
                    pool.getPenaltyRate(),
                    pool.getMinStake(),
                    pool.getMaxStake(),
                    pool.getTotalStaked(),
                    pool.getIsActive()
                ))
                .collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to get available pools", e);
            return List.of();
        }
    }

    /**
     * Get pool by ID
     */
    public StakingPoolDTO getPoolById(Integer poolId) {
        try {
            StakingPoolCache pool = stakingPoolRepository.findByPoolId(poolId);
            if (pool == null) return null;
            
            return new StakingPoolDTO(
                pool.getPoolId(),
                pool.getName(),
                pool.getApr(),
                pool.getLockDuration(),
                pool.getPenaltyRate(),
                pool.getMinStake(),
                pool.getMaxStake(),
                pool.getTotalStaked(),
                pool.getIsActive()
            );
        } catch (Exception e) {
            log.error("Failed to get pool {}", poolId, e);
            return null;
        }
    }

    /**
     * Get user's staking positions
     * Combines DB history with realtime contract data
     */
    public List<UserStakeDTO> getUserStakes(String walletAddress) {
        try {
            List<WalletStakingRecord> dbStakes = walletStakingRecordRepository
                .findByWalletAddress(walletAddress.toLowerCase());
            
            return dbStakes.stream().map(record -> {
                // Get realtime data from contract
                BigDecimal pendingReward = web3StakingService.getPendingReward(walletAddress, record.getStakeId());
                Web3StakingService.LockStatus lockStatus = web3StakingService.isStakeLocked(walletAddress, record.getStakeId());
                
                StakingPoolCache pool = stakingPoolRepository.findByPoolId(record.getPoolId());
                
                return new UserStakeDTO(
                    record.getStakeId().intValue(),
                    record.getPoolId(),
                    pool != null ? pool.getName() : "Unknown",
                    record.getAmount().toPlainString(),
                    record.getAmount(),
                    record.getStakedAt(),
                    record.getLastClaimAt(),
                    pendingReward.toPlainString(),
                    pendingReward,
                    record.getStatus() == StakingStatus.ACTIVE,
                    lockStatus.locked && record.getStatus() == StakingStatus.ACTIVE,
                    lockStatus.remainingTime,
                    pool != null ? pool.getApr() : 0,
                    pool != null ? pool.getLockDuration().intValue() : 0
                );
            }).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to get user stakes for {}", walletAddress, e);
            return List.of();
        }
    }

    /**
     * Record a stake action in database
     */
    public void recordStakeAction(StakingActionDTO action) {
        try {
            WalletStakingRecord record = WalletStakingRecord.builder()
                .walletAddress(action.walletAddress.toLowerCase())
                .poolId(action.poolId)
                .stakeId(action.stakeId != null ? action.stakeId : 0L)
                .amount(new BigDecimal(action.amount != null ? action.amount : "0"))
                .stakedAt(LocalDateTime.now())
                .lastClaimAt(LocalDateTime.now())
                .stakedTransactionHash(action.transactionHash)
                .status(StakingStatus.ACTIVE)
                .build();
            walletStakingRecordRepository.save(record);
            log.info("Recorded stake action: {}", action);
        } catch (Exception e) {
            log.error("Failed to record stake action", e);
        }
    }

    /**
     * Record an unstake action
     */
    public void recordUnstakeAction(StakingActionDTO action) {
        try {
            WalletStakingRecord record = walletStakingRecordRepository
                .findByWalletAddressAndStakeId(action.walletAddress.toLowerCase(), action.stakeId);
            
            if (record != null) {
                record.setStatus(StakingStatus.UNSTAKED);
                record.setUnstakedTransactionHash(action.transactionHash);
                walletStakingRecordRepository.save(record);
                log.info("Recorded unstake action: {}", action);
            }
        } catch (Exception e) {
            log.error("Failed to record unstake action", e);
        }
    }

    /**
     * Record an emergency withdraw action
     */
    public void recordEmergencyWithdrawAction(StakingActionDTO action) {
        try {
            WalletStakingRecord record = walletStakingRecordRepository
                .findByWalletAddressAndStakeId(action.walletAddress.toLowerCase(), action.stakeId);
            
            if (record != null) {
                record.setStatus(StakingStatus.EMERGENCY_WITHDRAWN);
                record.setUnstakedTransactionHash(action.transactionHash);
                walletStakingRecordRepository.save(record);
                log.info("Recorded emergency withdraw action: {}", action);
            }
        } catch (Exception e) {
            log.error("Failed to record emergency withdraw action", e);
        }
    }

    /**
     * Record a claim reward action
     */
    public void recordClaimAction(StakingActionDTO action) {
        try {
            ClaimHistory claimRecord = ClaimHistory.builder()
                .walletAddress(action.walletAddress.toLowerCase())
                .stakeId(action.stakeId != null ? action.stakeId : 0L)
                .poolId(action.poolId)
                .rewardAmount(new BigDecimal(action.rewardAmount != null ? action.rewardAmount : "0"))
                .transactionHash(action.transactionHash)
                .claimedAt(LocalDateTime.now())
                .build();
            claimHistoryRepository.save(claimRecord);
            
            // Update stake record
            WalletStakingRecord stakeRecord = walletStakingRecordRepository
                .findByWalletAddressAndStakeId(action.walletAddress.toLowerCase(), action.stakeId);
            
            if (stakeRecord != null) {
                BigDecimal totalClaimed = stakeRecord.getTotalRewardsClaimed()
                    .add(claimRecord.getRewardAmount());
                stakeRecord.setTotalRewardsClaimed(totalClaimed);
                stakeRecord.setLastClaimAt(LocalDateTime.now());
                walletStakingRecordRepository.save(stakeRecord);
            }
            
            log.info("Recorded claim action: {}", action);
        } catch (Exception e) {
            log.error("Failed to record claim action", e);
        }
    }

    /**
     * Get staking history for a wallet
     */
    public List<StakingHistoryDTO> getStakingHistory(String walletAddress) {
        try {
            List<WalletStakingRecord> records = walletStakingRecordRepository
                .findByWalletAddressOrderByStakedAtDesc(walletAddress.toLowerCase());
            
            return records.stream().map(record -> new StakingHistoryDTO(
                record.getStakeId(),
                record.getPoolId(),
                record.getAmount().toPlainString(),
                record.getStakedAt(),
                record.getStatus() == StakingStatus.UNSTAKED ? record.getUpdatedAt() : null,
                record.getStatus().toString(),
                record.getTotalRewardsClaimed().toPlainString()
            )).collect(Collectors.toList());
        } catch (Exception e) {
            log.error("Failed to get staking history for {}", walletAddress, e);
            return List.of();
        }
    }

    /**
     * Get staking stats for a wallet
     */
    public StakingStatsDTO getStakingStats(String walletAddress) {
        try {
            List<WalletStakingRecord> activeStakes = walletStakingRecordRepository
                .findActiveStakes(walletAddress.toLowerCase());
            
            BigDecimal totalStaked = activeStakes.stream()
                .map(WalletStakingRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            BigDecimal totalClaimedRewards = claimHistoryRepository
                .getTotalClaimedRewards(walletAddress.toLowerCase());
            if (totalClaimedRewards == null) {
                totalClaimedRewards = BigDecimal.ZERO;
            }
            
            BigDecimal totalPendingRewards = activeStakes.stream()
                .map(record -> web3StakingService.getPendingReward(walletAddress, record.getStakeId()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
            
            return new StakingStatsDTO(
                totalStaked.toPlainString(),
                totalClaimedRewards.toPlainString(),
                totalPendingRewards.toPlainString(),
                activeStakes.size()
            );
        } catch (Exception e) {
            log.error("Failed to get staking stats for {}", walletAddress, e);
            return new StakingStatsDTO("0", "0", "0", 0);
        }
    }
}
