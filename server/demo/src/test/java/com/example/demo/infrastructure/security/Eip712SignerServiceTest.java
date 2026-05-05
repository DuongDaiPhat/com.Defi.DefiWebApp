package com.example.demo.infrastructure.security;

import com.example.demo.infrastructure.config.OsvaConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.web3j.crypto.Credentials;

import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class Eip712SignerServiceTest {

    @Mock
    private OsvaConfig osvaConfig;

    private Eip712SignerService signerService;
    
    // A random mock private key for testing (64 hex characters)
    private static final String MOCK_PRIVATE_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Test
    void testSignerInitialization_Success() {
        when(osvaConfig.getOraclePrivateKey()).thenReturn(MOCK_PRIVATE_KEY);
        signerService = new Eip712SignerService(osvaConfig);
        
        String address = signerService.getSignerAddress();
        assertNotNull(address);
        assertNotEquals("NOT_CONFIGURED", address);
    }

    @Test
    void testSignerInitialization_NoKey_DoesNotCrash() {
        when(osvaConfig.getOraclePrivateKey()).thenReturn("");
        signerService = new Eip712SignerService(osvaConfig);
        
        assertEquals("NOT_CONFIGURED", signerService.getSignerAddress());
    }

    @Test
    void testSignSwapRequest_Success() {
        // Arrange
        when(osvaConfig.getOraclePrivateKey()).thenReturn(MOCK_PRIVATE_KEY);
        when(osvaConfig.getPoolAddress()).thenReturn("0x1234567890123456789012345678901234567890");
        when(osvaConfig.getChainId()).thenReturn(11155111L);
        
        signerService = new Eip712SignerService(osvaConfig);

        String userAddress = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
        String tokenIn = "0x0987654321098765432109876543210987654321";
        BigInteger amountIn = new BigInteger("1000000000000000000"); // 1 token
        long alpha = 99L;
        long deadline = 1750000000L;

        // Act
        String signature = signerService.signSwapRequest(userAddress, tokenIn, amountIn, alpha, deadline);

        // Assert
        assertNotNull(signature);
        assertTrue(signature.startsWith("0x"));
        assertEquals(132, signature.length()); // 65 bytes hex = 130 chars + "0x"
    }

    @Test
    void testSignSwapRequest_ThrowsException_IfNoKey() {
        // Arrange
        when(osvaConfig.getOraclePrivateKey()).thenReturn("");
        signerService = new Eip712SignerService(osvaConfig);

        // Act & Assert
        assertThrows(IllegalStateException.class, () -> {
            signerService.signSwapRequest(
                    "0x123", "0x456", BigInteger.TEN, 50, 123456789L
            );
        });
    }
}
