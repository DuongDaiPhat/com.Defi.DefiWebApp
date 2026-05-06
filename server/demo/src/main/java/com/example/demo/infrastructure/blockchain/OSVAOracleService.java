package com.example.demo.infrastructure.blockchain;

import jakarta.annotation.PostConstruct;
import lombok.Builder;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeEncoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.Hash;
import org.web3j.crypto.Sign;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.utils.Numeric;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Service
public class OSVAOracleService {

    private final Web3j web3j;

    @Value("${osva.pool.address:0xbd2B2030c82DD76bbEe0F361525Ac36b5A6d6484}")
    private String poolAddress;

    // Set Default Private Key if not configured for Sepolia
    @Value("${osva.oracle.private-key:0x0000000000000000000000000000000000000000000000000000000000000001}")
    private String privateKey;

    @Value("${osva.sepolia.chain-id:11155111}")
    private long chainId;

    private Credentials credentials;

    // Cache State
    private boolean systemReady = false;
    private long currentAlpha = 0;
    private BigDecimal sigma = new BigDecimal("0.05"); // Default 5%
    private BigDecimal depthFactor = new BigDecimal("1.0");
    private BigDecimal imbalanceRatio = new BigDecimal("1.0");
    private BigInteger reserve0 = BigInteger.ZERO;
    private BigInteger reserve1 = BigInteger.ZERO;
    private String lastUpdated = "";

    // EIP-712 TypeHashes
    private static final byte[] DOMAIN_TYPEHASH = Hash.sha3("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)".getBytes());
    private static final byte[] QUOTE_TYPEHASH = Hash.sha3("OSVAQuote(address user,address tokenIn,uint256 amountIn,uint256 alpha,uint256 deadline)".getBytes());

    public OSVAOracleService(Web3j web3j) {
        this.web3j = web3j;
    }

    @PostConstruct
    public void init() {
        try {
            credentials = Credentials.create(privateKey);
            log.info("OSVA Oracle Signer Wallet loaded: {}", credentials.getAddress());
        } catch (Exception e) {
            log.error("Failed to load Oracle Private Key!", e);
        }
    }

    // =========================================================================
    // Core Engine Workers (Scheduled)
    // =========================================================================

    /**
     * Đồng bộ hoá dữ liệu thị trường giả lập (Ví dụ: kéo từ Binance)
     */
    @Scheduled(fixedRate = 10000)
    public void syncMarketData() {
        try {
            // Giả lập lấy dữ liệu biến động 24h
            sigma = new BigDecimal(Math.random() * 0.1).setScale(4, RoundingMode.HALF_UP);
            depthFactor = new BigDecimal(1.0 + Math.random() * 0.5).setScale(4, RoundingMode.HALF_UP);
            
            recalculateAlpha();
        } catch (Exception e) {
            log.warn("Lỗi sync market data", e);
        }
    }

    /**
     * Đồng bộ số dư On-chain của Pool để tính toán độ mức cân bằng
     */
    @Scheduled(fixedRate = 15000)
    public void syncPoolState() {
        try {
            reserve0 = callUint256("reserve0");
            reserve1 = callUint256("reserve1");

            // Calculate imbalance: Max(R0/R1, R1/R0)
            if (reserve0.compareTo(BigInteger.ZERO) > 0 && reserve1.compareTo(BigInteger.ZERO) > 0) {
                BigDecimal r0 = new BigDecimal(reserve0);
                BigDecimal r1 = new BigDecimal(reserve1);
                BigDecimal r0r1 = r0.divide(r1, 4, RoundingMode.HALF_UP);
                BigDecimal r1r0 = r1.divide(r0, 4, RoundingMode.HALF_UP);
                imbalanceRatio = r0r1.max(r1r0);
            } else {
                imbalanceRatio = BigDecimal.ONE;
            }

            recalculateAlpha();
            systemReady = true;
            lastUpdated = Instant.now().toString();

        } catch (Exception e) {
            log.warn("Lỗi sync pool state", e);
        }
    }

    private synchronized void recalculateAlpha() {
        // Công thức tính Alpha giả lập dựa trên sigma và imbalance.
        // Khi Sigma cao (thị trường biến động), Alpha giảm để bảo vệ rủi ro.
        // Tối đa là 100.
        
        long baseAlpha = 90;
        
        // Trừ đi % do biến động (ví dụ sigma 0.05 -> giảm 50 điểm)
        long penaltySigma = (long) (sigma.doubleValue() * 1000); 
        // Trừ do mất cân bằng pool (ví dụ 1.5 -> giảm 10 điểm)
        long penaltyImbalance = (long) ((imbalanceRatio.doubleValue() - 1.0) * 20);

        long calculated = baseAlpha - penaltySigma - penaltyImbalance;
        
        // Đảm bảo Alpha nằm trong đoạn 0 - 100
        currentAlpha = Math.max(0, Math.min(100, calculated));
    }


    // =========================================================================
    // API Implementations
    // =========================================================================

    public boolean isSystemReady() {
        return systemReady && credentials != null;
    }

    public OSVAStatus getSystemStatus() {
        OSVAStatus status = new OSVAStatus();
        status.setSystemReady(isSystemReady());
        status.setCurrentAlpha(currentAlpha);
        status.setSigma(sigma.toPlainString());
        status.setDepthFactor(depthFactor.toPlainString());
        status.setImbalanceRatio(imbalanceRatio.toPlainString());
        status.setReserve0(reserve0.toString());
        status.setReserve1(reserve1.toString());
        status.setLastUpdated(lastUpdated);
        status.setOracleSignerAddress(credentials != null ? credentials.getAddress() : null);
        return status;
    }

    public OSVAQuote generateQuote(String userAddress, String tokenIn, BigInteger amountIn) {
        // 1. Tạo Deadline: Now + 60s
        BigInteger deadline = BigInteger.valueOf(System.currentTimeMillis() / 1000 + 60);
        BigInteger alpha = BigInteger.valueOf(currentAlpha);

        // 2. Ký EIP-712
        String signature = signEIP712(userAddress, tokenIn, amountIn, alpha, deadline);

        // 3. Trả về
        OSVAQuote quote = new OSVAQuote();
        quote.setAlpha(currentAlpha);
        quote.setDeadline(deadline.longValue());
        quote.setSignature(signature);
        quote.setSignerAddress(credentials.getAddress());

        return quote;
    }

    // =========================================================================
    // Cryptography: EIP-712 Signature
    // =========================================================================

    private String signEIP712(String user, String tokenIn, BigInteger amountIn, BigInteger alpha, BigInteger deadline) {
        
        // Domain Separator Hash
        byte[] domainSeparator = hashDomain();

        // Struct Hash
        byte[] structHash = hashStruct(user, tokenIn, amountIn, alpha, deadline);

        // EIP-712 Encoding: "\x19\x01" + domainSeparator + structHash
        byte[] prefix = new byte[] {0x19, 0x01};
        byte[] eip712Message = new byte[2 + 32 + 32];
        System.arraycopy(prefix, 0, eip712Message, 0, 2);
        System.arraycopy(domainSeparator, 0, eip712Message, 2, 32);
        System.arraycopy(structHash, 0, eip712Message, 34, 32);

        // Keccak256
        byte[] messageHash = Hash.sha3(eip712Message);

        // Sign message (needToHash = false, vì đã tự hash bên trên)
        Sign.SignatureData signatureData = Sign.signMessage(messageHash, credentials.getEcKeyPair(), false);

        // Convert SignatureData to Ethereum hex 65 bytes
        return buildSignatureHex(signatureData);
    }

    private byte[] hashDomain() {
        // keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256("OSVAPool"), keccak256("1"), chainId, poolAddress))
        String nameHashHex = Numeric.toHexString(Hash.sha3("OSVAPool".getBytes()));
        String versionHashHex = Numeric.toHexString(Hash.sha3("1".getBytes()));

        List<Type> types = Arrays.asList(
                new Bytes32(DOMAIN_TYPEHASH),
                new Bytes32(Numeric.hexStringToByteArray(nameHashHex)),
                new Bytes32(Numeric.hexStringToByteArray(versionHashHex)),
                new Uint256(BigInteger.valueOf(chainId)),
                new Address(poolAddress)
        );

        return Hash.sha3(encodeTypes(types));
    }

    private byte[] hashStruct(String user, String tokenIn, BigInteger amountIn, BigInteger alpha, BigInteger deadline) {
        // keccak256(abi.encode(QUOTE_TYPEHASH, user, tokenIn, amountIn, alpha, deadline))
        List<Type> types = Arrays.asList(
                new Bytes32(QUOTE_TYPEHASH),
                new Address(user),
                new Address(tokenIn),
                new Uint256(amountIn),
                new Uint256(alpha),
                new Uint256(deadline)
        );

        return Hash.sha3(encodeTypes(types));
    }

    private byte[] encodeTypes(List<Type> types) {
        StringBuilder sb = new StringBuilder();
        for (Type t : types) {
            sb.append(TypeEncoder.encode(t));
        }
        return Numeric.hexStringToByteArray(sb.toString());
    }

    private String buildSignatureHex(Sign.SignatureData sig) {
        byte[] r = sig.getR();
        byte[] s = sig.getS();
        byte[] v = sig.getV();

        byte[] signatureBytes = new byte[65];
        System.arraycopy(r, 0, signatureBytes, 0, 32);
        System.arraycopy(s, 0, signatureBytes, 32, 32);
        signatureBytes[64] = v[0];

        return Numeric.toHexString(signatureBytes);
    }

    // =========================================================================
    // Utilities
    // =========================================================================

    private BigInteger callUint256(String funcName) {
        try {
            Function function = new Function(funcName, List.of(), List.of(new TypeReference<Uint256>() {}));
            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, poolAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();
            if (response.hasError() || response.getValue() == null) return BigInteger.ZERO;
            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.isEmpty()) return BigInteger.ZERO;
            return (BigInteger) decoded.get(0).getValue();
        } catch (Exception e) {
            log.error("Failed to read {} from contract", funcName, e);
            return BigInteger.ZERO;
        }
    }

    // =========================================================================
    // DTOs
    // =========================================================================

    @Data
    public static class OSVAStatus {
        private boolean systemReady;
        private long currentAlpha;
        private String sigma;
        private String depthFactor;
        private String imbalanceRatio;
        private String reserve0;
        private String reserve1;
        private String lastUpdated;
        private String oracleSignerAddress;
    }

    @Data
    public static class OSVAQuote {
        private long alpha;
        private long deadline;
        private String signature;
        private String signerAddress;
    }
}
