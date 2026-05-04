package com.example.demo.domain.repository;

import com.example.demo.infrastructure.persistence.entity.VaultInteractionLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VaultInteractionLogRepository extends JpaRepository<VaultInteractionLog, String> {

    List<VaultInteractionLog> findByWalletAddressOrderByCreatedAtDesc(String walletAddress);

    List<VaultInteractionLog> findByWalletAddressAndActionTypeOrderByCreatedAtDesc(
            String walletAddress, String actionType);

    boolean existsByTransactionHash(String transactionHash);
}
