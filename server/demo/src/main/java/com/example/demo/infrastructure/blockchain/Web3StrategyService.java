package com.example.demo.infrastructure.blockchain;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.*;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * READ-ONLY service đọc dữ liệu từ StakingStrategyController (Staking.sol).
 *
 * QUAN TRỌNG: Khác với Web3StakingService (WalletStaking legacy),
 * service này phục vụ hợp đồng Staking.sol MỚI (Strategy-based).
 *
 * Các hàm đọc:
 * - getAllPools()               → danh sách pool config
 * - getPool(poolId)            → pool đơn lẻ
 * - getUserStake(user, id)     → vị thế của user (shares + assetsAtStake)
 * - getUserStakeCount(user)    → số lượng vị thế
 * - isLocked(user, id)         → lock status
 * - totalDeployedToVault()     → tổng vốn đang stake
 * - totalHarvested()           → tổng yield đã harvest
 * - totalPenalties()           → tổng phí phạt thu được
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Web3StrategyService {

    private final Web3j web3j;

    @Value("${blockchain.strategy-contract-address:}")
    private String strategyAddress;

    private static final BigInteger DECIMALS_18 = BigInteger.TEN.pow(18);

    // =========================================================
    // Pool queries
    // =========================================================

    /** totalDeployedToVault() — tổng SKT đang stake trong tất cả pools */
    public BigDecimal getTotalDeployedToVault() {
        return callUint256("totalDeployedToVault", Collections.emptyList(), "totalDeployedToVault");
    }

    /** totalHarvested() — tổng SKT reward đã được inject vào vault */
    public BigDecimal getTotalHarvested() {
        return callUint256("totalHarvested", Collections.emptyList(), "totalHarvested");
    }

    /** totalPenalties() — tổng penalty đã thu */
    public BigDecimal getTotalPenalties() {
        return callUint256("totalPenalties", Collections.emptyList(), "totalPenalties");
    }

    /** getUserStakeCount(address) — số vị thế đang có của user */
    public Long getUserStakeCount(String userAddress) {
        BigDecimal count = callUint256("getUserStakeCount",
                List.of(new Address(userAddress)),
                "getUserStakeCount");
        return count.longValue();
    }

    // =========================================================
    // User stake query — trả về tuple từ getUserStake()
    //
    // Tuple từ Staking.sol (dựa trên ABI trong business doc):
    //   (poolId, shares, assetsAtStake, stakedAt, isActive)
    // =========================================================

    public UserStakeOnChain getUserStake(String userAddress, Long stakeId) {
        try {
            if (strategyAddress == null || strategyAddress.isEmpty()) {
                return null;
            }

            Function function = new Function("getUserStake",
                    List.of(new Address(userAddress), new Uint256(BigInteger.valueOf(stakeId))),
                    List.of(
                            new TypeReference<Uint256>() {},  // poolId
                            new TypeReference<Uint256>() {},  // shares
                            new TypeReference<Uint256>() {},  // assetsAtStake
                            new TypeReference<Uint256>() {},  // stakedAt
                            new TypeReference<Bool>() {}      // isActive
                    ));

            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, strategyAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError() || response.getValue() == null || response.getValue().equals("0x")) {
                return null;
            }

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.size() < 5) return null;

            UserStakeOnChain stake = new UserStakeOnChain();
            stake.poolId        = ((BigInteger) decoded.get(0).getValue()).intValue();
            stake.shares        = fromWei((BigInteger) decoded.get(1).getValue());
            stake.assetsAtStake = fromWei((BigInteger) decoded.get(2).getValue());
            stake.stakedAt      = ((BigInteger) decoded.get(3).getValue()).longValue();
            stake.isActive      = (Boolean) decoded.get(4).getValue();
            return stake;
        } catch (Exception e) {
            log.error("Failed to getUserStake for {}, stakeId: {}", userAddress, stakeId, e);
            return null;
        }
    }

    /** isLocked(user, stakeId) → (bool locked, uint256 remainingSeconds) */
    public LockStatus isLocked(String userAddress, Long stakeId) {
        try {
            if (strategyAddress == null || strategyAddress.isEmpty()) {
                return new LockStatus(false, 0L);
            }

            Function function = new Function("isLocked",
                    List.of(new Address(userAddress), new Uint256(BigInteger.valueOf(stakeId))),
                    List.of(
                            new TypeReference<Bool>() {},
                            new TypeReference<Uint256>() {}
                    ));

            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, strategyAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError() || response.getValue() == null) {
                return new LockStatus(false, 0L);
            }

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.size() < 2) return new LockStatus(false, 0L);

            boolean locked      = (Boolean) decoded.get(0).getValue();
            long remaining      = ((BigInteger) decoded.get(1).getValue()).longValue();
            return new LockStatus(locked, remaining);
        } catch (Exception e) {
            log.error("Failed to isLocked for {}, stakeId: {}", userAddress, stakeId, e);
            return new LockStatus(false, 0L);
        }
    }

    // =========================================================
    // Internal helpers
    // =========================================================

    private BigDecimal callUint256(String funcName, List<Type> inputs, String logLabel) {
        try {
            if (strategyAddress == null || strategyAddress.isEmpty()) return BigDecimal.ZERO;

            Function function = new Function(funcName, inputs,
                    List.of(new TypeReference<Uint256>() {}));

            String encoded = FunctionEncoder.encode(function);
            EthCall response = web3j.ethCall(
                    Transaction.createEthCallTransaction(null, strategyAddress, encoded),
                    DefaultBlockParameterName.LATEST
            ).send();

            if (response.hasError()) {
                log.error("EthCall error for {}(): {}", logLabel, response.getError().getMessage());
                return BigDecimal.ZERO;
            }

            List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
            if (decoded.isEmpty()) return BigDecimal.ZERO;

            return fromWei((BigInteger) decoded.get(0).getValue());
        } catch (Exception e) {
            log.error("Failed to call {}()", logLabel, e);
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal fromWei(BigInteger wei) {
        return new BigDecimal(wei).divide(new BigDecimal(DECIMALS_18), 18, java.math.RoundingMode.DOWN);
    }

    // =========================================================
    // DTOs
    // =========================================================

    public static class UserStakeOnChain {
        public Integer    poolId;
        public BigDecimal shares;         // dvSKT (Strategy holds for user)
        public BigDecimal assetsAtStake;  // SKT principal snapshot
        public Long       stakedAt;       // unix timestamp
        public Boolean    isActive;
    }

    public static class LockStatus {
        public Boolean locked;
        public Long    remainingSeconds;

        public LockStatus(Boolean locked, Long remainingSeconds) {
            this.locked = locked;
            this.remainingSeconds = remainingSeconds;
        }
    }
}
