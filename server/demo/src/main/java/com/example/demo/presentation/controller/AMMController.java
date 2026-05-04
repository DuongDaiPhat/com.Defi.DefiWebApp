package com.example.demo.presentation.controller;

import com.example.demo.infrastructure.blockchain.Web3AMMService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

/**
 * REST Controller cho SimpleAMM (swap pool token ETH ↔ SKT).
 */
@RestController
@RequestMapping("/api/amm")
@RequiredArgsConstructor
public class AMMController {

    private final Web3AMMService ammService;

    /**
     * Lấy thông tin thanh khoản của pool (reserve0: ETH, reserve1: SKT).
     * GET /api/amm/info
     */
    @GetMapping("/info")
    public Web3AMMService.AMMInfo getAMMInfo() {
        return ammService.getAMMInfo();
    }

    /**
     * Lấy báo giá swap (amountOut) cho amountIn tuỳ chỉnh.
     * Giả lập giao diện quote preview của Uniswap.
     *
     * GET /api/amm/quote?amountIn=1&direction=eth_to_skt
     */
    @GetMapping("/quote")
    public String getQuote(
            @RequestParam String amountIn,
            @RequestParam String direction) {
        try {
            BigDecimal inVal = new BigDecimal(amountIn);
            if (inVal.compareTo(BigDecimal.ZERO) <= 0) return "0";

            Web3AMMService.AMMInfo info = ammService.getAMMInfo();

            if ("eth_to_skt".equalsIgnoreCase(direction)) {
                // reserveIn = reserve0(ETH), reserveOut = reserve1(SKT)
                return ammService.getAmountOut(inVal, info.reserve0, info.reserve1).toPlainString();
            } else if ("skt_to_eth".equalsIgnoreCase(direction)) {
                // reserveIn = reserve1(SKT), reserveOut = reserve0(ETH)
                return ammService.getAmountOut(inVal, info.reserve1, info.reserve0).toPlainString();
            } else {
                throw new IllegalArgumentException("direction must be 'eth_to_skt' or 'skt_to_eth'");
            }
        } catch (Exception e) {
            return "0";
        }
    }
}
