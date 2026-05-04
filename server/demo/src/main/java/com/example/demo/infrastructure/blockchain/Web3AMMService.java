package com.example.demo.infrastructure.blockchain;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.*;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.Collections;
import java.util.List;

/**
 * READ-ONLY service đọc dữ liệu từ SimpleAMM.sol qua web3j.
 *
 * Các hàm đọc:
 * - reserve0() — ETH reserve (hoặc token0)
 * - reserve1() — SKT reserve (hoặc token1)
 * - getAmountOut(amountIn, reserveIn, reserveOut) — swap quote
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Web3AMMService {

    private final Web3j web3j;

    @Value("${blockchain.amm-contract-address:}")
    private String ammAddress;

    private static final BigInteger DECIMALS_18 = BigInteger.TEN.pow(18);

    /** reserve0() — ETH liquidity */
    public BigDecimal getReserve0() {
        return callUint256("reserve0", Collections.emptyList(), "reserve0");
    }

    /** reserve1() — SKT liquidity */
    public BigDecimal getReserve1() {
        return callUint256("reserve1", Collections.emptyList(), "reserve1");
    }

    /**
     * getAmountOut(amountIn, reserveIn, reserveOut) — tính lượng token nhận được khi swap.
     * Dùng công thức constant product: amountOut = amountIn * reserveOut / (reserveIn + amountIn)
     * (trừ phí nếu AMM có fee)
     */
    public BigDecimal getAmountOut(BigDecimal amountIn, BigDecimal reserveIn, BigDecimal reserveOut) {
        try {
            if (ammAddress == null || ammAddress.isEmpty()) return BigDecimal.ZERO;

            BigInteger amountInWei   = toWei(amountIn);
            BigInteger reserveInWei  = toWei(reserveIn);
            BigInteger reserveOutWei = toWei(reserveOut);

            Function function = new Function("getAmountOut",
                    List.of(
                            new Uint256(amountInWei),
                            new Uint256(reserveInWei),
                            new Uint256(reserveOutWei)
                    ),
                    List.of(new TypeReference<Uint256>() {}));

            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, ammAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError() || response.getValue() == null) return BigDecimal.ZERO;

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.isEmpty()) return BigDecimal.ZERO;

            return fromWei((BigInteger) decoded.get(0).getValue());
        } catch (Exception e) {
            log.error("Failed to getAmountOut", e);
            return BigDecimal.ZERO;
        }
    }

    /** Aggregate info: reserves + price ratio */
    public AMMInfo getAMMInfo() {
        AMMInfo info = new AMMInfo();
        info.reserve0    = getReserve0();
        info.reserve1    = getReserve1();
        // price = reserve1 / reserve0 = SKT per ETH
        if (info.reserve0.compareTo(BigDecimal.ZERO) > 0) {
            info.priceRatio = info.reserve1.divide(info.reserve0, 6, java.math.RoundingMode.DOWN);
        }
        return info;
    }

    // =========================================================
    // Internal
    // =========================================================

    private BigDecimal callUint256(String funcName, List<Type> inputs, String logLabel) {
        try {
            if (ammAddress == null || ammAddress.isEmpty()) return BigDecimal.ZERO;

            Function function = new Function(funcName, inputs,
                    List.of(new TypeReference<Uint256>() {}));

            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, ammAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                log.error("EthCall error for {}(): {}", logLabel, response.getError().getMessage());
                return BigDecimal.ZERO;
            }

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.isEmpty()) return BigDecimal.ZERO;

            return fromWei((BigInteger) decoded.get(0).getValue());
        } catch (Exception e) {
            log.error("Failed to call {}()", logLabel, e);
            return BigDecimal.ZERO;
        }
    }

    private BigInteger toWei(BigDecimal amount) {
        return amount.multiply(new BigDecimal(DECIMALS_18)).toBigInteger();
    }

    private BigDecimal fromWei(BigInteger wei) {
        return new BigDecimal(wei).divide(new BigDecimal(DECIMALS_18), 18, java.math.RoundingMode.DOWN);
    }

    // =========================================================
    // DTO
    // =========================================================

    public static class AMMInfo {
        public BigDecimal reserve0   = BigDecimal.ZERO; // ETH
        public BigDecimal reserve1   = BigDecimal.ZERO; // SKT
        public BigDecimal priceRatio = BigDecimal.ZERO; // SKT per ETH
    }
}
