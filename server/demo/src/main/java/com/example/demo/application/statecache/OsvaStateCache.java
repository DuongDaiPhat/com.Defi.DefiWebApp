package com.example.demo.application.statecache;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;

@Component
public class OsvaStateCache {
    private static final Logger log = LoggerFactory.getLogger(OsvaStateCache.class);

    // ============================================================
    // Immutable snapshot — Mỗi lần cập nhật tạo object mới
    // ============================================================

    /**
     * Record bất biến chứa toàn bộ trạng thái OSVA tại một thời điểm.
     * Dùng record (Java 17) để đảm bảo immutability tuyệt đối.
     */
    public record OsvaSnapshot(
            long alpha,
            BigDecimal sigma,
            BigDecimal depthFactor,
            BigDecimal imbalanceRatio,
            BigDecimal reserve0,
            BigDecimal reserve1,
            Instant updatedAt) {
        /** Snapshot mặc định khi hệ thống vừa khởi động (chưa có dữ liệu) */
        public static OsvaSnapshot defaultSnapshot() {
            return new OsvaSnapshot(
                    0L,
                    BigDecimal.ZERO,
                    BigDecimal.ONE,
                    BigDecimal.ONE,
                    BigDecimal.ZERO,
                    BigDecimal.ZERO,
                    Instant.EPOCH);
        }
    }

    /** Atomic reference giữ snapshot mới nhất — ghi/đọc lock-free */
    private final AtomicReference<OsvaSnapshot> currentSnapshot = new AtomicReference<>(OsvaSnapshot.defaultSnapshot());

    // ============================================================
    // WRITE — Chỉ được gọi bởi Workers / DecisionEngine
    // ============================================================

    /**
     * Cập nhật dữ liệu thị trường (sigma, depthFactor) từ MarketDataWorker.
     */
    public void updateMarketData(BigDecimal sigma, BigDecimal depthFactor) {
        try {
            currentSnapshot.updateAndGet(old -> new OsvaSnapshot(
                    old.alpha(),
                    sigma,
                    depthFactor,
                    old.imbalanceRatio(),
                    old.reserve0(),
                    old.reserve1(),
                    Instant.now()));
            log.debug("[OsvaStateCache] MarketData updated — σ={}, M_depth={}", sigma, depthFactor);
        } catch (Exception e) {
            log.error("[OsvaStateCache] Lỗi khi cập nhật MarketData: {}", e.getMessage(), e);
        }
    }

    /**
     * Cập nhật dữ liệu on-chain (reserves, imbalance) từ Web3Worker.
     */
    public void updatePoolState(BigDecimal reserve0, BigDecimal reserve1, BigDecimal imbalanceRatio) {
        try {
            currentSnapshot.updateAndGet(old -> new OsvaSnapshot(
                    old.alpha(),
                    old.sigma(),
                    old.depthFactor(),
                    imbalanceRatio,
                    reserve0,
                    reserve1,
                    Instant.now()));
            log.debug("[OsvaStateCache] PoolState updated — R0={}, R1={}, M_imb={}", reserve0, reserve1,
                    imbalanceRatio);
        } catch (Exception e) {
            log.error("[OsvaStateCache] Lỗi khi cập nhật PoolState: {}", e.getMessage(), e);
        }
    }

    /**
     * Cập nhật hệ số α đã tính toán từ DecisionEngineService.
     */
    public void updateAlpha(long alpha) {
        try {
            currentSnapshot.updateAndGet(old -> new OsvaSnapshot(
                    alpha,
                    old.sigma(),
                    old.depthFactor(),
                    old.imbalanceRatio(),
                    old.reserve0(),
                    old.reserve1(),
                    Instant.now()));
            log.info("[OsvaStateCache] Alpha updated → α = {}", alpha);
        } catch (Exception e) {
            log.error("[OsvaStateCache] Lỗi khi cập nhật Alpha: {}", e.getMessage(), e);
        }
    }

    // ============================================================
    // READ — Controller và các service khác đọc từ đây
    // ============================================================

    /** Lấy toàn bộ snapshot hiện tại (lock-free, O(1)) */
    public OsvaSnapshot getSnapshot() {
        return currentSnapshot.get();
    }

    /** Shortcut: Lấy alpha hiện tại */
    public long getCurrentAlpha() {
        return currentSnapshot.get().alpha();
    }

    /** Kiểm tra xem cache đã nhận được dữ liệu từ workers chưa */
    public boolean isReady() {
        return !currentSnapshot.get().updatedAt().equals(Instant.EPOCH);
    }

}
