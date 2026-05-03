# Task List — Strategy-Based Vault Implementation

> **Feature:** Refactor Staking.sol → Strategy Controller + kết nối DefiVault
> **Approach:** Approach 1 — Minimal Wrapper (Strategy giữ Shares, map cho User)
> **Hard Constraint:** Không chỉnh sửa `WalletStaking.sol`; file này chỉ dùng làm baseline. Các thay đổi contract chính nằm ở `Staking.sol` và test/deploy liên quan.
> **Constraint:** Mỗi task phải được verify trước khi mark `[x]`

---

## Phase 1: Interface & Foundation
> **Mục tiêu:** Thiết lập nền tảng — interfaces và đảm bảo Vault sẵn sàng tích hợp.
> **Verify:** `npx hardhat compile` không có lỗi.

- `[x]` **1.1** Tạo `blockchain/contracts/interfaces/IStrategy.sol`
  - Định nghĩa: `vault()`, `totalDeployed()`, `harvest(uint256)`
  - File scope: `contracts/interfaces/IStrategy.sol` [DONE]

- `[x]` **1.2** Kiểm tra `IDefiVault.sol` có đủ các hàm Strategy cần:
  - `deposit(uint256)`, `redeem(uint256)`, `redeem(uint256, uint256)`, `previewRedeem(uint256)`, `asset()`
  - ✅ Đã đủ — không cần bổ sung
  - File scope: `contracts/interfaces/IDefiVault.sol` [VERIFIED, NO CHANGE]

- `[x]` **1.3** Xác nhận `stakingToken == vault.asset()` requirement
  - ✅ Đã implement validation trong constructor: `if (IDefiVault(vaultAddress_).asset() != _stakingToken) revert TokenMismatch()`

- `[x]` **1.4** Đảm bảo `WalletStaking.sol` được giữ nguyên để làm baseline so sánh sau này. Không thực hiện thay đổi nào trên file này.
  - ✅ Xác nhận — không có thay đổi nào trên `WalletStaking.sol`

- `[x]` **1.5** Cấu hình `hardhat-gas-reporter` trong `hardhat.config.ts`
  - Thêm plugin: `"hardhat-gas-reporter": "^2.3.0"` vào package.json
  - Cấu hình `gasReporter` block trong `hardhat.config.ts`
  - File scope: `hardhat.config.ts`, `package.json` [DONE]

---

## Phase 2: Refactor Staking.sol → Strategy Controller
> **Mục tiêu:** Thay thế hoàn toàn logic Fixed APR bằng Vault-backed yield.
> **Verify:** `npx hardhat compile` sạch, không warning.
> **Thứ tự:** Từ trên xuống dưới, KHÔNG skip step.

- `[x]` **2.1** Cập nhật imports và state variables
  - Rename contract: `WalletStaking` → `StakingStrategyController`
  - Bỏ: `rewardToken`, `rewardPoolBalance`, `totalRewardClaimed`
  - Thêm: `IDefiVault private immutable _vault`, `totalHarvested`, `totalDeployedToVault`, `totalPenalties`
  - Giữ: `stakingToken`, `totalStaked`, `pools`, `userStakes`, `userStakeCount`

- `[x]` **2.2** Cập nhật `StakeInfo` struct
  - Bỏ: `amount`, `lastClaimAt`, `pendingReward`
  - Thêm: `shares` (Vault shares), `assetsAtStake` (snapshot lúc stake)
  - Giữ: `poolId`, `stakedAt`, `isActive`

- `[x]` **2.3** Cập nhật Constructor
  - Nhận thêm param `address vaultAddress_`
  - Validate: `vault.asset() == _stakingToken` (revert `TokenMismatch` nếu không khớp)
  - Bỏ params: `_rewardToken`

- `[x]` **2.4** Refactor `stake(poolId, amount)`
  - `transferFrom(user → Strategy)` → `forceApprove(vault, amount)` → `shares = _vault.deposit(amount)`
  - Lưu `assetsAtStake = amount`, `shares = sharesReceived`
  - Emit `Staked` + `VaultDeposited`

- `[x]` **2.5** Refactor `unstake(stakeId)`
  - Guard: `stake_.isActive`, check lock
  - **CEI:** Cập nhật state TRƯỚC — set `isActive = false`, cập nhật counters
  - `assetsReturned = _vault.redeem(shares)`
  - Tính penalty raw + cap theo assetsReturned
  - Track `totalPenalties`, emit `PenaltyCollected`, `YieldGenerated`, `VaultRedeemed`, `Unstaked`

- `[x]` **2.6** Refactor `emergencyWithdraw(stakeId)`
  - Không check whenNotPaused (emergency)
  - **CEI:** Cập nhật state trước
  - `_vault.redeem(shares)` → nhận assets → áp penalty đầy đủ
  - Emit `PenaltyCollected`, `EmergencyWithdrawn`

- `[x]` **2.7** Thêm `harvest(uint256 rewardAmount)` [NEW]
  - Guard: `onlyOwner`, `nonReentrant`, `rewardAmount > 0`
  - `transferFrom(owner → Strategy, rewardAmount)`
  - `stakingToken.safeTransfer(address(_vault), rewardAmount)` — KHÔNG gọi `_vault.deposit()`
  - `totalHarvested += rewardAmount`, emit `Harvested`

- `[x]` **2.8** Xóa các hàm không còn dùng
  - Xóa: `depositReward()`, `claimReward()`, `_calculateReward()`
  - Xóa: `rewardPoolBalance` references

- `[x]` **2.9** Thêm view functions mới
  - `getPendingYield(address, uint256) → uint256`
  - `getStakeValue(address, uint256) → uint256`
  - `totalVaultAssets() → uint256`

- `[x]` **2.10** Cập nhật Events & Errors
  - Thêm Events: `VaultDeposited`, `VaultRedeemed`, `Harvested`, `YieldGenerated`, `PenaltyCollected`
  - Thêm Errors: `HarvestAmountZero`, `TokenMismatch`
  - Xóa: `RewardDeposited`, `InsufficientRewardPool`, `TransferFailed`, `StillLocked`

- `[x]` **2.11** `npx hardhat compile` — ✅ PASS (Compiled 2 Solidity files successfully)

---

## Phase 3: Unit Tests — Strategy Controller
> **Mục tiêu:** Test Staking.sol (Strategy) độc lập với MockVault.
> **Verify:** `npx hardhat test test/StrategyController.Unit.test.ts` — tất cả PASS.

- `[x]` **3.1** Tạo `blockchain/test/shared/Strategy.fixture.ts`
  - `deployStrategyFixture()`: Token + DefiVault + StakingStrategyController + helpers `stakeAs()` / `mineBlock()`

- `[x]` **3.2** Tạo `blockchain/test/StrategyController.Unit.test.ts`

  **Group: Deployment** (4 tests) ✅
  **Group: `stake()`** (9 tests) ✅
  **Group: `unstake()`** (8 tests) ✅
  **Group: `harvest()`** (6 tests) ✅
  **Group: `emergencyWithdraw()`** (4 tests) ✅
  **Group: View Functions** (7 tests) ✅
  **Group: Admin** (3 tests) ✅

- `[x]` **3.3** Run tests: `npx hardhat test test/StrategyController.Unit.test.ts`
  - ✅ **41 passing (4s)** — 100% PASS

---

## Phase 4: Integration & Security Tests
> **Mục tiêu:** Test end-to-end Vault ↔ Strategy và các attack vectors.
> **Verify:** Tất cả test PASS, coverage > 90%.

- `[x]` **4.1** Tạo `blockchain/test/StrategyVault.Integration.test.ts`

  **Group: Full Lifecycle** (5 tests) ✅
  **Group: Penalty Scenarios** (4 tests) ✅
  **Group: Multi-Pool** (2 tests) ✅
  **Group: Harvest Compounding** (2 tests) ✅
  **Group: Gas Benchmarks NCKH** (6 tests) ✅
  ```
  StakingStrategyController.stake()          gas: 347,064
  StakingStrategyController.unstake() no-yld gas: 117,840
  StakingStrategyController.unstake() w-yld  gas: 119,254
  StakingStrategyController.harvest()        gas:  93,099
  WalletStaking.stake()          (baseline)  gas: 230,963
  WalletStaking.unstake()        (baseline)  gas:  68,856
  ```

- `[x]` **4.2** Tạo `blockchain/test/StrategyVault.Security.test.ts`

  **Group: Reentrancy Guard** (3 tests) ✅
  **Group: Access Control** (4 tests) ✅
  **Group: Arithmetic Safety** (3 tests) ✅
  **Group: Inflation Attack Prevention** (2 tests) ✅
  **Group: Same-Block MEV Protection** (4 tests) ✅ — dùng `evm_setAutomine + populateTransaction`
  **Group: Edge Cases** (7 tests) ✅

- `[x]` **4.3** Run tất cả tests:
  - ✅ **83 passing (2s)** — 100% PASS
  - Unit: 41 | Integration: 19 | Security: 23

- `[x]` **4.4** Chạy coverage:
  ```bash
  npx hardhat coverage
  ```
  - ✅ `Staking.sol`: **96.94% line coverage** — đạt target > 90%

---

## Phase 5: Gas Benchmarking & Static Analysis
> **Mục tiêu:** Thu thập dữ liệu nghiên cứu và đảm bảo không có lỗ hổng bảo mật tĩnh.

- `[x]` **5.1** Chạy gas report:
  ```bash
  REPORT_GAS=true npx hardhat test
  ```
  - ✅ `131 passing`
  - ✅ Gas report captured in `blockchain/plan/phase5_gas_static_report.md`

- `[x]` **5.2** So sánh gas costs:
  - Tạo bảng so sánh: `WalletStaking.sol` (baseline cũ) vs `Staking.sol` (Strategy mới)
  - Dữ liệu này dùng trực tiếp trong báo cáo NCKH (RQ3)
  - ✅ Strategy-Vault vs `WalletStaking` comparison table added to `phase5_gas_static_report.md`

- `[x]` **5.3** Static analysis (nếu có Python/Slither):
  ```bash
  slither blockchain/contracts/Staking.sol
  ```
  - Fix mọi HIGH/MEDIUM severity findings
  - ✅ Hoàn thành: Đã cài đặt và chạy Slither thành công. Không có HIGH/MEDIUM severity findings (các cảnh báo reentrancy đều được bảo vệ bởi `nonReentrant` modifier và là benign).

---

## Phase 6: Deploy Sepolia & Verify
> **Mục tiêu:** Deploy production-ready contracts lên testnet, verify source code.

- `[ ]` **6.1** Tạo/cập nhật Ignition deploy module
  - File: `blockchain/ignition/modules/StrategyVault.ts` [NEW/MODIFY]
  - Thứ tự deploy: `Token` → `DefiVault(token)` → `Staking(token, vault)`

- `[ ]` **6.2** Kiểm tra `.env` có đủ:
  - `PRIVATE_KEY` ✅
  - `RPC_URL` (Sepolia) ✅
  - `ETHERSCAN_API_KEY` ✅

- `[ ]` **6.3** Deploy lên Sepolia:
  ```bash
  npx hardhat ignition deploy ignition/modules/StrategyVault.ts --network sepolia
  ```

- `[ ]` **6.4** Verify source code trên Etherscan:
  ```bash
  npx hardhat ignition deploy ignition/modules/StrategyVault.ts --network sepolia --verify
  ```

- `[ ]` **6.5** Smoke test trên Sepolia:
  - Gọi `stake()` với lượng nhỏ token
  - Gọi `harvest()` inject reward nhỏ
  - Verify `getPendingYield()` trả giá trị > 0
  - Gọi `unstake()`

- `[ ]` **6.6** Cập nhật `blockchain/deployed-addresses.json` với địa chỉ thực

---

## Acceptance Criteria Tổng Thể

| Tiêu chí | Cách verify |
|---|---|
| `npx hardhat compile` không lỗi | CI / local |
| Tất cả unit tests PASS | `npx hardhat test test/StrategyController.Unit.test.ts` |
| Tất cả integration tests PASS | `npx hardhat test test/StrategyVault.Integration.test.ts` |
| Tất cả security tests PASS | `npx hardhat test test/StrategyVault.Security.test.ts` |
| Coverage > 90% cho Staking.sol | `npx hardhat coverage` |
| Gas report hoàn chỉnh | `REPORT_GAS=true npx hardhat test` |
| Contracts deployed + verified Sepolia | Etherscan links |
| `deployed-addresses.json` updated | File check |

---

## Thứ Tự Ưu Tiên (Nếu Thời Gian Giới Hạn)

```
MUST HAVE (Core NCKH):
  Phase 1 → Phase 2 → Phase 3 → Phase 4.1 (Integration) → Phase 6

SHOULD HAVE (NCKH Quality):
  Phase 4.2 (Security) → Phase 5 (Gas benchmark)

NICE TO HAVE:
  Phase 4.4 (Coverage report)
  Slither analysis
```
