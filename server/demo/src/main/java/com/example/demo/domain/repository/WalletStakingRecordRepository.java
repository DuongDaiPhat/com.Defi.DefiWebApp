package com.example.demo.domain.repository;

import com.example.demo.infrastructure.persistence.entity.WalletStakingRecord;
import com.example.demo.infrastructure.persistence.entity.StakingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WalletStakingRecordRepository extends JpaRepository<WalletStakingRecord, String> {
    
    List<WalletStakingRecord> findByWalletAddress(String walletAddress);
    
    WalletStakingRecord findByWalletAddressAndStakeId(String walletAddress, Long stakeId);
    
    @Query("SELECT w FROM WalletStakingRecord w WHERE w.walletAddress = :walletAddress AND w.status = com.example.demo.infrastructure.persistence.entity.StakingStatus.ACTIVE")
    List<WalletStakingRecord> findActiveStakes(@Param("walletAddress") String walletAddress);
    
    @Query("SELECT w FROM WalletStakingRecord w WHERE w.walletAddress = :walletAddress ORDER BY w.stakedAt DESC")
    List<WalletStakingRecord> findByWalletAddressOrderByStakedAtDesc(@Param("walletAddress") String walletAddress);
    
    List<WalletStakingRecord> findByPoolId(Integer poolId);
    
    Integer countByWalletAddressAndStatus(String walletAddress, StakingStatus status);
}
