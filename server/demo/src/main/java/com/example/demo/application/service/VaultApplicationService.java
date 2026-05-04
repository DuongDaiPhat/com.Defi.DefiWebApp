package com.example.demo.application.service;

import com.example.demo.infrastructure.blockchain.Web3VaultService;
import com.example.demo.infrastructure.persistence.entity.VaultInteractionLog;
import com.example.demo.domain.repository.VaultInteractionLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Application Service cho DefiVault (ERC-4626).
 *
 * Phân công:
 * - Đọc dữ liệu: delegate sang Web3VaultService (on-chain, real-time)
 * - Ghi DB: log sau khi Client báo TX đã confirm
 *
 * Tuân thủ kiến trúc:
 * Server chỉ là "read bridge" và "audit log" — không thực hiện write lên chain.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class VaultApplicationService {

    private final Web3VaultService web3VaultService;
    private final VaultInteractionLogRepository vaultLogRepository;

    // =========================================================
    // READ — delegate to blockchain
    // =========================================================

    public VaultInfoResponse getVaultInfo(String userAddress) {
        Web3VaultService.VaultInfo info = web3VaultService.getVaultInfo(userAddress);

        VaultInfoResponse resp = new VaultInfoResponse();
        resp.totalAssets     = info.totalAssets.toPlainString();
        resp.totalSupply     = info.totalSupply.toPlainString();
        resp.pricePerShare   = info.pricePerShare.toPlainString();
        resp.paused          = info.paused;

        if (userAddress != null && !userAddress.isEmpty()) {
            resp.userShares      = info.userShares.toPlainString();
            resp.userAssetValue  = info.userAssetValue.toPlainString();
        }
        return resp;
    }

    public String previewDeposit(String assetAmount) {
        BigDecimal amount = safeParse(assetAmount);
        return web3VaultService.previewDeposit(amount).toPlainString();
    }

    public String previewMint(String shareAmount) {
        BigDecimal amount = safeParse(shareAmount);
        return web3VaultService.previewMint(amount).toPlainString();
    }

    public String previewWithdraw(String assetAmount) {
        BigDecimal amount = safeParse(assetAmount);
        return web3VaultService.previewWithdraw(amount).toPlainString();
    }

    public String previewRedeem(String shareAmount) {
        BigDecimal amount = safeParse(shareAmount);
        return web3VaultService.previewRedeem(amount).toPlainString();
    }

    // =========================================================
    // WRITE — log only (actual TX done by Client via MetaMask)
    // =========================================================

    /**
     * Client gọi sau khi TX deposit/mint/withdraw/redeem được confirm.
     * Server chỉ ghi log audit — KHÔNG thực hiện bất kỳ TX on-chain nào.
     */
    public void recordInteraction(RecordVaultInteractionRequest request) {
        // Idempotent: bỏ qua nếu txHash đã tồn tại
        if (vaultLogRepository.existsByTransactionHash(request.transactionHash)) {
            log.warn("Vault interaction already recorded for txHash: {}", request.transactionHash);
            return;
        }

        // Validate actionType
        if (!List.of("DEPOSIT", "MINT", "WITHDRAW", "REDEEM").contains(request.actionType)) {
            throw new IllegalArgumentException("Invalid actionType: " + request.actionType);
        }

        // Snapshot pricePerShare tại thời điểm record
        BigDecimal pricePerShare = web3VaultService.getPricePerShare();

        VaultInteractionLog log = VaultInteractionLog.builder()
                .walletAddress(request.walletAddress.toLowerCase())
                .actionType(request.actionType)
                .assets(safeParse(request.assets))
                .shares(safeParse(request.shares))
                .pricePerShareAtTime(pricePerShare)
                .transactionHash(request.transactionHash)
                .build();

        vaultLogRepository.save(log);
        this.log.info("Recorded vault interaction: {} for {}, txHash: {}",
                request.actionType, request.walletAddress, request.transactionHash);
    }

    public List<VaultInteractionResponse> getHistory(String walletAddress) {
        return vaultLogRepository
                .findByWalletAddressOrderByCreatedAtDesc(walletAddress.toLowerCase())
                .stream()
                .map(l -> {
                    VaultInteractionResponse r = new VaultInteractionResponse();
                    r.actionType         = l.getActionType();
                    r.assets             = l.getAssets() != null ? l.getAssets().toPlainString() : "0";
                    r.shares             = l.getShares() != null ? l.getShares().toPlainString() : "0";
                    r.pricePerShareAtTime = l.getPricePerShareAtTime() != null
                            ? l.getPricePerShareAtTime().toPlainString() : "0";
                    r.transactionHash    = l.getTransactionHash();
                    r.createdAt          = l.getCreatedAt() != null ? l.getCreatedAt().toString() : null;
                    return r;
                })
                .collect(Collectors.toList());
    }

    // =========================================================
    // Helper
    // =========================================================

    private BigDecimal safeParse(String value) {
        if (value == null || value.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    // =========================================================
    // DTOs (inner classes để giữ gọn)
    // =========================================================

    public static class VaultInfoResponse {
        public String  totalAssets    = "0";
        public String  totalSupply    = "0";
        public String  pricePerShare  = "0";
        public String  userShares     = "0";
        public String  userAssetValue = "0";
        public boolean paused         = false;
    }

    public static class RecordVaultInteractionRequest {
        public String walletAddress;
        public String actionType;   // DEPOSIT | MINT | WITHDRAW | REDEEM
        public String assets;       // SKT amount (decimal string)
        public String shares;       // dvSKT amount (decimal string)
        public String transactionHash;
    }

    public static class VaultInteractionResponse {
        public String actionType;
        public String assets;
        public String shares;
        public String pricePerShareAtTime;
        public String transactionHash;
        public String createdAt;
    }
}
