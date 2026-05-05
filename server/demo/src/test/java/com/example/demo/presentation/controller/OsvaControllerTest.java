package com.example.demo.presentation.controller;

import com.example.demo.application.statecache.OsvaStateCache;
import com.example.demo.infrastructure.security.Eip712SignerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class OsvaControllerTest {

    private MockMvc mockMvc;

    @Mock
    private OsvaStateCache stateCache;

    @Mock
    private Eip712SignerService signerService;

    @InjectMocks
    private OsvaController osvaController;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        mockMvc = MockMvcBuilders.standaloneSetup(osvaController).build();
    }

    @Test
    void testGetQuote_Success() throws Exception {
        // Arrange
        String user = "0xUser";
        String tokenIn = "0xToken";
        String amountIn = "1000";

        when(stateCache.getCurrentAlpha()).thenReturn(75L);
        when(signerService.signSwapRequest(eq(user), eq(tokenIn), eq(new BigInteger(amountIn)), eq(75L), anyLong()))
                .thenReturn("0xSignature123");
        when(signerService.getSignerAddress()).thenReturn("0xOracleSigner");

        // Act & Assert
        mockMvc.perform(get("/api/v1/osva/quote")
                        .param("user", user)
                        .param("tokenIn", tokenIn)
                        .param("amountIn", amountIn)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data.alpha").value(75))
                .andExpect(jsonPath("$.data.signature").value("0xSignature123"))
                .andExpect(jsonPath("$.data.signerAddress").value("0xOracleSigner"));
    }

    @Test
    void testGetQuote_MissingParameters() throws Exception {
        // Missing amountIn
        mockMvc.perform(get("/api/v1/osva/quote")
                        .param("user", "0xUser")
                        .param("tokenIn", "0xToken")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest());

        // Empty user
        mockMvc.perform(get("/api/v1/osva/quote")
                        .param("user", "")
                        .param("tokenIn", "0xToken")
                        .param("amountIn", "100")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("error"))
                .andExpect(jsonPath("$.message").value("Tham số 'user' không được để trống"));
    }

    @Test
    void testGetQuote_InvalidAmount() throws Exception {
        // Invalid string
        mockMvc.perform(get("/api/v1/osva/quote")
                        .param("user", "0xUser")
                        .param("tokenIn", "0xToken")
                        .param("amountIn", "abc")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("error"));

        // Negative amount
        mockMvc.perform(get("/api/v1/osva/quote")
                        .param("user", "0xUser")
                        .param("tokenIn", "0xToken")
                        .param("amountIn", "-10")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value("error"))
                .andExpect(jsonPath("$.message").value("amountIn phải > 0"));
    }

    @Test
    void testGetStatus_Success() throws Exception {
        // Arrange
        OsvaStateCache.OsvaSnapshot snapshot = new OsvaStateCache.OsvaSnapshot(
                80L,
                new BigDecimal("0.02"),
                new BigDecimal("1.0"),
                new BigDecimal("1.0"),
                new BigDecimal("500"),
                new BigDecimal("500"),
                Instant.now()
        );

        when(stateCache.getSnapshot()).thenReturn(snapshot);
        when(stateCache.isReady()).thenReturn(true);
        when(signerService.getSignerAddress()).thenReturn("0xOracleSigner");

        // Act & Assert
        mockMvc.perform(get("/api/v1/osva/status")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data.currentAlpha").value(80))
                .andExpect(jsonPath("$.data.systemReady").value(true));
    }
}
