package com.example.demo.infrastructure.worker;

import com.example.demo.application.cache.OsvaStateCache;
import com.example.demo.domain.service.DecisionEngineService;
import com.example.demo.infrastructure.config.OsvaConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MarketDataWorkerTest {

    @Mock
    private OsvaConfig osvaConfig;

    @Mock
    private OsvaStateCache stateCache;

    @Mock
    private DecisionEngineService decisionEngine;

    @Mock
    private RestTemplate restTemplate;

    @InjectMocks
    private MarketDataWorker worker;

    @BeforeEach
    void setUp() {
        // Inject the mocked RestTemplate into the worker
        ReflectionTestUtils.setField(worker, "restTemplate", restTemplate);
    }

    @Test
    void testCollectMarketData_DemoMode() {
        // Arrange
        when(osvaConfig.isDemoMode()).thenReturn(true);
        BigDecimal mockSigma = new BigDecimal("0.02");
        BigDecimal mockDepth = new BigDecimal("1.5");
        when(osvaConfig.getMockSigma()).thenReturn(mockSigma);
        when(osvaConfig.getMockDepthFactor()).thenReturn(mockDepth);

        // Act
        worker.collectMarketData();

        // Assert
        verify(stateCache, times(1)).updateMarketData(mockSigma, mockDepth);
        verify(decisionEngine, times(1)).recalculateAndUpdateCache();
        
        // Ensure no API calls are made in demo mode
        verifyNoInteractions(restTemplate);
    }

    @Test
    void testCollectMarketData_ProductionMode_ApiSuccess() {
        // Arrange
        when(osvaConfig.isDemoMode()).thenReturn(false);
        
        // Mock Ticker API response: priceChangePercent = -2.500
        String mockTickerResponse = "{\"symbol\":\"ETHUSDT\",\"priceChangePercent\":\"-2.500\"}";
        when(restTemplate.getForObject(contains("ticker/24hr"), eq(String.class)))
                .thenReturn(mockTickerResponse);

        // Mock Depth API response
        String mockDepthResponse = """
                {
                    "bids": [ ["2000.00", "50.00"], ["1999.00", "50.00"] ],
                    "asks": [ ["2001.00", "25.00"], ["2002.00", "25.00"] ]
                }
                """;
        when(restTemplate.getForObject(contains("depth"), eq(String.class)))
                .thenReturn(mockDepthResponse);

        // Expected calculation:
        // sigma = |-2.500| / 100 = 0.025
        // totalVolume = 50 + 50 + 25 + 25 = 150
        // depthFactor = 150 / 100 = 1.5
        BigDecimal expectedSigma = new BigDecimal("0.025");
        BigDecimal expectedDepth = new BigDecimal("1.50");

        // Act
        worker.collectMarketData();

        // Assert
        verify(stateCache, times(1)).updateMarketData(expectedSigma, expectedDepth);
        verify(decisionEngine, times(1)).recalculateAndUpdateCache();
    }

    @Test
    void testCollectMarketData_ProductionMode_ApiFailure_FallbackToMock() {
        // Arrange
        when(osvaConfig.isDemoMode()).thenReturn(false);
        
        // Simulating API exception
        when(restTemplate.getForObject(contains("ticker/24hr"), eq(String.class)))
                .thenThrow(new RuntimeException("API Connection timeout"));
        
        when(restTemplate.getForObject(contains("depth"), eq(String.class)))
                .thenThrow(new RuntimeException("API Rate Limit"));

        // Expected fallback
        BigDecimal mockSigma = new BigDecimal("0.05");
        BigDecimal mockDepth = new BigDecimal("0.8");
        when(osvaConfig.getMockSigma()).thenReturn(mockSigma);
        when(osvaConfig.getMockDepthFactor()).thenReturn(mockDepth);

        // Act
        worker.collectMarketData();

        // Assert
        verify(stateCache, times(1)).updateMarketData(mockSigma, mockDepth);
        verify(decisionEngine, times(1)).recalculateAndUpdateCache();
    }
}
