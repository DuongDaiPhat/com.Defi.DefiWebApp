package com.example.demo.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "staking_pool_cache")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StakingPoolCache {
    
    @Id
    @Column(nullable = false)
    private Integer poolId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private Integer apr; // basis points (100 = 1%, 10000 = 100%)

    @Column(nullable = false)
    private Long lockDuration; // seconds

    @Column(nullable = false)
    private Integer penaltyRate; // basis points

    @Column(nullable = false, columnDefinition = "NUMERIC(38,18)")
    private BigDecimal minStake;

    @Column(nullable = false, columnDefinition = "NUMERIC(38,18)")
    private BigDecimal maxStake; // 0 = no limit

    @Column(nullable = false, columnDefinition = "NUMERIC(38,18)")
    private BigDecimal totalStaked;

    @Column(nullable = false)
    private Boolean isActive;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (isActive == null) isActive = true;
        if (minStake == null) minStake = BigDecimal.ZERO;
        if (maxStake == null) maxStake = BigDecimal.ZERO;
        if (totalStaked == null) totalStaked = BigDecimal.ZERO;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
