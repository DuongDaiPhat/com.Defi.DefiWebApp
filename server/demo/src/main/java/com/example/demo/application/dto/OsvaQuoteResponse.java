package com.example.demo.application.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * OsvaQuoteResponse — DTO trả về cho Frontend khi gọi GET /api/v1/osva/quote.
 *
 * Chứa tất cả thông tin cần thiết để Frontend gửi giao dịch swapOSVA()
 * lên Smart Contract thông qua Ethers.js + MetaMask.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsvaQuoteResponse {

    /** Hệ số khuếch đại thanh khoản ảo (0 - 100) */
    private long alpha;

    /** Unix timestamp hết hạn giao dịch (giây) */
    private long deadline;

    /** Chữ ký EIP-712 hex (65 bytes, có prefix "0x") */
    private String signature;

    /** Địa chỉ Oracle Signer (để Frontend verify trước khi gửi) */
    private String signerAddress;
}
