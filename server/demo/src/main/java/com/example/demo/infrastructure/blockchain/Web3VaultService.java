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
import java.math.MathContext;
import java.util.Collections;
import java.util.List;

/**
 * READ-ONLY service đọc dữ liệu từ DefiVault (ERC-4626) qua web3j.
 *
 * Tất cả hàm chỉ gọi view/pure functions — không tốn gas.
 * Implements: totalAssets, totalSupply, balanceOf, previewDeposit,
 *             previewMint, previewWithdraw, previewRedeem, paused
 *
 * Dựa trên ERC-4626 spec (defi-vault-business-document.md)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Web3VaultService {

    private final Web3j web3j;

    @Value("${blockchain.vault-contract-address:}")
    private String vaultAddress;

    private static final BigInteger DECIMALS_18 = BigInteger.TEN.pow(18);

    // =========================================================
    // Core ERC-4626 view functions
    // =========================================================

    /** totalAssets() — tổng SKT đang nằm trong vault */
    public BigDecimal getTotalAssets() {
        return callUint256("totalAssets", Collections.emptyList(), "totalAssets");
    }

    /** totalSupply() — tổng dvSKT (shares) đang lưu hành */
    public BigDecimal getTotalSupply() {
        return callUint256("totalSupply", Collections.emptyList(), "totalSupply");
    }

    /**
     * pricePerShare = convertToAssets(1e18)
     * Tỷ giá 1 dvSKT đổi ra bao nhiêu SKT.
     * Tăng dần theo thời gian khi harvest() được gọi.
     */
    public BigDecimal getPricePerShare() {
        return callUint256("convertToAssets",
                List.of(new Uint256(DECIMALS_18)),
                "convertToAssets");
    }

    /** balanceOf(address) — số dvSKT (shares) user đang nắm */
    public BigDecimal getUserShares(String userAddress) {
        return callUint256("balanceOf",
                List.of(new Address(userAddress)),
                "balanceOf");
    }

    /** previewDeposit(assets) — ước lượng shares nhận được khi deposit */
    public BigDecimal previewDeposit(BigDecimal assetAmount) {
        return callUint256("previewDeposit",
                List.of(new Uint256(toWei(assetAmount))),
                "previewDeposit");
    }

    /** previewMint(shares) — ước lượng assets cần nạp khi muốn mint đúng Y shares */
    public BigDecimal previewMint(BigDecimal shareAmount) {
        return callUint256("previewMint",
                List.of(new Uint256(toWei(shareAmount))),
                "previewMint");
    }

    /** previewWithdraw(assets) — ước lượng shares cần đốt khi muốn rút đúng X assets */
    public BigDecimal previewWithdraw(BigDecimal assetAmount) {
        return callUint256("previewWithdraw",
                List.of(new Uint256(toWei(assetAmount))),
                "previewWithdraw");
    }

    /**
     * previewRedeem(shares) — ước lượng assets nhận được khi đốt Y shares.
     * Đây là hàm quan trọng nhất để tính pendingYield trong Strategy:
     *   pendingYield = previewRedeem(sharesReceived) - assetsAtStake
     */
    public BigDecimal previewRedeem(BigDecimal shareAmount) {
        return callUint256("previewRedeem",
                List.of(new Uint256(toWei(shareAmount))),
                "previewRedeem");
    }

    /** previewRedeem nhận BigInteger (từ on-chain shares thô) */
    public BigDecimal previewRedeemRaw(BigInteger sharesWei) {
        return callUint256("previewRedeem",
                List.of(new Uint256(sharesWei)),
                "previewRedeem");
    }

    /** paused() — vault có đang bị tạm dừng không */
    public boolean isPaused() {
        try {
            if (vaultAddress == null || vaultAddress.isEmpty()) return false;

            Function function = new Function("paused",
                    Collections.emptyList(),
                    List.of(new TypeReference<Bool>() {}));

            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, vaultAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError() || response.getValue() == null) return false;

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.isEmpty()) return false;
            return (Boolean) decoded.get(0).getValue();
        } catch (Exception e) {
            log.error("Failed to call paused()", e);
            return false;
        }
    }

    // =========================================================
    // Helper: build full vault info
    // =========================================================

    public VaultInfo getVaultInfo(String userAddress) {
        VaultInfo info = new VaultInfo();
        info.totalAssets     = getTotalAssets();
        info.totalSupply     = getTotalSupply();
        info.pricePerShare   = getPricePerShare();
        info.paused          = isPaused();
        if (userAddress != null && !userAddress.isEmpty()) {
            info.userShares      = getUserShares(userAddress);
            info.userAssetValue  = previewRedeem(info.userShares);
        }
        return info;
    }

    // =========================================================
    // Internal: eth_call helper
    // =========================================================

    private BigDecimal callUint256(String funcName, List<Type> inputs, String logLabel) {
        try {
            if (vaultAddress == null || vaultAddress.isEmpty()) {
                log.warn("Vault contract address not configured");
                return BigDecimal.ZERO;
            }

            Function function = new Function(funcName, inputs,
                    List.of(new TypeReference<Uint256>() {}));

            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, vaultAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                log.error("EthCall error for {}(): {}", logLabel, response.getError().getMessage());
                return BigDecimal.ZERO;
            }

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.isEmpty()) return BigDecimal.ZERO;

            BigInteger raw = (BigInteger) decoded.get(0).getValue();
            return fromWei(raw);
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

    public static class VaultInfo {
        public BigDecimal totalAssets    = BigDecimal.ZERO;
        public BigDecimal totalSupply    = BigDecimal.ZERO;
        public BigDecimal pricePerShare  = BigDecimal.ZERO;
        public BigDecimal userShares     = BigDecimal.ZERO;
        public BigDecimal userAssetValue = BigDecimal.ZERO;
        public boolean    paused         = false;
    }
}
