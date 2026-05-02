package com.example.demo.application.dto;

/**
 * DTO for recording staking actions
 */
public class StakingActionDTO {
    public String type; // STAKE, UNSTAKE, CLAIM, EMERGENCY_WITHDRAW
    public String walletAddress;
    public Integer poolId;
    public Long stakeId;
    public String amount;
    public String rewardAmount;
    public String transactionHash;

    public StakingActionDTO() {}

    public StakingActionDTO(String type, String walletAddress, Integer poolId, Long stakeId,
                           String amount, String rewardAmount, String transactionHash) {
        this.type = type;
        this.walletAddress = walletAddress;
        this.poolId = poolId;
        this.stakeId = stakeId;
        this.amount = amount;
        this.rewardAmount = rewardAmount;
        this.transactionHash = transactionHash;
    }

    // Getters and Setters
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getWalletAddress() { return walletAddress; }
    public void setWalletAddress(String walletAddress) { this.walletAddress = walletAddress; }

    public Integer getPoolId() { return poolId; }
    public void setPoolId(Integer poolId) { this.poolId = poolId; }

    public Long getStakeId() { return stakeId; }
    public void setStakeId(Long stakeId) { this.stakeId = stakeId; }

    public String getAmount() { return amount; }
    public void setAmount(String amount) { this.amount = amount; }

    public String getRewardAmount() { return rewardAmount; }
    public void setRewardAmount(String rewardAmount) { this.rewardAmount = rewardAmount; }

    public String getTransactionHash() { return transactionHash; }
    public void setTransactionHash(String transactionHash) { this.transactionHash = transactionHash; }

    @Override
    public String toString() {
        return "StakingActionDTO{" +
                "type='" + type + '\'' +
                ", walletAddress='" + walletAddress + '\'' +
                ", poolId=" + poolId +
                ", stakeId=" + stakeId +
                ", amount='" + amount + '\'' +
                ", rewardAmount='" + rewardAmount + '\'' +
                ", transactionHash='" + transactionHash + '\'' +
                '}';
    }
}
