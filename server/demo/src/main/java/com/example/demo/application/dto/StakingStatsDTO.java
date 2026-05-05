package com.example.demo.application.dto;

public class StakingStatsDTO {
    public String totalStaked;
    public String totalRewardsClaimed;
    public String totalPendingRewards;
    public Integer activeStakesCount;

    public StakingStatsDTO(String totalStaked, String totalRewardsClaimed,
                          String totalPendingRewards, Integer activeStakesCount) {
        this.totalStaked = totalStaked;
        this.totalRewardsClaimed = totalRewardsClaimed;
        this.totalPendingRewards = totalPendingRewards;
        this.activeStakesCount = activeStakesCount;
    }
}
