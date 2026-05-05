package com.example.demo.domain.service;

import com.example.demo.application.statecache.OsvaStateCache;
import com.example.demo.infrastructure.config.OsvaConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * DecisionEngineService — Thuật toán ra quyết định hệ số α (Alpha).
 *
 * Pure Function: Nhận σ, M_depth, M_imb → Trả về α ∈ [0, MAX_ALPHA].
 * Được trigger bởi Workers sau mỗi lần thu thập dữ liệu mới.
 *
 * Công thức OSVA:
 *   1. δ_base = σ × Z           (Z = 2.0)
 *   2. δ_final = δ_base × M_imb × M_depth
 *   3. α = (1 / δ_final) - 1
 *   4. Clamp α ∈ [0, MAX_ALPHA]
 *
 * Tất cả phép tính dùng BigDecimal với MathContext(10, HALF_UP).
 */
@Service
public class DecisionEngineService {

    private static final Logger log = LoggerFactory.getLogger(DecisionEngineService.class);

    private final OsvaStateCache stateCache;

    public DecisionEngineService(OsvaStateCache stateCache) {
        this.stateCache = stateCache;
    }

    // ============================================================
    //  Pure Function — Tính toán α từ các chỉ số đầu vào
    // ============================================================

    /**
     * Tính toán hệ số khuếch đại α từ 3 biến đầu vào.
     *
     * @param sigma       Độ biến động lịch sử (σ), ví dụ: 0.01 = 1%
     * @param depthFactor Hệ số độ sâu sổ lệnh CEX (M_depth), ví dụ: 1.0 = bình thường
     * @param imbalance   Hệ số mất cân bằng Pool (M_imb), ví dụ: 1.0 = cân bằng 50/50
     * @return α ∈ [0, 100] (long)
     */
    public long calculateAlpha(BigDecimal sigma, BigDecimal depthFactor, BigDecimal imbalance) {
        try {
            // ─── Bước 1: Tính δ_base = σ × Z ───
            BigDecimal deltaBase = sigma.multiply(OsvaConfig.Z_SCORE, OsvaConfig.MC);
            log.debug("[DecisionEngine] Bước 1 — δ_base = σ({}) × Z({}) = {}",
                    sigma, OsvaConfig.Z_SCORE, deltaBase);

            // Circuit Breaker: Nếu δ_base > 0.05 → thị trường quá biến động → phòng thủ
            if (deltaBase.compareTo(OsvaConfig.DELTA_BASE_THRESHOLD) > 0) {
                log.warn("[DecisionEngine] CIRCUIT BREAKER — δ_base({}) > ngưỡng({}). " +
                        "Thị trường quá biến động → α = 0 (Fallback V2)", deltaBase, OsvaConfig.DELTA_BASE_THRESHOLD);
                return 0L;
            }

            // Bảo vệ chia cho 0: Nếu δ_base = 0 → σ = 0 → thị trường hoàn toàn tĩnh → α max
            if (deltaBase.compareTo(BigDecimal.ZERO) <= 0) {
                log.info("[DecisionEngine] σ = 0 → Thị trường tĩnh tuyệt đối → α = MAX_ALPHA({})",
                        OsvaConfig.MAX_ALPHA);
                return OsvaConfig.MAX_ALPHA;
            }

            // ─── Bước 2: Tính δ_final = δ_base × M_imb × M_depth ───
            BigDecimal deltaFinal = deltaBase
                    .multiply(imbalance, OsvaConfig.MC)
                    .multiply(depthFactor, OsvaConfig.MC);
            log.debug("[DecisionEngine] Bước 2 — δ_final = δ_base({}) × M_imb({}) × M_depth({}) = {}",
                    deltaBase, imbalance, depthFactor, deltaFinal);

            // Bảo vệ chia cho 0: δ_final phải > 0
            if (deltaFinal.compareTo(BigDecimal.ZERO) <= 0) {
                log.warn("[DecisionEngine] δ_final <= 0 (bất thường). Trả về α = 0");
                return 0L;
            }

            // ─── Bước 3: Tính α = (1 / δ_final) - 1 ───
            BigDecimal one = BigDecimal.ONE;
            BigDecimal alphaRaw = one.divide(deltaFinal, OsvaConfig.MC).subtract(one, OsvaConfig.MC);
            log.debug("[DecisionEngine] Bước 3 — α_raw = (1 / {}) - 1 = {}", deltaFinal, alphaRaw);

            // ─── Bước 4: Ép kiểu và Clamp [0, MAX_ALPHA] ───
            long alphaLong = alphaRaw.longValue(); // Làm tròn xuống (floor)

            if (alphaLong < 0) {
                alphaLong = 0L;
            } else if (alphaLong > OsvaConfig.MAX_ALPHA) {
                alphaLong = OsvaConfig.MAX_ALPHA;
            }

            log.info("[DecisionEngine] KẾT QUẢ — α = {} (raw={})", alphaLong, alphaRaw);
            return alphaLong;

        } catch (ArithmeticException e) {
            log.error("[DecisionEngine] Lỗi toán học (có thể chia cho 0): {}. Trả về α = 0", e.getMessage(), e);
            return 0L;
        } catch (Exception e) {
            log.error("[DecisionEngine] Lỗi không xác định: {}. Trả về α = 0", e.getMessage(), e);
            return 0L;
        }
    }

    // ============================================================
    //  Trigger — Được gọi bởi Workers để cập nhật Cache
    // ============================================================

    /**
     * Recalculate: Đọc toàn bộ snapshot hiện tại từ Cache, tính lại α,
     * rồi ghi α mới ngược vào Cache.
     *
     * Luồng: Worker thu thập data → ghi vào Cache → gọi hàm này.
     */
    public void recalculateAndUpdateCache() {
        try {
            OsvaStateCache.OsvaSnapshot snapshot = stateCache.getSnapshot();

            BigDecimal sigma = snapshot.sigma();
            BigDecimal depthFactor = snapshot.depthFactor();
            BigDecimal imbalance = snapshot.imbalanceRatio();

            long newAlpha = calculateAlpha(sigma, depthFactor, imbalance);

            stateCache.updateAlpha(newAlpha);
            log.info("[DecisionEngine] Cache đã cập nhật α = {} (σ={}, M_depth={}, M_imb={})",
                    newAlpha, sigma, depthFactor, imbalance);

        } catch (Exception e) {
            log.error("[DecisionEngine] Lỗi khi recalculate α: {}", e.getMessage(), e);
        }
    }
}
