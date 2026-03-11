package com.example.demo.infrastructure.blockchain;

import lombok.AllArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.methods.response.Transaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.utils.Convert;

import java.math.BigDecimal;
import java.util.Optional;

@Service

public class BlockchainServices {
    @Autowired
    private Web3j web3j;
    public boolean verifyTransaction(String txHash, String expectedFrom, String expectedTo, String expectedAmountEth) throws Exception {
        // 1. Lấy chi tiết giao dịch từ mạng Sepolia qua Alchemy
        Optional<Transaction> txOptional = web3j.ethGetTransactionByHash(txHash).send().getTransaction();

        if (txOptional.isPresent()) {
            Transaction tx = txOptional.get();

            // 2. Lấy biên lai (Receipt) để biết giao dịch thành công hay thất bại (Status 0x1 là thành công)
            TransactionReceipt receipt = web3j.ethGetTransactionReceipt(txHash).send().getResult();

            if (receipt == null || !receipt.getStatus().equals("0x1")) {
                return false; // Giao dịch thất bại hoặc chưa được đào xong
            }

            // 3. Kiểm tra các thông số quan trọng
            boolean isFromCorrect = tx.getFrom().equalsIgnoreCase(expectedFrom);
            boolean isToCorrect = tx.getTo().equalsIgnoreCase(expectedTo);

            BigDecimal valueInEth = Convert.fromWei(tx.getValue().toString(), Convert.Unit.ETHER);
            boolean isAmountCorrect = valueInEth.compareTo(new BigDecimal(expectedAmountEth)) >= 0;

            return isFromCorrect && isToCorrect && isAmountCorrect;
        }

        return false; // Không tìm thấy giao dịch
    }
}
