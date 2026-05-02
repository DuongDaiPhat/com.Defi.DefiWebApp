package com.example.demo.domain.repository;

import com.example.demo.infrastructure.persistence.entity.ClaimHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.math.BigDecimal;

@Repository
public interface ClaimHistoryRepository extends JpaRepository<ClaimHistory, String> {
    
    List<ClaimHistory> findByWalletAddress(String walletAddress);
    
    @Query("SELECT c FROM ClaimHistory c WHERE c.walletAddress = :walletAddress ORDER BY c.claimedAt DESC")
    List<ClaimHistory> findByWalletAddressOrderByClaimedAtDesc(@Param("walletAddress") String walletAddress);
    
    List<ClaimHistory> findByStakeId(Long stakeId);
    
    @Query("SELECT c FROM ClaimHistory c WHERE c.walletAddress = :walletAddress AND c.claimedAt BETWEEN :startDate AND :endDate")
    List<ClaimHistory> findByWalletAddressAndDateRange(
        @Param("walletAddress") String walletAddress,
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
    
    @Query("SELECT SUM(c.rewardAmount) FROM ClaimHistory c WHERE c.walletAddress = :walletAddress")
    BigDecimal getTotalClaimedRewards(@Param("walletAddress") String walletAddress);
}
