package com.example.demo.infrastructure.worker;

import com.example.demo.application.statecache.OsvaStateCache;
import com.example.demo.domain.service.DecisionEngineService;
import com.example.demo.infrastructure.config.OsvaConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.web3j.protocol.Web3j;

import java.math.BigDecimal;
import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class Web3WorkerTest {

    @Mock
    private Web3j web3j;

    @Mock
    private OsvaConfig osvaConfig;

    @Mock
    private OsvaStateCache stateCache;

    @Mock
    private DecisionEngineService decisionEngine;

    @InjectMocks
    private Web3Worker web3Worker;

    // Use a spy to mock the specific callReserve method, 
    // avoiding the need to deeply mock Web3j structures like EthCall and RemoteFunctionCall
    private Web3Worker spyWorker;

    @BeforeEach
    void setUp() {
        spyWorker = spy(web3Worker);
    }

    @Test
    void testCollectPoolState_Success() throws Exception {
        // Arrange
        String mockAddress = "0xPoolAddress";
        when(osvaConfig.getPoolAddress()).thenReturn(mockAddress);
        
        // Mock reserve0 = 2000, reserve1 = 1000
        doReturn(new BigInteger("2000")).when(spyWorker).callReserve(mockAddress, "reserve0");
        doReturn(new BigInteger("1000")).when(spyWorker).callReserve(mockAddress, "reserve1");

        // Act
        spyWorker.collectPoolState();

        // Assert
        // Imbalance = (2000 / 1000) ^ 1.5 = 2 ^ 1.5 = 2.828427
        BigDecimal expectedReserve0 = new BigDecimal("2000");
        BigDecimal expectedReserve1 = new BigDecimal("1000");
        BigDecimal expectedImbalance = new BigDecimal("2.828427");

        verify(stateCache, times(1)).updatePoolState(eq(expectedReserve0), eq(expectedReserve1), eq(expectedImbalance));
        verify(decisionEngine, times(1)).recalculateAndUpdateCache();
    }

    @Test
    void testCollectPoolState_EmptyReserves() throws Exception {
        // Arrange
        String mockAddress = "0xPoolAddress";
        when(osvaConfig.getPoolAddress()).thenReturn(mockAddress);
        
        // Mock reserve0 = 0, reserve1 = 0
        doReturn(BigInteger.ZERO).when(spyWorker).callReserve(mockAddress, "reserve0");
        doReturn(BigInteger.ZERO).when(spyWorker).callReserve(mockAddress, "reserve1");

        // Act
        spyWorker.collectPoolState();

        // Assert
        // When empty, M_imb defaults to 2.0
        BigDecimal expectedReserve0 = BigDecimal.ZERO;
        BigDecimal expectedReserve1 = BigDecimal.ZERO;
        BigDecimal expectedImbalance = new BigDecimal("2.0");

        verify(stateCache, times(1)).updatePoolState(eq(expectedReserve0), eq(expectedReserve1), eq(expectedImbalance));
        verify(decisionEngine, times(1)).recalculateAndUpdateCache();
    }

    @Test
    void testCollectPoolState_NoPoolAddress_ReturnsEarly() throws Exception {
        // Arrange
        when(osvaConfig.getPoolAddress()).thenReturn(null);

        // Act
        spyWorker.collectPoolState();

        // Assert
        verify(spyWorker, never()).callReserve(any(), any());
        verifyNoInteractions(stateCache);
        verifyNoInteractions(decisionEngine);
    }

    @Test
    void testRecoverCallReserve() {
        // Arrange
        Exception exception = new RuntimeException("RPC Timeout");
        
        // Act
        BigInteger result = web3Worker.recoverCallReserve(exception, "0xContract", "reserve0");
        
        // Assert
        assertEquals(BigInteger.ZERO, result, "Recovery should return ZERO on complete failure");
    }
}
