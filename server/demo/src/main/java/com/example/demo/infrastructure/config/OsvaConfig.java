package com.example.demo.infrastructure.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;

/**
 * OSVA Configuration — Load từ application.properties (prefix "osva.market-data").
 *
 * Các giá trị mock dùng cho chế độ demo khi không gọi được API Binance
 * hoặc khi token chưa niêm yết trên sàn CEX.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "osva.market-data")
public class OsvaConfig {

    // ============================================================
    //  Hằng số toán học dùng xuyên suốt hệ thống OSVA
    // ============================================================

    /** Precision toàn cục: 10 chữ số có nghĩa, làm tròn HALF_UP */
    public static final MathContext MC = new MathContext(10, RoundingMode.HALF_UP);

    /** Giới hạn cứng của hệ số khuếch đại (phải khớp MAX_ALPHA trong Smart Contract) */
    public static final long MAX_ALPHA = 100;

    /** Hệ số nhân Z (Z-score) dùng trong công thức δ_base = σ × Z */
    public static final BigDecimal Z_SCORE = new BigDecimal("2.0");

    /** Ngưỡng δ_base tối đa. Vượt qua ngưỡng này → α = 0 (phòng thủ) */
    public static final BigDecimal DELTA_BASE_THRESHOLD = new BigDecimal("0.05");

    /** Hệ số phạt/thưởng mất cân bằng pool (k constant) */
    public static final BigDecimal K_IMBALANCE = new BigDecimal("1.5");

    // ============================================================
    //  Cấu hình bind từ application.properties
    // ============================================================

    /** Bật/tắt chế độ demo (true = dùng mock data, false = gọi Binance API thật) */
    private boolean demoMode = true;

    /** Độ biến động lịch sử giả lập (σ), mặc định 1% */
    private BigDecimal mockSigma = new BigDecimal("0.01");

    /** Hệ số độ sâu sổ lệnh giả lập (M_depth), mặc định 1.0 (bình thường) */
    private BigDecimal mockDepthFactor = new BigDecimal("1.0");

    // ============================================================
    //  Cấu hình Blockchain / Oracle
    // ============================================================

    /** Địa chỉ contract OSVAPool đã deploy trên Sepolia (dùng cho verifyingContract EIP-712) */
    private String poolAddress = "";

    /** Private Key của Oracle Signer (hex, không có prefix 0x) */
    private String oraclePrivateKey = "";

    /** Chain ID của mạng (Sepolia = 11155111) */
    private long chainId = 11155111L;
}
