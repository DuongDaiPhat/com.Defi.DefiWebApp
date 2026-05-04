package com.example.demo.infrastructure.blockchain;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Service to interact with WalletStaking smart contract on blockchain
 * This is a READ-ONLY service that fetches realtime data from contract
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Web3StakingService {

    @Value("${blockchain.staking-contract-address:}")
    private String stakingContractAddress;

    private final org.web3j.protocol.Web3j web3j;

    /**
     * Fetch all staking pools from the smart contract
     * Note: In a real implementation, this would call the actual contract
     * For now, we use cached data as fallback
     */
    public List<StakingPoolData> getAllPoolsFromContract() {
        try {
            if (stakingContractAddress == null || stakingContractAddress.isEmpty()) {
                return new ArrayList<>();
            }
            // Trong bản Legacy, không có hàm 'getAllPools' trả list trực tiếp dễ dàng như Solidity 0.8
            // Tạm thời gọi pool count, sau đó loop qua (hoặc dùng cache database như StakingApplicationService đã làm)
            // Vì đây là fallback getter, ta log rồi trả empty, cache DB (StakingPoolCache) sẽ làm nhiệm vụ này.
            log.info("Fetching pools from contract fallback: {}", stakingContractAddress);
            return new ArrayList<>();
        } catch (Exception e) {
            log.error("Failed to fetch pools from contract", e);
            return new ArrayList<>();
        }
    }

    /**
     * Get pending reward for a user's stake
     */
    public BigDecimal getPendingReward(String userAddress, Long stakeId) {
        try {
            if (stakingContractAddress == null || stakingContractAddress.isEmpty()) return BigDecimal.ZERO;

            org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function("getPendingReward",
                    List.of(new org.web3j.abi.datatypes.Address(userAddress), new org.web3j.abi.datatypes.generated.Uint256(stakeId)),
                    List.of(new org.web3j.abi.TypeReference<org.web3j.abi.datatypes.generated.Uint256>() {}));

            String encoded = org.web3j.abi.FunctionEncoder.encode(function);
            org.web3j.protocol.core.methods.response.EthCall response = web3j.ethCall(
                    org.web3j.protocol.core.methods.request.Transaction.createEthCallTransaction(null, stakingContractAddress, encoded),
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError() || response.getValue() == null) return BigDecimal.ZERO;
            List<org.web3j.abi.datatypes.Type> decoded = org.web3j.abi.FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.isEmpty()) return BigDecimal.ZERO;

            java.math.BigInteger wei = (java.math.BigInteger) decoded.get(0).getValue();
            return new BigDecimal(wei).divide(BigDecimal.TEN.pow(18), 18, java.math.RoundingMode.DOWN);
        } catch (Exception e) {
            log.error("Failed to get pending reward for {}, stakeId: {}", userAddress, stakeId, e);
            return BigDecimal.ZERO;
        }
    }

    /**
     * Check if a stake is locked
     */
    public LockStatus isStakeLocked(String userAddress, Long stakeId) {
        try {
            if (stakingContractAddress == null || stakingContractAddress.isEmpty()) return new LockStatus(false, 0L);

            org.web3j.abi.datatypes.Function function = new org.web3j.abi.datatypes.Function("isLocked",
                    List.of(new org.web3j.abi.datatypes.Address(userAddress), new org.web3j.abi.datatypes.generated.Uint256(stakeId)),
                    List.of(
                            new org.web3j.abi.TypeReference<org.web3j.abi.datatypes.Bool>() {},
                            new org.web3j.abi.TypeReference<org.web3j.abi.datatypes.generated.Uint256>() {}
                    ));

            String encoded = org.web3j.abi.FunctionEncoder.encode(function);
            org.web3j.protocol.core.methods.response.EthCall response = web3j.ethCall(
                    org.web3j.protocol.core.methods.request.Transaction.createEthCallTransaction(null, stakingContractAddress, encoded),
                    org.web3j.protocol.core.DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError() || response.getValue() == null) return new LockStatus(false, 0L);
            List<org.web3j.abi.datatypes.Type> decoded = org.web3j.abi.FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.size() < 2) return new LockStatus(false, 0L);

            return new LockStatus((Boolean) decoded.get(0).getValue(), ((java.math.BigInteger) decoded.get(1).getValue()).longValue());
        } catch (Exception e) {
            log.error("Failed to check lock status for {}, stakeId: {}", userAddress, stakeId, e);
            return new LockStatus(false, 0L);
        }
    }

    /**
     * Get user stake info from contract
     */
    public UserStakeInfo getUserStakeInfo(String userAddress, Long stakeId) {
        try {
            // WalletStaking.sol implementation: mapping (address => mapping(uint256 => UserStake))
            // Chức năng này tạm thời dùng repository DB để fallback nếu chưa query được ABI struct phức tạp từ Web3j
            return null;
        } catch (Exception e) {
            log.error("Failed to get stake info for {}, stakeId: {}", userAddress, stakeId, e);
            return null;
        }
    }

    /**
     * Get pool info from contract
     */
    public StakingPoolData getPoolFromContract(Integer poolId) {
        try {
            // DB cache holds this data efficiently in StakingPoolRepository.
            return null;
        } catch (Exception e) {
            log.error("Failed to get pool {} from contract", poolId, e);
            return null;
        }
    }

    /**
     * Initialize contract (can be called on app startup)
     * Load all pools and cache them
     */
    public void initializeContractData() {
        log.info("Initializing WalletStaking contract data...");
        try {
            // Contract data is pre-seeded in the DB schema for tests/demo.
            // If dynamic reload is needed, implement event listening or admin trigger here.
            log.info("Contract initialization complete");
        } catch (Exception e) {
            log.error("Failed to initialize contract data", e);
        }
    }

    // DTOs
    public static class StakingPoolData {
        public Integer id;
        public String name;
        public Integer apr;
        public Long lockDuration;
        public Integer penaltyRate;
        public BigDecimal minStake;
        public BigDecimal maxStake;
        public BigDecimal totalStaked;
        public Boolean isActive;

        public StakingPoolData() {}

        public StakingPoolData(Integer id, String name, Integer apr, Long lockDuration, 
                              Integer penaltyRate, BigDecimal minStake, BigDecimal maxStake, 
                              BigDecimal totalStaked, Boolean isActive) {
            this.id = id;
            this.name = name;
            this.apr = apr;
            this.lockDuration = lockDuration;
            this.penaltyRate = penaltyRate;
            this.minStake = minStake;
            this.maxStake = maxStake;
            this.totalStaked = totalStaked;
            this.isActive = isActive;
        }
    }

    public static class UserStakeInfo {
        public Integer poolId;
        public BigDecimal amount;
        public Long stakedAt;
        public Long lastClaimAt;
        public BigDecimal pendingReward;
        public Boolean isActive;

        public UserStakeInfo() {}

        public UserStakeInfo(Integer poolId, BigDecimal amount, Long stakedAt, 
                            Long lastClaimAt, BigDecimal pendingReward, Boolean isActive) {
            this.poolId = poolId;
            this.amount = amount;
            this.stakedAt = stakedAt;
            this.lastClaimAt = lastClaimAt;
            this.pendingReward = pendingReward;
            this.isActive = isActive;
        }
    }

    public static class LockStatus {
        public Boolean locked;
        public Long remainingTime;

        public LockStatus() {}

        public LockStatus(Boolean locked, Long remainingTime) {
            this.locked = locked;
            this.remainingTime = remainingTime;
        }
    }
}
