package com.example.demo.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "wallet_staking_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WalletStakingRecord {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 42)
    private String walletAddress;

    @Column(nullable = false)
    private Integer poolId;

    @Column(nullable = false)
    private Long stakeId;

    @Column(nullable = false, columnDefinition = "NUMERIC(38,18)")
    private BigDecimal amount;

    @Column(nullable = false)
    private LocalDateTime stakedAt;

    @Column(nullable = false)
    private LocalDateTime lastClaimAt;

    @Column(columnDefinition = "NUMERIC(38,18)")
    private BigDecimal totalRewardsClaimed;

    @Column(length = 66)
    private String stakedTransactionHash;

    @Column(length = 66)
    private String unstakedTransactionHash;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private StakingStatus status;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (stakedAt == null) stakedAt = LocalDateTime.now();
        if (lastClaimAt == null) lastClaimAt = LocalDateTime.now();
        if (totalRewardsClaimed == null) totalRewardsClaimed = BigDecimal.ZERO;
        if (status == null) status = StakingStatus.ACTIVE;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
