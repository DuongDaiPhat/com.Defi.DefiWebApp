# Strategy-Based Vault: Refactor Staking.sol → Strategy Controller

> **Mục tiêu:** Kết nối `Staking.sol` với `DefiVault.sol` (ERC4626) theo kiến trúc Strategy-Vault (Yearn V2/V3 style) để tạo ra yield động thay vì Fixed APR, phục vụ đề tài NCKH.
> **Testnet:** Ethereum Sepolia

---

## User Review Required

> [!IMPORTANT]
> **Breaking Change:** `Staking.sol` hiện tại sẽ được refactor **đáng kể**. Luồng stake cũ (user stake → token nằm trong contract) sẽ thay đổi thành (user stake → Staking.sol deposit vào DefiVault → Staking.sol lưu Shares). Cần xác nhận không có user nào đang active trước khi migrate.

> [!WARNING]
> **Quyết định thiết kế:** Kế hoạch này sẽ refactor `Staking.sol` thành Strategy Controller. File `WalletStaking.sol` sẽ được giữ lại nguyên vẹn **không chỉnh sửa** để làm baseline so sánh cho nghiên cứu sau này.

> [!IMPORTANT]
> **Yield Source:** Hiện tại `DefiVault.totalAssets()` = token balance của vault. Yield thực sự chỉ tăng khi Vault nhận thêm underlying asset **mà không mint thêm shares**. Vì vậy `harvest()` KHÔNG được gọi `DefiVault.deposit(reward)`: `deposit()` sẽ mint shares cho `Staking.sol`, làm reward thành shares không map cho user và không tăng price-per-share đúng nghĩa. Plan này dùng **mock realized gain**: owner/keeper chuyển reward token vào `Staking.sol`, sau đó `Staking.sol` chuyển thẳng underlying asset vào Vault bằng `safeTransfer(address(vault), rewardAmount)` để tăng `totalAssets` mà không tăng `totalSupply`.

---

## Open Questions

> [!IMPORTANT]
> 1. `stakingToken` và `DefiVault.asset()` có phải là **cùng một token** không? (Theo kiến trúc đề xuất: YES — user stake token vào Staking.sol, Staking.sol deposit cùng token đó vào Vault.)
> 2. Penalty khi rút sớm áp dụng trên **principal snapshot** (`assetsAtStake`) để giữ hành vi gần với staking cũ, nhưng phải cap theo `assetsReturned` để không underflow khi Vault bị loss/rounding.
> 3. `harvest()` được gọi bởi ai? Plan này thiết kế là `onlyOwner` (Keeper role), nhưng có thể mở thành public nếu muốn incentive harvester.

---

## Gap Analysis (Hiện trạng vs Cần thiết)

| Hạng mục | Hiện tại | Cần thiết |
|---|---|---|
| Token flow khi stake | User → Staking.sol (giữ token) | User → Staking.sol → **DefiVault** (nhận Shares) |
| Lưu trữ stake position | `amount` (raw token) | `shares` (Vault shares đại diện cho token + yield) |
| Yield mechanism | Fixed APR tính off-chain | Dynamic yield từ Vault's `pricePerShare` |
| Harvest/Compound | Không có | `harvest()` inject reward vào Vault |
| Interface cho Strategy | Không có | `IStrategy.sol` để Vault nhận dạng Strategy |
| Kết nối Vault | Không có | `vaultAddress` + `IERC4626` calls |
| Test integration | Chỉ có unit test riêng lẻ | Integration test Vault ↔ Strategy end-to-end |

---

## Kiến Trúc Mới

```
User
 ├─► Staking.stake(poolId, amount)
 │       └─► token.transferFrom(user → Staking)
 │       └─► vault.deposit(amount) → nhận shares
 │       └─► lưu StakeInfo { shares, poolId, stakedAt }
 │
 ├─► Staking.unstake(stakeId)
 │       └─► vault.redeem(shares) → nhận assets (gốc + yield)
 │       └─► tính yield = assets - originalAmount
 │       └─► áp penalty nếu còn lock
 │       └─► trả assets về User
 │
 └─► Staking.harvest() [onlyOwner/Keeper]
         └─► inject reward token vào Vault
         └─► transfer rewardAmount trực tiếp vào Vault (không mint shares)
         └─► totalAssets tăng, totalSupply không đổi → pricePerShare tăng cho mọi staker
```

---

## Proposed Changes

### Phase 1: Contracts

---

#### [NEW] `blockchain/contracts/interfaces/IStrategy.sol`
Interface chuẩn để Vault nhận dạng Strategy. Định nghĩa:
- `vault()` — địa chỉ Vault kết nối
- `totalDeployed()` — tổng assets đang deploy vào Vault
- `harvest()` — trigger thu yield và tái đầu tư

---

#### [MODIFY] `blockchain/contracts/Staking.sol` → **Strategy Controller**

> [!IMPORTANT]
> `Staking.sol` hiện đang khai báo `contract WalletStaking`, trùng tên với `WalletStaking.sol`. Khi refactor, phải rename contract trong `Staking.sol` thành `StakingStrategyController` hoặc `Staking` để tránh artifact ambiguity. Không chỉnh sửa `WalletStaking.sol`.

**Thay đổi State:**
```diff
- IERC20 public immutable stakingToken;
- IERC20 public immutable rewardToken;
- uint256 public rewardPoolBalance;
+ IERC20  public immutable stakingToken;    // == vault.asset()
+ IDefiVault public immutable vault;         // ERC4626 Vault
+ uint256 public totalDeployedToVault;       // tracking principal only, not financial source of truth
+ uint256 public totalHarvested;             // tracking realized gains donated to Vault
+ uint256 public totalPenalties;             // tracking penalties retained in Strategy/protocol reserve
```

**Thay đổi StakeInfo struct:**
```diff
  struct StakeInfo {
    uint256 poolId;
-   uint256 amount;       // raw token amount
+   uint256 shares;       // vault shares (đại diện yield)
+   uint256 assetsAtStake; // amount gốc lúc stake (để tính yield delta)
    uint256 stakedAt;
-   uint256 lastClaimAt;
-   uint256 pendingReward;
    bool    isActive;
  }
```

**Thay đổi `stake()`:**
```solidity
// Thêm bước: approve + deposit vào Vault
stakingToken.safeTransferFrom(msg.sender, address(this), amount);
stakingToken.forceApprove(address(vault), amount);
uint256 sharesReceived = vault.deposit(amount);
// Lưu shares thay vì amount
userStakes[msg.sender][stakeId] = StakeInfo({
    poolId: poolId,
    shares: sharesReceived,
    assetsAtStake: amount,
    stakedAt: block.timestamp,
    isActive: true
});
```

**Thay đổi `unstake()`:**
```solidity
// Cache values trước khi cập nhật state
uint256 sharesToRedeem = stake_.shares;
uint256 principal = stake_.assetsAtStake;

// CEI: update state trước external call
stake_.isActive = false;
stake_.shares = 0;
stake_.assetsAtStake = 0;
pool.totalStaked -= principal;
totalStaked -= principal;
totalDeployedToVault -= principal;

// Redeem từ Vault sau khi state đã được đóng
uint256 assetsReturned = vault.redeem(sharesToRedeem);
uint256 yield = assetsReturned > principal ? assetsReturned - principal : 0;
// Penalty tính trên principal snapshot, nhưng cap theo assetsReturned để không underflow nếu Vault loss
uint256 rawPenalty = isEarlyWithdraw
    ? (principal * pool.penaltyRate) / BASIS_POINTS : 0;
uint256 penalty = rawPenalty > assetsReturned ? assetsReturned : rawPenalty;
totalPenalties += penalty;
uint256 toReturn = assetsReturned - penalty;
stakingToken.safeTransfer(msg.sender, toReturn);
```

**Thêm `harvest()`:**
```solidity
function harvest(uint256 rewardAmount) external onlyOwner {
    // Owner inject reward vào contract
    stakingToken.safeTransferFrom(msg.sender, address(this), rewardAmount);
    // Donate realized gain vào Vault: tăng totalAssets nhưng KHÔNG mint shares
    stakingToken.safeTransfer(address(vault), rewardAmount);
    totalHarvested += rewardAmount;
    emit Harvested(rewardAmount);
}
```

> [!IMPORTANT]
> Không dùng `vault.deposit(rewardAmount)` trong `harvest()`. Với ERC4626 hiện tại, `deposit()` sẽ mint thêm shares cho `Staking.sol`; các shares này không thuộc position nào và làm sai accounting. Harvest/yield demo phải là donation/realized gain hoặc một strategy thật tạo profit làm Vault tăng asset balance mà không tăng share supply.

**Thêm Events mới:**
```solidity
event VaultDeposited(address indexed user, uint256 stakeId, uint256 assets, uint256 shares);
event VaultRedeemed(address indexed user, uint256 stakeId, uint256 shares, uint256 assets);
event Harvested(uint256 rewardAmount);
event YieldGenerated(address indexed user, uint256 stakeId, uint256 yield);
event PenaltyCollected(address indexed user, uint256 stakeId, uint256 penalty);
```

**Thêm Errors mới:**
```solidity
error VaultDepositFailed();
error VaultRedeemFailed();
error InsufficientVaultShares();
error HarvestAmountZero();
```

---

#### [NO MODIFY] `blockchain/contracts/DefiVault.sol`
Plan này **không chỉnh sửa `DefiVault.sol`**. `Staking.sol` sẽ giữ toàn bộ Vault shares và map shares theo từng user position. Cách này giữ Vault vault-agnostic, không thêm `depositFor()`/`redeemFrom()`, không phá bề mặt ERC4626 hiện tại.

> [!WARNING]
> Same-block withdrawal guard trong Vault đang theo `msg.sender`. Vì mọi `stake()` đều gọi `vault.deposit()` với `msg.sender = address(Staking.sol)`, một user stake có thể khiến mọi `unstake()` qua Strategy trong cùng block bị revert. `harvest()` theo plan này chỉ ERC20-transfer trực tiếp vào Vault nên không cập nhật `_lastDepositBlock`, nhưng nó vẫn có thể thay đổi pricePerShare ngay trước redeem. Không sửa Vault trong plan này, nên test và UI/backend phải xử lý stake/unstake same-block bằng cách mine/chờ block kế tiếp hoặc retry. Nếu sau này muốn bỏ rủi ro UX này thì tạo plan riêng để thêm whitelist Strategy trong Vault.

---

### Phase 2: Tests

---

#### [NEW] `blockchain/test/StrategyController.Unit.test.ts`
**Unit tests cho Staking.sol (Strategy Controller) riêng lẻ, mock Vault:**

```typescript
describe("StrategyController Unit Tests", () => {
  // Setup: deploy MockVault, Token, Staking
  
  describe("stake()", () => {
    it("deposits assets into Vault on stake");
    it("records shares (not raw amount) in StakeInfo");
    it("reverts on pool not found");
    it("reverts on pool inactive");
    it("reverts on amount < minStake");
    it("reverts on amount > maxStake");
    it("emits Staked + VaultDeposited events");
  });
  
  describe("unstake()", () => {
    it("redeems shares from Vault on unstake");
    it("returns correct assets when no yield");
    it("returns principal + yield when vault grew");
    it("applies penalty on early withdraw (cuts from principal)");
    it("does NOT apply penalty after lockDuration");
    it("emits Unstaked + VaultRedeemed + YieldGenerated events");
  });
  
  describe("harvest()", () => {
    it("donates reward into Vault without minting new shares");
    it("increases pricePerShare of Vault");
    it("only callable by owner");
    it("reverts on zero amount");
    it("emits Harvested event");
  });
  
  describe("emergencyWithdraw()", () => {
    it("redeems from Vault and returns assets with max penalty");
    it("bypasses pause state");
  });
  
  describe("view functions", () => {
    it("getPendingYield() returns correct vault growth since stake");
    it("getStakeValue() returns current assets value of shares");
  });
});
```

---

#### [NEW] `blockchain/test/StrategyVault.Integration.test.ts`
**Integration tests: Vault ↔ Strategy end-to-end:**

```typescript
describe("Strategy-Vault Integration Tests", () => {
  // Deploy: Token, DefiVault, Staking(Strategy)
  // Fixtures: alice, bob, keeper (owner)
  
  describe("Full Lifecycle: Stake → Harvest → Unstake", () => {
    it("alice stakes 100 STK, vault receives 100 STK");
    it("keeper harvests 10 STK reward as direct Vault donation → pricePerShare tăng");
    it("alice unstakes → nhận ~110 STK (gốc + yield)");
    it("bob stakes sau harvest → nhận ít shares hơn alice per STK");
    it("multiple users stake: each benefits proportionally from harvest");
  });
  
  describe("Penalty Scenarios", () => {
    it("early unstake with penalty: user nhận (principal - penalty)");
    it("penalty tính từ principal snapshot và được cap bởi assetsReturned");
    it("full lock completion: unstake nhận full assets (gốc + yield)");
  });
  
  describe("Multi-Pool Strategy", () => {
    it("alice dùng pool 0 (flexible), bob dùng pool 3 (Gold): cả 2 benefit từ harvest");
    it("totalDeployedToVault = sum principal đang active, không bao gồm harvested donation");
    it("vault.totalAssets() >= totalDeployedToVault sau harvest");
  });
  
  describe("Harvest Compounding", () => {
    it("2 lần harvest: pricePerShare tăng đơn điệu");
    it("pricePerShare sau harvest 1 < pricePerShare sau harvest 2");
  });
  
  describe("Emergency & Pause Scenarios", () => {
    it("pause vault: stake reverts (vault paused)");
    it("pause strategy: stake + unstake revert");
    it("emergencyWithdraw bypasses Strategy pause when Vault is unpaused");
  });
  
  describe("Gas Benchmarks (for NCKH)", () => {
    it("log gas cost: stake()");
    it("log gas cost: unstake() no yield");
    it("log gas cost: unstake() with yield");
    it("log gas cost: harvest()");
    it("compare vs WalletStaking.sol (baseline) gas costs");
  });
});
```

---

#### [NEW] `blockchain/test/StrategyVault.Security.test.ts`
**Security-focused tests:**

```typescript
describe("Security Tests — Strategy-Vault", () => {
  describe("Reentrancy", () => {
    it("stake() với malicious ERC20 (callback): nonReentrant chặn");
    it("unstake() với malicious ERC20 (callback): nonReentrant chặn");
    it("harvest() không thể bị re-entrant do onlyOwner");
  });
  
  describe("Access Control", () => {
    it("harvest(): non-owner reverts với OwnableUnauthorizedAccount");
    it("addPool(): non-owner reverts");
    it("updatePool(): non-owner reverts");
  });
  
  describe("Arithmetic Safety", () => {
    it("yield calculation không overflow với maxUint stake");
    it("penalty calculation không underflow (penalty <= amount)");
    it("shares→assets rounding không trả về nhiều hơn deposited");
  });
  
  describe("Inflation Attack (via Vault)", () => {
    it("Vault Virtual Shares offset (10^18) chống inflation attack");
    it("attacker donate token vào vault: pricePerShare tăng nhưng staker mới không bị harm");
  });
  
  describe("Same-Block MEV", () => {
    it("stake + unstake trong cùng block: SameBlockWithdrawal revert");
    it("user A stake làm user B unstake cùng block revert vì Strategy là msg.sender chung");
    it("harvest cùng block không trigger SameBlockWithdrawal nhưng redeem value dùng PPS mới");
  });
  
  describe("Vault Insolvency", () => {
    it("nếu vault.redeem() trả về ít hơn expected: strategy xử lý gracefully");
    it("penalty được cap để unstake không underflow khi vault bị loss");
    it("totalDeployedToVault không vượt vault.maxWithdraw()");
  });
});
```

---

## Security Notes & Audit Checklist

> [!CAUTION]
> **Critical: CEI Pattern trong Strategy Controller**
> Khi `unstake()` gọi `vault.redeem()`, đây là **external call**. PHẢI cập nhật tất cả state (stake_.isActive = false, pool.totalStaked, totalDeployed) **TRƯỚC** khi gọi vault.redeem(). Nếu không → reentrancy vector.

> [!CAUTION]
> **Critical: Approval Management**
> Strategy chỉ cần allowance khi `stake()` gọi `vault.deposit(amount)`. Dùng `SafeERC20.forceApprove(address(vault), amount)` với OpenZeppelin v5 hoặc reset allowance về 0 rồi set amount nếu dùng helper khác. `harvest()` không cần approve vì nó chuyển token trực tiếp vào Vault bằng `safeTransfer`.

> [!WARNING]
> **Shares vs Amount Accounting**
> `StakeInfo.assetsAtStake` phải lưu chính xác số assets đã deposit vào Vault (không phải số user chuyển, vì có thể có fee). Dùng `previewDeposit()` để tính trước, hoặc so sánh `totalAssets()` before/after.

> [!WARNING]
> **Harvest / Same-Block Race Condition**
> `harvest()` chuyển token trực tiếp vào Vault nên pricePerShare có thể thay đổi ngay trước khi `unstake()`. Vault same-block guard theo `msg.sender = address(Staking.sol)` chỉ bị kích hoạt bởi `stake()`/`vault.deposit()` trong block hiện tại, không phải bởi `harvest()` direct transfer. Cần test rõ cross-user stake/unstake cùng block và UI/backend nên retry ở block kế tiếp.

> [!WARNING]
> **Penalty Calculation Precision**
> `penalty = (assetsAtStake * penaltyRate) / BASIS_POINTS`
> Nếu `assetsAtStake` rất nhỏ và `penaltyRate` nhỏ → penalty = 0 do integer division. Cần test boundary case.

> [!WARNING]
> **Penalty Custody**
> Penalty sau `unstake()` sẽ nằm lại trong `Staking.sol`, không còn nằm trong Vault và không được tính vào `totalDeployedToVault`. Phải track bằng `totalPenalties` + event `PenaltyCollected`; nếu cần rút về treasury thì thêm hàm owner-only riêng và test access control. Không để penalty balance thành token kẹt không có accounting.

> [!NOTE]
> **totalDeployedToVault Drift**
> `totalDeployedToVault` có thể drift so với `vault.convertToAssets(totalShares)` do rounding. KHÔNG dùng nó cho financial calculation — chỉ dùng để tracking/monitoring. Mọi financial calculation phải dùng `vault.previewRedeem(shares)`.

> [!NOTE]
> **Vault Paused State**
> Nếu DefiVault bị pause, `stake()` và `unstake()` trong Strategy sẽ revert (do vault.deposit/redeem revert). Strategy cần handle hoặc propagate error rõ ràng cho user.

> [!NOTE]
> **pricePerShare Manipulation / Donation**
> Ai cũng có thể `transfer` token trực tiếp vào Vault để tăng `totalAssets` và pricePerShare. Đây chính là cơ chế mock yield của plan này, nhưng phải test donation trước/sau khi có staker để tránh assumption sai. Virtual Shares (10^18 offset) giúp giảm inflation attack, không thay thế test accounting end-to-end.

> [!CAUTION]
> **Vault Admin Drain Risk**
> `DefiVault.emergencyWithdraw()` hiện có thể chuyển toàn bộ underlying asset cho owner khi Vault paused. Vì `Staking.sol` giữ shares thay user, đây là rủi ro admin rug/asset loss cần ghi rõ trong báo cáo bảo mật và test vận hành. Trước production thật nên đổi sang multisig/timelock hoặc giới hạn emergency rescue không được rút underlying asset chính.

---

## Verification Plan

### Unit Tests
```bash
cd blockchain
npx hardhat test test/StrategyController.Unit.test.ts
npx hardhat test test/StrategyVault.Integration.test.ts
npx hardhat test test/StrategyVault.Security.test.ts
```

### Coverage
```bash
npx hardhat coverage
# Mục tiêu: line coverage > 90% cho Staking.sol mới
```

### Static Analysis
```bash
# Cài slither (Python):
pip install slither-analyzer
slither blockchain/contracts/Staking.sol --solc-remaps "@openzeppelin=blockchain/node_modules/@openzeppelin"
```

### Gas Report
```bash
# Thêm hardhat-gas-reporter vào config
npx hardhat test --reporter gas
# So sánh: old WalletStaking.sol (baseline) vs new Staking.sol (Strategy)
```

### Deploy Sepolia
```bash
npx hardhat ignition deploy ignition/modules/StrategyVault.ts --network sepolia --verify
```

---

## Task Breakdown (Thứ Tự Thực Hiện)

### Phase 1: Interface & Foundation
- `[ ]` Tạo `IStrategy.sol` interface
- `[ ]` Kiểm tra `IDefiVault.sol` có đủ hàm cần dùng (deposit, redeem, previewRedeem)
- `[ ]` Đảm bảo `WalletStaking.sol` được bảo tồn nguyên vẹn làm baseline

### Phase 2: Refactor Staking.sol
- `[ ]` Cập nhật state variables (thay rewardToken → vault)
- `[ ]` Cập nhật `StakeInfo` struct (shares + assetsAtStake)
- `[ ]` Refactor `stake()` — deposit vào Vault
- `[ ]` Refactor `unstake()` — redeem từ Vault, tính yield
- `[ ]` Refactor `emergencyWithdraw()` — redeem từ Vault với max penalty
- `[ ]` Thêm `harvest()` function — direct donation vào Vault, không gọi `vault.deposit()`
- `[ ]` Thêm `getPendingYield()` và `getStakeValue()` view functions
- `[ ]` Thêm Events và Errors mới
- `[ ]` Xóa `depositReward()`, `rewardPoolBalance`, `claimReward()` (replaced by harvest)
- `[ ]` Xóa `_calculateReward()` (APR-based — replaced by vault yield)

### Phase 3: Unit Tests
- `[ ]` Viết `StrategyController.Unit.test.ts` với MockVault
- `[ ]` Run & pass tất cả unit tests

### Phase 4: Integration Tests
- `[ ]` Viết `StrategyVault.Integration.test.ts` (full stack)
- `[ ]` Viết `StrategyVault.Security.test.ts`
- `[ ]` Run & pass tất cả integration tests
- `[ ]` Chạy coverage — đạt > 90%

### Phase 5: Gas Benchmarking
- `[x]` Cấu hình hardhat-gas-reporter
- `[x]` Ghi lại gas costs cho mọi public function
- `[x]` So sánh với `WalletStaking.sol` (baseline)
- `[x]` Static analysis bằng Slither

### Phase 6: Deploy Sepolia
- `[ ]` Tạo/cập nhật Ignition module cho StrategyVault
- `[ ]` Deploy Token → DefiVault → Staking.sol (Strategy)
- `[ ]` Verify contracts trên Etherscan
- `[ ]` Chạy smoke test trên Sepolia
- `[ ]` Cập nhật `deployed-addresses.json`
