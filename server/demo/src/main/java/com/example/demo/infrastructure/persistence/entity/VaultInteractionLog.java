package com.example.demo.infrastructure.persistence.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Ghi lại lịch sử tương tác của user với DefiVault (ERC-4626).
 * Server nhận báo cáo từ Client sau khi TX đã được confirm trên Blockchain.
 *
 * Action types: DEPOSIT | MINT | WITHDRAW | REDEEM
 */
@Entity
@Table(name = "vault_interaction_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VaultInteractionLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    /** Địa chỉ ví user (lowercase) */
    @Column(nullable = false, length = 42)
    private String walletAddress;

    /**
     * Loại thao tác theo ERC-4626:
     * DEPOSIT  — nạp assets, nhận shares (floor rounding)
     * MINT     — nhận chính xác shares, nạp assets (ceil rounding)
     * REDEEM   — đốt shares, nhận assets (floor rounding)
     * WITHDRAW — rút chính xác assets, đốt shares (ceil rounding)
     */
    @Column(nullable = false, length = 20)
    private String actionType;

    /** Số lượng SKT token (underlying asset) */
    @Column(columnDefinition = "NUMERIC(38,18)")
    private BigDecimal assets;

    /** Số lượng dvSKT share token */
    @Column(columnDefinition = "NUMERIC(38,18)")
    private BigDecimal shares;

    /**
     * Tỷ giá pricePerShare tại thời điểm giao dịch.
     * Dùng để phân tích APY theo thời gian (từ gas_static_report.md).
     */
    @Column(columnDefinition = "NUMERIC(38,18)")
    private BigDecimal pricePerShareAtTime;

    /** On-chain transaction hash (0x + 64 hex chars) */
    @Column(length = 66)
    private String transactionHash;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (assets == null) assets = BigDecimal.ZERO;
        if (shares == null) shares = BigDecimal.ZERO;
    }
}
