package com.example.demo.application.dto;

import java.time.LocalDateTime;

public class StakingHistoryDTO {
    public Long stakeId;
    public Integer poolId;
    public String amount;
    public LocalDateTime stakedAt;
    public LocalDateTime unstakedAt;
    public String status;
    public String totalRewardsClaimed;

    public StakingHistoryDTO(Long stakeId, Integer poolId, String amount, LocalDateTime stakedAt,
                            LocalDateTime unstakedAt, String status, String totalRewardsClaimed) {
        this.stakeId = stakeId;
        this.poolId = poolId;
        this.amount = amount;
        this.stakedAt = stakedAt;
        this.unstakedAt = unstakedAt;
        this.status = status;
        this.totalRewardsClaimed = totalRewardsClaimed;
    }
}
