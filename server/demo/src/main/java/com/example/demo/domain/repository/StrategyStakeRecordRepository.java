package com.example.demo.domain.repository;

import com.example.demo.infrastructure.persistence.entity.StrategyStakeRecord;
import com.example.demo.infrastructure.persistence.entity.StakingStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StrategyStakeRecordRepository extends JpaRepository<StrategyStakeRecord, String> {

    List<StrategyStakeRecord> findByWalletAddressOrderByStakedAtDesc(String walletAddress);

    List<StrategyStakeRecord> findByWalletAddressAndStatus(String walletAddress, StakingStatus status);

    Optional<StrategyStakeRecord> findByWalletAddressAndStakeId(String walletAddress, Long stakeId);

    @Query("SELECT s FROM StrategyStakeRecord s WHERE s.walletAddress = :wallet AND s.status = 'ACTIVE'")
    List<StrategyStakeRecord> findActiveStakes(@Param("wallet") String walletAddress);

    boolean existsByStakeTransactionHash(String stakeTransactionHash);
}
