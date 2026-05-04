package com.example.demo.presentation.controller;

import com.example.demo.application.service.VaultApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller cho DefiVault (ERC-4626).
 * Phục vụ Client đọc thông tin Vault và lưu log lịch sử giao dịch.
 */
@RestController
@RequestMapping("/api/vault")
@RequiredArgsConstructor
public class VaultController {

    private final VaultApplicationService vaultService;

    /**
     * Get aggregate vault info + user position (if address provided)
     * GET /api/vault/info?address=0x123...
     */
    @GetMapping("/info")
    public VaultApplicationService.VaultInfoResponse getVaultInfo(
            @RequestParam(required = false) String address) {
        return vaultService.getVaultInfo(address);
    }

    /**
     * Preview quy đổi SKT ra dvSKT cho hàm deposit (floor rounding)
     * GET /api/vault/preview/deposit?assets=100
     */
    @GetMapping("/preview/deposit")
    public String previewDeposit(@RequestParam String assets) {
        return vaultService.previewDeposit(assets);
    }

    /**
     * Preview lượng SKT cần thiết để nhận chính xác Y dvSKT (ceil rounding)
     * GET /api/vault/preview/mint?shares=100
     */
    @GetMapping("/preview/mint")
    public String previewMint(@RequestParam String shares) {
        return vaultService.previewMint(shares);
    }

    /**
     * Preview lượng dvSKT cần đốt để rút chính xác X SKT (ceil rounding)
     * GET /api/vault/preview/withdraw?assets=100
     */
    @GetMapping("/preview/withdraw")
    public String previewWithdraw(@RequestParam String assets) {
        return vaultService.previewWithdraw(assets);
    }

    /**
     * Preview lượng SKT nhận được khi redeem Y dvSKT (floor rounding)
     * GET /api/vault/preview/redeem?shares=100
     */
    @GetMapping("/preview/redeem")
    public String previewRedeem(@RequestParam String shares) {
        return vaultService.previewRedeem(shares);
    }

    /**
     * Record a vault interaction (called by client after successful tx)
     * POST /api/vault/record
     */
    @PostMapping("/record")
    public void recordInteraction(@RequestBody VaultApplicationService.RecordVaultInteractionRequest request) {
        vaultService.recordInteraction(request);
    }

    /**
     * Get user's interaction history with the Vault (from DB audit log)
     * GET /api/vault/history/{walletAddress}
     */
    @GetMapping("/history/{walletAddress}")
    public List<VaultApplicationService.VaultInteractionResponse> getVaultHistory(
            @PathVariable String walletAddress) {
        return vaultService.getHistory(walletAddress);
    }
}
