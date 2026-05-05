package com.example.demo.application.dto;

import java.math.BigDecimal;

public class StakingPoolDTO {
    public Integer id;
    public String name;
    public Integer apr;
    public Long lockDuration;
    public Integer penaltyRate;
    public BigDecimal minStake;
    public BigDecimal maxStake;
    public BigDecimal totalStaked;
    public Boolean isActive;

    public StakingPoolDTO(Integer id, String name, Integer apr, Long lockDuration,
                         Integer penaltyRate, BigDecimal minStake, BigDecimal maxStake,
                         BigDecimal totalStaked, Boolean isActive) {
        this.id = id;
        this.name = name;
        this.apr = apr;
        this.lockDuration = lockDuration;
        this.penaltyRate = penaltyRate;
        this.minStake = minStake;
        this.maxStake = maxStake;
        this.totalStaked = totalStaked;
        this.isActive = isActive;
    }
}
