package com.example.demo.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Ghi lại vị thế staking của user thông qua StakingStrategyController.
 *
 * Khác với WalletStakingRecord (Legacy):
 * - Lưu `sharesReceived` (dvSKT) thay vì amount tĩnh
 * - Lưu `assetsAtStake` làm snapshot gốc để tính penalty
 * - currentValue & pendingYield KHÔNG lưu DB — tính động từ vault.previewRedeem(shares)
 *
 * Tuân thủ kiến trúc Strategy-Based Vault (defi-vault-yield-strategy.md)
 */
@Entity
@Table(name = "strategy_stake_records")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StrategyStakeRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** Địa chỉ ví user (lowercase) */
    @Column(nullable = false, length = 42)
    private String walletAddress;

    /** Pool ID từ StakingStrategyController */
    @Column(nullable = false)
    private Integer poolId;

    /** On-chain stakeId (từ event Staked trong contract) */
    @Column(nullable = false)
    private Long stakeId;

    /**
     * Principal snapshot: số SKT user nạp vào.
     * Dùng để tính penalty: penalty = assetsAtStake * penaltyRate / 10000
     * Không bao giờ update sau khi ghi (immutable snapshot).
     */
    @Column(nullable = false, columnDefinition = "NUMERIC(38,18)")
    private BigDecimal assetsAtStake;

    /**
     * Số dvSKT (shares) mà Strategy đang giữ thay cho user.
     * currentValue = vault.previewRedeem(sharesReceived) — tính động.
     * pendingYield = currentValue - assetsAtStake — tính động.
     */
    @Column(nullable = false, columnDefinition = "NUMERIC(38,18)")
    private BigDecimal sharesReceived;

    /** Thời điểm stake */
    @Column(nullable = false)
    private LocalDateTime stakedAt;

    /** TX hash của lệnh stake */
    @Column(length = 66)
    private String stakeTransactionHash;

    /** TX hash của lệnh unstake / emergency withdraw (null nếu còn active) */
    @Column(length = 66)
    private String unstakeTransactionHash;

    /**
     * Trạng thái vị thế:
     * ACTIVE              — đang staking
     * UNSTAKED            — đã rút bình thường (sau lockDuration)
     * EMERGENCY_WITHDRAWN — đã rút sớm (bị phạt penalty)
     */
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
        if (status == null) status = StakingStatus.ACTIVE;
        if (assetsAtStake == null) assetsAtStake = BigDecimal.ZERO;
        if (sharesReceived == null) sharesReceived = BigDecimal.ZERO;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
