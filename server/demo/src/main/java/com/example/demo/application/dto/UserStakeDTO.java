package com.example.demo.application.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class UserStakeDTO {
    public Integer stakeId;
    public Integer poolId;
    public String poolName;
    public String amount;
    public BigDecimal amountRaw;
    public LocalDateTime stakedAt;
    public LocalDateTime lastClaimAt;
    public String pendingReward;
    public BigDecimal pendingRewardRaw;
    public Boolean isActive;
    public Boolean isLocked;
    public Long lockRemainingTime;
    public Integer apr;
    public Integer lockDuration;

    public UserStakeDTO(Integer stakeId, Integer poolId, String poolName, String amount,
                       BigDecimal amountRaw, LocalDateTime stakedAt, LocalDateTime lastClaimAt,
                       String pendingReward, BigDecimal pendingRewardRaw, Boolean isActive,
                       Boolean isLocked, Long lockRemainingTime, Integer apr, Integer lockDuration) {
        this.stakeId = stakeId;
        this.poolId = poolId;
        this.poolName = poolName;
        this.amount = amount;
        this.amountRaw = amountRaw;
        this.stakedAt = stakedAt;
        this.lastClaimAt = lastClaimAt;
        this.pendingReward = pendingReward;
        this.pendingRewardRaw = pendingRewardRaw;
        this.isActive = isActive;
        this.isLocked = isLocked;
        this.lockRemainingTime = lockRemainingTime;
        this.apr = apr;
        this.lockDuration = lockDuration;
    }
}
