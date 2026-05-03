package com.example.demo.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "claim_history")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClaimHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 42)
    private String walletAddress;

    @Column(nullable = false)
    private Long stakeId;

    @Column(nullable = false)
    private Integer poolId;

    @Column(nullable = false, columnDefinition = "NUMERIC(38,18)")
    private BigDecimal rewardAmount;

    @Column(length = 66)
    private String transactionHash;

    @Column(nullable = false)
    private LocalDateTime claimedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (claimedAt == null) claimedAt = LocalDateTime.now();
        if (rewardAmount == null) rewardAmount = BigDecimal.ZERO;
    }
}
