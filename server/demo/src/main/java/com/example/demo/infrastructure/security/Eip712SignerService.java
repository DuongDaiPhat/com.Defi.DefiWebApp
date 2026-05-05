package com.example.demo.infrastructure.security;

import com.example.demo.infrastructure.config.OsvaConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.web3j.crypto.Credentials;
import org.web3j.crypto.Sign;
import org.web3j.crypto.StructuredDataEncoder;
import org.web3j.utils.Numeric;

import java.math.BigInteger;

/**
 * Eip712SignerService — Tạo chữ ký EIP-712 cho giao dịch SwapOSVA.
 *
 * Sử dụng StructuredDataEncoder và Sign.signMessage của web3j.
 * Chuỗi JSON EIP-712 được tạo bằng Text Blocks (""") của Java 17.
 *
 * Cấu trúc phải đồng bộ tuyệt đối với Smart Contract:
 *   - Domain: name="OSVA_Protocol", version="1.0", chainId, verifyingContract
 *   - SwapRequest: user(address), tokenIn(address), amountIn(uint256), alpha(uint256), deadline(uint256)
 *
 * Trả về chữ ký hex 65 bytes (r + s + v) có prefix "0x".
 */
@Service
public class Eip712SignerService {

    private static final Logger log = LoggerFactory.getLogger(Eip712SignerService.class);

    private final OsvaConfig osvaConfig;
    private final Credentials credentials;

    /**
     * Constructor: Load Private Key từ OsvaConfig và tạo Credentials một lần duy nhất.
     */
    public Eip712SignerService(OsvaConfig osvaConfig) {
        this.osvaConfig = osvaConfig;

        String privateKey = osvaConfig.getOraclePrivateKey();
        if (privateKey == null || privateKey.isBlank()) {
            log.warn("[Eip712Signer] ORACLE_PRIVATE_KEY chưa được cấu hình. " +
                    "Chữ ký sẽ thất bại cho đến khi key được cung cấp.");
            this.credentials = null;
        } else {
            try {
                // Loại bỏ prefix 0x nếu có
                String cleanKey = privateKey.startsWith("0x") ? privateKey.substring(2) : privateKey;
                this.credentials = Credentials.create(cleanKey);
                log.info("[Eip712Signer] Oracle Signer Address: {}", credentials.getAddress());
            } catch (Exception e) {
                log.error("[Eip712Signer] Lỗi khi tạo Credentials từ Private Key: {}", e.getMessage(), e);
                throw new IllegalStateException("Không thể khởi tạo Oracle Credentials", e);
            }
        }
    }

    // ============================================================
    //  Core: Tạo chữ ký EIP-712 cho SwapRequest
    // ============================================================

    /**
     * Ký dữ liệu SwapRequest theo chuẩn EIP-712.
     *
     * @param userAddress Địa chỉ ví người dùng (msg.sender trên Smart Contract)
     * @param tokenIn     Địa chỉ token đầu vào
     * @param amountIn    Số lượng token (đã nhân decimals, dạng BigInteger wei)
     * @param alpha       Hệ số khuếch đại (0 - 100)
     * @param deadline    Unix timestamp hết hạn giao dịch
     * @return Chuỗi hex chữ ký 65 bytes có prefix "0x"
     */
    public String signSwapRequest(
            String userAddress,
            String tokenIn,
            BigInteger amountIn,
            long alpha,
            long deadline
    ) {
        try {
            if (credentials == null) {
                throw new IllegalStateException("Oracle Private Key chưa được cấu hình");
            }

            String poolAddress = osvaConfig.getPoolAddress();
            if (poolAddress == null || poolAddress.isBlank()) {
                throw new IllegalStateException("Pool Address chưa được cấu hình");
            }

            long chainId = osvaConfig.getChainId();

            // ─── Tạo JSON chuẩn EIP-712 bằng Text Blocks ───
            String eip712Json = buildEip712Json(
                    chainId, poolAddress,
                    userAddress, tokenIn, amountIn.toString(), alpha, deadline
            );

            log.debug("[Eip712Signer] EIP-712 JSON:\n{}", eip712Json);

            // ─── Encode cấu trúc dữ liệu ───
            StructuredDataEncoder encoder = new StructuredDataEncoder(eip712Json);
            byte[] hash = encoder.hashStructuredData();

            // ─── Ký bằng ECDSA ───
            // Tham số thứ 3: needToHash = false (vì hashStructuredData đã hash sẵn)
            Sign.SignatureData signatureData = Sign.signMessage(hash, credentials.getEcKeyPair(), false);

            // ─── Ghép r + s + v thành chuỗi hex 65 bytes ───
            String signature = encodeSignature(signatureData);

            log.info("[Eip712Signer] Chữ ký đã tạo — user={}, alpha={}, deadline={}, sig={}...{}",
                    userAddress, alpha, deadline,
                    signature.substring(0, 10), signature.substring(signature.length() - 6));

            return signature;

        } catch (IllegalStateException e) {
            log.error("[Eip712Signer] Lỗi cấu hình: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("[Eip712Signer] Lỗi khi tạo chữ ký EIP-712: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể tạo chữ ký EIP-712", e);
        }
    }

    // ============================================================
    //  Text Block JSON — Cấu trúc EIP-712
    // ============================================================

    /**
     * Tạo JSON chuẩn EIP-712 bằng Text Blocks (Java 17).
     *
     * QUAN TRỌNG: Thứ tự trường trong "SwapRequest" phải KHỚP HOÀN TOÀN
     * với SWAP_REQUEST_TYPEHASH trong Smart Contract:
     *   "SwapRequest(address user,address tokenIn,uint256 amountIn,uint256 alpha,uint256 deadline)"
     */
    private String buildEip712Json(
            long chainId,
            String verifyingContract,
            String user,
            String tokenIn,
            String amountIn,
            long alpha,
            long deadline
    ) {
        return """
                {
                    "types": {
                        "EIP712Domain": [
                            {"name": "name",              "type": "string"},
                            {"name": "version",           "type": "string"},
                            {"name": "chainId",           "type": "uint256"},
                            {"name": "verifyingContract", "type": "address"}
                        ],
                        "SwapRequest": [
                            {"name": "user",      "type": "address"},
                            {"name": "tokenIn",   "type": "address"},
                            {"name": "amountIn",  "type": "uint256"},
                            {"name": "alpha",     "type": "uint256"},
                            {"name": "deadline",  "type": "uint256"}
                        ]
                    },
                    "primaryType": "SwapRequest",
                    "domain": {
                        "name":              "OSVA_Protocol",
                        "version":           "1.0",
                        "chainId":           %d,
                        "verifyingContract": "%s"
                    },
                    "message": {
                        "user":      "%s",
                        "tokenIn":   "%s",
                        "amountIn":  "%s",
                        "alpha":     "%d",
                        "deadline":  "%d"
                    }
                }
                """.formatted(chainId, verifyingContract, user, tokenIn, amountIn, alpha, deadline);
    }

    // ============================================================
    //  Utility: Encode SignatureData → Hex String
    // ============================================================

    /**
     * Ghép r (32 bytes) + s (32 bytes) + v (1 byte) thành chuỗi hex 65 bytes.
     * Kết quả có prefix "0x".
     *
     * Thứ tự: r || s || v (chuẩn Ethereum, tương thích ECDSA.recover của OpenZeppelin)
     */
    private String encodeSignature(Sign.SignatureData signatureData) {
        try {
            byte[] r = signatureData.getR();
            byte[] s = signatureData.getS();
            byte[] v = signatureData.getV();

            // r (32 bytes) + s (32 bytes) + v (1 byte) = 65 bytes
            byte[] signature = new byte[65];
            System.arraycopy(r, 0, signature, 0, 32);
            System.arraycopy(s, 0, signature, 32, 32);
            signature[64] = v[0];

            String hex = Numeric.toHexString(signature);
            log.debug("[Eip712Signer] Signature encoded — length={} bytes, hex={}",
                    signature.length, hex);

            return hex;

        } catch (Exception e) {
            log.error("[Eip712Signer] Lỗi khi encode SignatureData: {}", e.getMessage(), e);
            throw new RuntimeException("Không thể encode chữ ký", e);
        }
    }

    // ============================================================
    //  Utility: Lấy địa chỉ ví của Oracle Signer
    // ============================================================

    /**
     * Trả về địa chỉ công khai của Oracle Signer.
     * Dùng để so sánh với giá trị oracleSigner trong Smart Contract khi verify.
     */
    public String getSignerAddress() {
        if (credentials == null) {
            return "NOT_CONFIGURED";
        }
        return credentials.getAddress();
    }
}
