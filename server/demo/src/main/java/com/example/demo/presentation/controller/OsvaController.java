package com.example.demo.presentation.controller;

import com.example.demo.application.dto.OsvaQuoteResponse;
import com.example.demo.application.statecache.OsvaStateCache;
import com.example.demo.infrastructure.security.Eip712SignerService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigInteger;
import java.time.Instant;
import java.util.Map;

/**
 * OsvaController — REST API Endpoint cho hệ thống OSVA.
 *
 * Endpoint chính: GET /api/v1/osva/quote
 *
 * Luồng hoạt động:
 *   1. Nhận tham số (user, tokenIn, amountIn) từ Frontend.
 *   2. Lấy α trực tiếp từ OsvaStateCache (đã được Workers tính sẵn).
 *   3. Tạo deadline = unix timestamp hiện tại + 60 giây.
 *   4. Gọi Eip712SignerService ký dữ liệu.
 *   5. Trả về OsvaQuoteResponse cho Frontend ngay lập tức (< 50ms).
 */
@RestController
@RequestMapping("/api/v1/osva")
public class OsvaController {

    private static final Logger log = LoggerFactory.getLogger(OsvaController.class);

    private final OsvaStateCache stateCache;
    private final Eip712SignerService signerService;

    public OsvaController(OsvaStateCache stateCache, Eip712SignerService signerService) {
        this.stateCache = stateCache;
        this.signerService = signerService;
    }

    /** Thời gian sống của chữ ký (giây). Sau deadline, Smart Contract sẽ revert. */
    private static final long SIGNATURE_TTL_SECONDS = 60L;

    // ============================================================
    //  GET /api/v1/osva/quote — Lấy Quote cho giao dịch Swap
    // ============================================================

    /**
     * Lấy quote (α, deadline, signature) cho một giao dịch SwapOSVA.
     *
     * @param user     Địa chỉ ví người dùng (hex, có prefix 0x)
     * @param tokenIn  Địa chỉ token đầu vào (hex, có prefix 0x)
     * @param amountIn Số lượng token (đã nhân decimals, dạng string BigInteger)
     * @return OsvaQuoteResponse chứa α, deadline, signature
     */
    @GetMapping("/quote")
    public ResponseEntity<?> getQuote(
            @RequestParam("user") String user,
            @RequestParam("tokenIn") String tokenIn,
            @RequestParam("amountIn") String amountIn
    ) {
        try {
            // ─── Validate tham số đầu vào ───
            if (user == null || user.isBlank()) {
                return ResponseEntity.badRequest().body(
                        Map.of("status", "error", "message", "Tham số 'user' không được để trống")
                );
            }
            if (tokenIn == null || tokenIn.isBlank()) {
                return ResponseEntity.badRequest().body(
                        Map.of("status", "error", "message", "Tham số 'tokenIn' không được để trống")
                );
            }
            if (amountIn == null || amountIn.isBlank()) {
                return ResponseEntity.badRequest().body(
                        Map.of("status", "error", "message", "Tham số 'amountIn' không được để trống")
                );
            }

            // Parse amountIn thành BigInteger
            BigInteger amountInBigInt;
            try {
                amountInBigInt = new BigInteger(amountIn);
            } catch (NumberFormatException e) {
                return ResponseEntity.badRequest().body(
                        Map.of("status", "error", "message", "amountIn không phải số hợp lệ: " + amountIn)
                );
            }

            if (amountInBigInt.compareTo(BigInteger.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(
                        Map.of("status", "error", "message", "amountIn phải > 0")
                );
            }

            // ─── Bước 1: Lấy α từ Cache (đã được Workers tính sẵn) ───
            long alpha = stateCache.getCurrentAlpha();
            log.debug("[OsvaController] α lấy từ Cache = {}", alpha);

            // ─── Bước 2: Tạo deadline ───
            long deadline = Instant.now().getEpochSecond() + SIGNATURE_TTL_SECONDS;

            // ─── Bước 3: Ký chữ ký EIP-712 ───
            String signature = signerService.signSwapRequest(
                    user,
                    tokenIn,
                    amountInBigInt,
                    alpha,
                    deadline
            );

            // ─── Bước 4: Trả kết quả ───
            OsvaQuoteResponse response = OsvaQuoteResponse.builder()
                    .alpha(alpha)
                    .deadline(deadline)
                    .signature(signature)
                    .signerAddress(signerService.getSignerAddress())
                    .build();

            log.info("[OsvaController] Quote generated — user={}, α={}, deadline={}, sig={}...{}",
                    user, alpha, deadline,
                    signature.substring(0, Math.min(10, signature.length())),
                    signature.substring(Math.max(0, signature.length() - 6)));

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "data", response
            ));

        } catch (IllegalStateException e) {
            // Lỗi cấu hình (Private Key hoặc Pool Address chưa set)
            log.error("[OsvaController] Lỗi cấu hình: {}", e.getMessage());
            return ResponseEntity.status(503).body(
                    Map.of("status", "error", "message", "Oracle chưa sẵn sàng: " + e.getMessage())
            );
        } catch (Exception e) {
            log.error("[OsvaController] Lỗi không xác định khi tạo quote: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(
                    Map.of("status", "error", "message", "Lỗi server: " + e.getMessage())
            );
        }
    }

    // ============================================================
    //  GET /api/v1/osva/status — Kiểm tra trạng thái hệ thống
    // ============================================================

    /**
     * Endpoint phụ: Kiểm tra trạng thái OSVA Engine.
     * Dùng cho monitoring, health-check và debug.
     */
    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        try {
            OsvaStateCache.OsvaSnapshot snapshot = stateCache.getSnapshot();

            Map<String, Object> status = Map.of(
                    "systemReady", stateCache.isReady(),
                    "currentAlpha", snapshot.alpha(),
                    "sigma", snapshot.sigma().toPlainString(),
                    "depthFactor", snapshot.depthFactor().toPlainString(),
                    "imbalanceRatio", snapshot.imbalanceRatio().toPlainString(),
                    "reserve0", snapshot.reserve0().toPlainString(),
                    "reserve1", snapshot.reserve1().toPlainString(),
                    "lastUpdated", snapshot.updatedAt().toString(),
                    "oracleSignerAddress", signerService.getSignerAddress()
            );

            return ResponseEntity.ok(Map.of("status", "success", "data", status));

        } catch (Exception e) {
            log.error("[OsvaController] Lỗi khi lấy status: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body(
                    Map.of("status", "error", "message", e.getMessage())
            );
        }
    }
}
