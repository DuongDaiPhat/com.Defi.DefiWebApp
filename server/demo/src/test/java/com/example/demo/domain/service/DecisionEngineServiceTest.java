package com.example.demo.domain.service;

import com.example.demo.application.statecache.OsvaStateCache;
import com.example.demo.infrastructure.config.OsvaConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

@ExtendWith(MockitoExtension.class)
class DecisionEngineServiceTest {

    @Mock
    private OsvaStateCache stateCache;

    @InjectMocks
    private DecisionEngineService decisionEngine;

    @BeforeEach
    void setUp() {
        // OsvaConfig constants are static, so we don't need to mock them for the pure function
    }

    @Test
    void testCalculateAlpha_NormalMarket() {
        // Arrange
        BigDecimal sigma = new BigDecimal("0.01"); // 1%
        BigDecimal depthFactor = new BigDecimal("1.0");
        BigDecimal imbalance = new BigDecimal("1.0");

        // Act
        // deltaBase = 0.01 * 2.0 = 0.02
        // deltaFinal = 0.02 * 1.0 * 1.0 = 0.02
        // alphaRaw = (1 / 0.02) - 1 = 50 - 1 = 49
        long alpha = decisionEngine.calculateAlpha(sigma, depthFactor, imbalance);

        // Assert
        assertEquals(49L, alpha);
    }

    @Test
    void testCalculateAlpha_HighVolatility_CircuitBreaker() {
        // Arrange
        // sigma = 0.03 -> deltaBase = 0.06 (vượt ngưỡng 0.05)
        BigDecimal sigma = new BigDecimal("0.03");
        BigDecimal depthFactor = new BigDecimal("1.0");
        BigDecimal imbalance = new BigDecimal("1.0");

        // Act
        long alpha = decisionEngine.calculateAlpha(sigma, depthFactor, imbalance);

        // Assert
        assertEquals(0L, alpha, "Khi delta_base > 0.05, phải kích hoạt circuit breaker (alpha = 0)");
    }

    @Test
    void testCalculateAlpha_ZeroVolatility() {
        // Arrange
        BigDecimal sigma = BigDecimal.ZERO;
        BigDecimal depthFactor = new BigDecimal("1.0");
        BigDecimal imbalance = new BigDecimal("1.0");

        // Act
        long alpha = decisionEngine.calculateAlpha(sigma, depthFactor, imbalance);

        // Assert
        assertEquals(OsvaConfig.MAX_ALPHA, alpha, "Khi sigma = 0, alpha phải đạt giá trị MAX");
    }

    @Test
    void testCalculateAlpha_HighImbalance() {
        // Arrange
        BigDecimal sigma = new BigDecimal("0.01"); // deltaBase = 0.02
        BigDecimal depthFactor = new BigDecimal("1.0");
        BigDecimal imbalance = new BigDecimal("2.0"); // M_imb = 2.0 -> lệch nhiều
        
        // Act
        // deltaFinal = 0.02 * 2.0 * 1.0 = 0.04
        // alphaRaw = (1 / 0.04) - 1 = 25 - 1 = 24
        long alpha = decisionEngine.calculateAlpha(sigma, depthFactor, imbalance);

        // Assert
        assertEquals(24L, alpha, "Khi mất cân bằng cao, alpha phải giảm đi so với bình thường (từ 49 xuống 24)");
    }

    @Test
    void testCalculateAlpha_ClampMaxAlpha() {
        // Arrange
        // deltaBase = 0.001 * 2 = 0.002
        // deltaFinal = 0.002
        // alphaRaw = (1 / 0.002) - 1 = 500 - 1 = 499 -> Phải bị clamp xuống 100
        BigDecimal sigma = new BigDecimal("0.001");
        BigDecimal depthFactor = new BigDecimal("1.0");
        BigDecimal imbalance = new BigDecimal("1.0");

        // Act
        long alpha = decisionEngine.calculateAlpha(sigma, depthFactor, imbalance);

        // Assert
        assertEquals(OsvaConfig.MAX_ALPHA, alpha, "Khi alphaRaw vượt MAX_ALPHA, phải bị clamp xuống");
    }
}
