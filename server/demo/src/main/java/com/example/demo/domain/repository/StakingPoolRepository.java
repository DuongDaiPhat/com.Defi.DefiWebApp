package com.example.demo.domain.repository;

import com.example.demo.infrastructure.persistence.entity.StakingPoolCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StakingPoolRepository extends JpaRepository<StakingPoolCache, Integer> {
    
    StakingPoolCache findByPoolId(Integer poolId);
    
    @Query("SELECT p FROM StakingPoolCache p WHERE p.isActive = true ORDER BY p.poolId ASC")
    List<StakingPoolCache> findAllActive();
    
    List<StakingPoolCache> findAllByOrderByPoolIdAsc();
}
