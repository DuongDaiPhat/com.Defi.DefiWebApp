package com.example.demo.presentation.controller;

import com.example.demo.application.service.StrategyApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * REST Controller cho StakingStrategyController (Staking.sol mới).
 * Giao tiếp với Client UI ở trang Strategy Dashboard.
 */
@RestController
@RequestMapping("/api/strategy")
@RequiredArgsConstructor
public class StrategyController {

    private final StrategyApplicationService strategyService;

    /**
     * Get protocol global stats (total deployed, total harvested, pricePerShare)
     * GET /api/strategy/stats
     */
    @GetMapping("/stats")
    public StrategyApplicationService.StrategyStatsResponse getStrategyStats() {
        return strategyService.getStrategyStats();
    }

    /**
     * Get all active & completed staking positions for a specific user.
     * Trả về cả pendingYield tính động từ on-chain (real-time).
     * GET /api/strategy/user/{walletAddress}
     */
    @GetMapping("/user/{walletAddress}")
    public List<StrategyApplicationService.UserStrategyStakeResponse> getUserStakes(
            @PathVariable String walletAddress) {
        return strategyService.getUserStakes(walletAddress);
    }

    /**
     * Ghi nhận TX stake mới vào Database.
     * Client gọi API này sau khi giao dịch MetaMask báo thành công.
     * POST /api/strategy/record-stake
     */
    @PostMapping("/record-stake")
    public void recordStake(@RequestBody StrategyApplicationService.RecordStrategyStakeRequest request) {
        strategyService.recordStake(request);
    }

    /**
     * Cập nhật trạng thái UNSTAKED sau khi rút tiền thành công (sau khi hết lock timer).
     * POST /api/strategy/record-unstake
     */
    @PostMapping("/record-unstake")
    public void recordUnstake(@RequestBody StrategyApplicationService.RecordStrategyUnstakeRequest request) {
        strategyService.recordUnstake(request);
    }

    /**
     * Cập nhật trạng thái EMERGENCY_WITHDRAWN sau khi rút khẩn cấp (mất phí phạt).
     * POST /api/strategy/record-emergency
     */
    @PostMapping("/record-emergency")
    public void recordEmergency(@RequestBody StrategyApplicationService.RecordStrategyEmergencyRequest request) {
        strategyService.recordEmergencyWithdraw(request);
    }
}
