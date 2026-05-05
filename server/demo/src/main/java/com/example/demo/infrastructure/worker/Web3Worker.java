package com.example.demo.infrastructure.worker;

import com.example.demo.application.cache.OsvaStateCache;
import com.example.demo.domain.service.DecisionEngineService;
import com.example.demo.infrastructure.config.OsvaConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint128;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Collections;
import java.util.List;

/**
 * Web3Worker — CronJob đọc trạng thái on-chain của OSVAPool mỗi 15 giây.
 *
 * Gọi hàm view reserve0() và reserve1() trên Smart Contract thông qua Web3j.
 * Tính toán hệ số mất cân bằng (M_imb) và ghi vào OsvaStateCache.
 *
 * Resilience: Áp dụng @Retryable để tự động retry khi Sepolia RPC bị
 * timeout hoặc rate-limit (tối đa 3 lần, mỗi lần chờ 2 giây).
 */
@Component
public class Web3Worker {

    private static final Logger log = LoggerFactory.getLogger(Web3Worker.class);

    private final Web3j web3j;
    private final OsvaConfig osvaConfig;
    private final OsvaStateCache stateCache;
    private final DecisionEngineService decisionEngine;

    public Web3Worker(Web3j web3j, OsvaConfig osvaConfig, OsvaStateCache stateCache, DecisionEngineService decisionEngine) {
        this.web3j = web3j;
        this.osvaConfig = osvaConfig;
        this.stateCache = stateCache;
        this.decisionEngine = decisionEngine;
    }

    // ============================================================
    //  Scheduled Job — Chạy mỗi 15 giây
    // ============================================================

    @Scheduled(fixedDelay = 15_000, initialDelay = 5_000)
    public void collectPoolState() {
        try {
            String poolAddress = osvaConfig.getPoolAddress();

            if (poolAddress == null || poolAddress.isBlank()) {
                log.warn("[Web3Worker] Pool address chưa được cấu hình. Bỏ qua lần quét này.");
                return;
            }

            // Gọi hàm reserve0() và reserve1() trên Smart Contract
            BigInteger rawReserve0 = callReserve(poolAddress, "reserve0");
            BigInteger rawReserve1 = callReserve(poolAddress, "reserve1");

            // Chuyển đổi từ wei (18 decimals) sang số thập phân
            BigDecimal reserve0 = new BigDecimal(rawReserve0);
            BigDecimal reserve1 = new BigDecimal(rawReserve1);

            // Tính hệ số mất cân bằng (M_imb)
            BigDecimal imbalanceRatio = calculateImbalance(reserve0, reserve1);

            // Ghi vào Cache và trigger tính lại α
            stateCache.updatePoolState(reserve0, reserve1, imbalanceRatio);
            decisionEngine.recalculateAndUpdateCache();
            log.info("[Web3Worker] Pool state updated — R0={}, R1={}, M_imb={}",
                    rawReserve0, rawReserve1, imbalanceRatio);

        } catch (Exception e) {
            log.error("[Web3Worker] Lỗi nghiêm trọng khi đọc Pool state: {}", e.getMessage(), e);
        }
    }

    // ============================================================
    //  Gọi Smart Contract (View Function) — Có @Retryable
    // ============================================================

    /**
     * Gọi hàm view reserve0() hoặc reserve1() trên OSVAPool.
     * Sử dụng eth_call (không tốn gas, chỉ đọc state).
     *
     * @Retryable: Nếu RPC timeout → chờ 2s → thử lại → tối đa 3 lần.
     */
    @Retryable(
            retryFor = {Exception.class},
            maxAttempts = 3,
            backoff = @Backoff(delay = 2000)
    )
    public BigInteger callReserve(String contractAddress, String functionName) throws Exception {
        try {
            // Tạo ABI function call cho reserve0() hoặc reserve1()
            // Cả hai hàm đều trả về uint128, không có tham số đầu vào
            Function function = new Function(
                    functionName,
                    Collections.emptyList(),
                    List.of(new TypeReference<Uint128>() {})
            );

            String encodedFunction = FunctionEncoder.encode(function);

            // Thực hiện eth_call (read-only, không cần private key)
            EthCall ethCall = web3j.ethCall(
                    Transaction.createEthCallTransaction(
                            "0x0000000000000000000000000000000000000000", // from: zero address (view call)
                            contractAddress,
                            encodedFunction
                    ),
                    DefaultBlockParameterName.LATEST
            ).send();

            // Kiểm tra lỗi từ node RPC
            if (ethCall.hasError()) {
                throw new RuntimeException(
                        String.format("RPC Error khi gọi %s(): code=%d, message=%s",
                                functionName, ethCall.getError().getCode(), ethCall.getError().getMessage())
                );
            }

            // Decode kết quả trả về
            var results = FunctionReturnDecoder.decode(ethCall.getValue(), function.getOutputParameters());

            if (results.isEmpty()) {
                throw new RuntimeException("Decode " + functionName + "() trả về kết quả rỗng");
            }

            BigInteger value = (BigInteger) results.get(0).getValue();
            log.debug("[Web3Worker] {}() = {}", functionName, value);
            return value;

        } catch (Exception e) {
            log.warn("[Web3Worker] ⚠ Retry — Lỗi khi gọi {}(): {}", functionName, e.getMessage());
            throw e; // Ném lại để @Retryable bắt và retry
        }
    }

    /**
     * Phương thức Recovery — được gọi sau khi @Retryable hết số lần retry.
     * Trả về giá trị 0 để hệ thống không crash, nhưng log rõ ràng cảnh báo.
     */
    @Recover
    public BigInteger recoverCallReserve(Exception e, String contractAddress, String functionName) {
        log.error("[Web3Worker] RECOVERY — Đã retry 3 lần nhưng vẫn thất bại khi gọi {}(). " +
                "Trả về giá trị 0. Lỗi gốc: {}", functionName, e.getMessage());
        return BigInteger.ZERO;
    }

    // ============================================================
    //  Toán học — Tính hệ số mất cân bằng M_imb
    // ============================================================

    /**
     * Tính hệ số mất cân bằng (M_imb) dựa trên dự trữ thực tế.
     *
     * Nếu pool cân bằng (50/50): M_imb = 1.0 (không phạt, không thưởng).
     * Nếu pool lệch nhiều: M_imb > 1.0 (phạt → giảm α, bảo vệ LP).
     *
     * Công thức: M_imb = (max(R0,R1) / min(R0,R1)) ^ k
     * Với k = 1.5 (hằng số trong OsvaConfig.K_IMBALANCE)
     */
    private BigDecimal calculateImbalance(BigDecimal reserve0, BigDecimal reserve1) {
        try {
            // Pool rỗng hoặc một bên = 0 → phạt nặng (M_imb cao)
            if (reserve0.compareTo(BigDecimal.ZERO) <= 0 || reserve1.compareTo(BigDecimal.ZERO) <= 0) {
                log.warn("[Web3Worker] Pool rỗng hoặc reserve = 0 → M_imb mặc định = 2.0");
                return new BigDecimal("2.0");
            }

            BigDecimal max = reserve0.max(reserve1);
            BigDecimal min = reserve0.min(reserve1);

            // ratio = max / min (luôn >= 1.0)
            BigDecimal ratio = max.divide(min, OsvaConfig.MC);

            // M_imb = ratio ^ k (dùng Math.pow vì BigDecimal không hỗ trợ mũ thập phân)
            double ratioDouble = ratio.doubleValue();
            double kDouble = OsvaConfig.K_IMBALANCE.doubleValue();
            double imbalance = Math.pow(ratioDouble, kDouble);

            BigDecimal result = BigDecimal.valueOf(imbalance).setScale(6, OsvaConfig.MC.getRoundingMode());

            log.debug("[Web3Worker] M_imb = {} (ratio={}, k={})", result, ratio, OsvaConfig.K_IMBALANCE);
            return result;

        } catch (Exception e) {
            log.error("[Web3Worker] Lỗi tính M_imb: {}. Trả về mặc định 1.0", e.getMessage(), e);
            return BigDecimal.ONE;
        }
    }
}
