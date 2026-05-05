package com.example.demo.infrastructure.worker;

import com.example.demo.application.cache.OsvaStateCache;
import com.example.demo.domain.service.DecisionEngineService;
import com.example.demo.infrastructure.config.OsvaConfig;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;

/**
 * MarketDataWorker — CronJob thu thập dữ liệu giá từ sàn CEX (Binance).
 *
 * Chạy mỗi 10 giây. Nếu token chưa niêm yết (demo-mode) hoặc API Binance
 * trả lỗi → tự động Fallback sang dữ liệu mock từ OsvaConfig.
 *
 * Kết quả (σ, M_depth) được ghi vào OsvaStateCache để Controller đọc ngay.
 */
@Component
public class MarketDataWorker {

    private static final Logger log = LoggerFactory.getLogger(MarketDataWorker.class);

    private final OsvaConfig osvaConfig;
    private final OsvaStateCache stateCache;
    private final DecisionEngineService decisionEngine;

    public MarketDataWorker(OsvaConfig osvaConfig, OsvaStateCache stateCache, DecisionEngineService decisionEngine) {
        this.osvaConfig = osvaConfig;
        this.stateCache = stateCache;
        this.decisionEngine = decisionEngine;
    }

    /** RestTemplate dùng gọi public API Binance (không cần API key) */
    private final RestTemplate restTemplate = new RestTemplate();

    /** Symbol mặc định dùng để lấy dữ liệu tham chiếu (có thể cấu hình sau) */
    private static final String BINANCE_SYMBOL = "ETHUSDT";
    private static final String BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/24hr?symbol=";
    private static final String BINANCE_DEPTH_URL = "https://api.binance.com/api/v3/depth?symbol=%s&limit=5";

    // ============================================================
    //  Scheduled Job — Chạy mỗi 10 giây
    // ============================================================

    @Scheduled(fixedDelay = 10_000, initialDelay = 2_000)
    public void collectMarketData() {
        BigDecimal sigma;
        BigDecimal depthFactor;

        // Kiểm tra chế độ Demo trước khi gọi API
        if (osvaConfig.isDemoMode()) {
            sigma = osvaConfig.getMockSigma();
            depthFactor = osvaConfig.getMockDepthFactor();
            log.info("[MarketDataWorker] DEMO MODE — Sử dụng mock data: σ={}, M_depth={}", sigma, depthFactor);
        } else {
            // Chế độ Production: Gọi Binance API thật
            sigma = fetchSigmaFromBinance();
            depthFactor = fetchDepthFromBinance();
        }

        // Ghi kết quả vào Cache và trigger tính lại α
        try {
            stateCache.updateMarketData(sigma, depthFactor);
            decisionEngine.recalculateAndUpdateCache();
            log.debug("[MarketDataWorker] Cache updated thành công — σ={}, M_depth={}", sigma, depthFactor);
        } catch (Exception e) {
            log.error("[MarketDataWorker] Lỗi khi ghi vào Cache: {}", e.getMessage(), e);
        }
    }

    // ============================================================
    //  Gọi Binance API — Có Fallback đầy đủ
    // ============================================================

    /**
     * Lấy độ biến động lịch sử (σ) từ Binance 24hr Ticker.
     * Sử dụng priceChangePercent làm proxy cho σ.
     *
     * Fallback: Nếu API lỗi → dùng mock-sigma từ config.
     */
    private BigDecimal fetchSigmaFromBinance() {
        try {
            String url = BINANCE_TICKER_URL + BINANCE_SYMBOL;
            String response = restTemplate.getForObject(url, String.class);

            if (response == null || response.isBlank()) {
                throw new RuntimeException("Binance trả về response rỗng");
            }

            JsonObject json = JsonParser.parseString(response).getAsJsonObject();

            // priceChangePercent = % thay đổi giá 24h, chia 100 để đổi sang dạng thập phân
            String priceChangeStr = json.get("priceChangePercent").getAsString();
            BigDecimal priceChangePct = new BigDecimal(priceChangeStr);
            BigDecimal sigma = priceChangePct.abs().divide(new BigDecimal("100"), OsvaConfig.MC);

            log.info("[MarketDataWorker] Binance σ = {} (từ priceChangePercent={}%)", sigma, priceChangePct);
            return sigma;

        } catch (Exception e) {
            log.warn("[MarketDataWorker] ⚠ Binance Ticker API thất bại — Kích hoạt Fallback Data. Lỗi: {}", e.getMessage());
            return osvaConfig.getMockSigma();
        }
    }

    /**
     * Lấy hệ số độ sâu sổ lệnh (M_depth) từ Binance Order Book.
     * Tính bằng tổng khối lượng 5 mức giá tốt nhất (bids + asks).
     * Chuẩn hóa: M_depth = totalVolume / 100 (heuristic đơn giản).
     * Nếu M_depth > 2.0 → cap lại = 2.0; nếu < 0.1 → floor = 0.1
     *
     * Fallback: Nếu API lỗi → dùng mock-depth-factor từ config.
     */
    private BigDecimal fetchDepthFromBinance() {
        try {
            String url = String.format(BINANCE_DEPTH_URL, BINANCE_SYMBOL);
            String response = restTemplate.getForObject(url, String.class);

            if (response == null || response.isBlank()) {
                throw new RuntimeException("Binance Depth trả về response rỗng");
            }

            JsonObject json = JsonParser.parseString(response).getAsJsonObject();

            // Tính tổng volume từ top 5 bids và asks
            BigDecimal totalVolume = BigDecimal.ZERO;

            var bids = json.getAsJsonArray("bids");
            for (int i = 0; i < bids.size(); i++) {
                var level = bids.get(i).getAsJsonArray();
                totalVolume = totalVolume.add(new BigDecimal(level.get(1).getAsString()));
            }

            var asks = json.getAsJsonArray("asks");
            for (int i = 0; i < asks.size(); i++) {
                var level = asks.get(i).getAsJsonArray();
                totalVolume = totalVolume.add(new BigDecimal(level.get(1).getAsString()));
            }

            // Chuẩn hóa heuristic: chia cho 100 ETH để có hệ số [0.1, 2.0]
            BigDecimal depthFactor = totalVolume.divide(new BigDecimal("100"), OsvaConfig.MC);

            // Clamp giá trị trong khoảng [0.1, 2.0]
            if (depthFactor.compareTo(new BigDecimal("2.0")) > 0) {
                depthFactor = new BigDecimal("2.0");
            } else if (depthFactor.compareTo(new BigDecimal("0.1")) < 0) {
                depthFactor = new BigDecimal("0.1");
            }

            log.info("[MarketDataWorker] Binance M_depth = {} (totalVolume={})", depthFactor, totalVolume);
            return depthFactor;

        } catch (Exception e) {
            log.warn("[MarketDataWorker] ⚠ Binance Depth API thất bại — Kích hoạt Fallback Data. Lỗi: {}", e.getMessage());
            return osvaConfig.getMockDepthFactor();
        }
    }
}
