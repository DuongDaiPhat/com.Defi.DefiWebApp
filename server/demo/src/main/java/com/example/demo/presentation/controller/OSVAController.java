package com.example.demo.presentation.controller;

import com.example.demo.infrastructure.blockchain.OSVAOracleService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigInteger;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/osva")
@RequiredArgsConstructor
public class OSVAController {

    private final OSVAOracleService oracleService;

    @GetMapping("/quote")
    public ResponseEntity<?> getQuote(
            @RequestParam String user,
            @RequestParam String tokenIn,
            @RequestParam String amountIn) {
        try {
            if (user == null || user.isBlank()) {
                return badRequest("Tham số 'user' không được để trống");
            }
            if (tokenIn == null || tokenIn.isBlank()) {
                return badRequest("Tham số 'tokenIn' không được để trống");
            }
            
            BigInteger amountInWei;
            try {
                amountInWei = new BigInteger(amountIn);
                if (amountInWei.compareTo(BigInteger.ZERO) <= 0) {
                    return badRequest("Tham số 'amountIn' phải lớn hơn 0");
                }
            } catch (NumberFormatException e) {
                return badRequest("Tham số 'amountIn' không hợp lệ");
            }

            if (!oracleService.isSystemReady()) {
                return ResponseEntity.status(503).body(Map.of(
                        "status", "error",
                        "message", "Oracle chưa sẵn sàng"
                ));
            }

            OSVAOracleService.OSVAQuote quote = oracleService.generateQuote(user, tokenIn, amountInWei);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", quote);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error generating quote", e);
            return ResponseEntity.status(500).body(Map.of(
                    "status", "error",
                    "message", "Lỗi server: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/status")
    public ResponseEntity<?> getStatus() {
        try {
            OSVAOracleService.OSVAStatus status = oracleService.getSystemStatus();
            
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("data", status);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Error getting oracle status", e);
            return ResponseEntity.status(500).body(Map.of(
                    "status", "error",
                    "message", "Lỗi server: " + e.getMessage()
            ));
        }
    }

    private ResponseEntity<?> badRequest(String message) {
        return ResponseEntity.status(400).body(Map.of(
                "status", "error",
                "message", message
        ));
    }
}
