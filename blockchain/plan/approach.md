# Approach Analysis — Strategy-Based Vault

> **Vấn đề cần giải quyết:** Làm thế nào để kết nối `Staking.sol` (Strategy) với `DefiVault` (ERC4626) một cách an toàn, chính xác về kế toán, và có giá trị nghiên cứu cao?

---

## Approach 1: Minimal Wrapper (Strategy giữ Shares, Map cho User)

**Mô tả:** `Staking.sol` giữ toàn bộ Vault shares. Khi user stake, Strategy deposit vào Vault và lưu `shares` trả về. Khi unstake, Strategy redeem shares và tính lợi nhuận theo chênh lệch giá trị.

```
User stake 100 STK
    → Strategy.stake()
    → vault.deposit(100) = 95 shares (ví dụ pricePerShare=1.05)
    → StakeInfo { shares: 95, assetsAtStake: 100 }

[Sau harvest/direct donation: pricePerShare = 1.10]

User unstake
    → vault.redeem(95 shares) = 104.5 STK
    → yield = 104.5 - 100 = 4.5 STK
    → trả user: 104.5 STK (hoặc - penalty nếu còn lock)
```

**Ưu điểm:**
- ✅ Đơn giản nhất — Strategy không cần biết Vault internals
- ✅ Vault hoàn toàn vault-agnostic (không cần modify)
- ✅ Accounting tự động — Vault tính pricePerShare, Strategy chỉ dùng kết quả
- ✅ Phù hợp với Yearn V2 BaseStrategy pattern
- ✅ Gas hiệu quả (1 SSTORE cho shares thay vì theo dõi nhiều biến)

**Nhược điểm:**
- ⚠️ `assetsAtStake` cần lưu chính xác (không thể dùng `amount` từ user vì có thể có slippage)
- ⚠️ Nếu Vault bị drain (attack), Strategy không có fallback

**Risk:** LOW — Đây là pattern đã được kiểm chứng (Yearn, Beefy, etc.)

**→ ĐÂY LÀ APPROACH ĐƯỢC CHỌN**

---

## Approach 2: Dual Accounting (Strategy tự tính APR + tính yield từ Vault)

**Mô tả:** Strategy giữ cả hai hệ thống: Fixed APR cũ và Vault yield. User nhận max(APR_reward, vault_yield). Phức tạp hơn nhưng backward compatible.

```
StakeInfo {
    amount: 100,       // cho APR calculation
    shares: 95,        // cho vault yield
    lastClaimAt: t0,
    pendingAprReward: X
}

unstake():
    aprReward = calculateAPR(amount, duration)
    vaultYield = vault.redeem(shares) - amount
    reward = max(aprReward, vaultYield)  // hoặc sum
```

**Ưu điểm:**
- ✅ Backward compatible — người dùng cũ không bị break
- ✅ Có thể compare hai cơ chế yield (giá trị nghiên cứu)
- ✅ Có safety net nếu Vault underperform

**Nhược điểm:**
- ❌ Cực kỳ phức tạp — Double source of truth
- ❌ Khó audit — logic phân nhánh nhiều
- ❌ Có thể tạo ra arbitrage: user chọn APR hay Vault tùy lợi ích
- ❌ Không thể hiện kiến trúc Strategy-Vault thuần túy (giảm giá trị NCKH)
- ❌ Cần vẫn phải duy trì `rewardPoolBalance` — không đơn giản hóa được

**Risk:** HIGH — Double accounting dễ dẫn đến bugs

---

## Approach 3: Full Delegation (Vault quản lý Strategy via Whitelist)

**Mô tả:** Modify `DefiVault` để hỗ trợ "authorized strategy" role. Strategy gọi `vault.depositFor(user, amount)` để mint shares trực tiếp cho user. User tự giữ shares, Strategy chỉ là gateway.

```
User stake 100 STK
    → Strategy.stake()
    → vault.depositFor(user, 100) → mint shares cho USER (không phải Strategy)
    → StakeInfo { poolId, stakedAt, userSharesBefore }
    
User unstake
    → user.approve(Strategy, shares)  ← YÊU CẦU THÊM bước này từ user
    → vault.redeemFrom(user, shares)
    → trả assets - penalty về user
```

**Ưu điểm:**
- ✅ Shares thuộc về user trực tiếp — transparent hơn
- ✅ User có thể transfer/sell shares trên DEX (nếu muốn)

**Nhược điểm:**
- ❌ Cần **modify DefiVault** thêm `depositFor()`, `redeemFrom()` — phá vỡ ERC4626 standard
- ❌ User phải approve Strategy 2 lần (token + shares) — UX phức tạp hơn
- ❌ Strategy mất khả năng kiểm soát flow (không thể enforce lock/penalty)
- ❌ Không thể implement early withdrawal penalty một cách atomic
- ❌ Giảm tính composability — Vault không còn ERC4626 thuần

**Risk:** CRITICAL — Phá vỡ ERC4626 interface, tăng attack surface

---

## So Sánh

| Tiêu Chí | Approach 1 ✅ | Approach 2 | Approach 3 |
|---|---|---|---|
| **Độ phức tạp implement** | Thấp | Cao | Trung bình |
| **Giá trị NCKH** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **An toàn bảo mật** | Cao | Trung bình | Thấp |
| **Cần modify Vault** | ❌ Không | ❌ Không | ✅ Có |
| **Backward compatible** | ❌ Không | ✅ Có | ❌ Không |
| **Gas efficiency** | Tốt | Kém (double storage) | Trung bình |
| **Testability** | Dễ | Khó | Trung bình |
| **Chuẩn ngành** | ✅ Yearn pattern | ❌ Custom | ❌ Non-standard |

---

## Quyết Định: Approach 1

**Lý do chọn Approach 1:**

1. **Giá trị NCKH cao nhất** — Thể hiện đúng kiến trúc Strategy-Vault như Yearn V2, benchmark được với protocol thực.
2. **Vault vault-agnostic** — DefiVault không cần thay đổi, đây là tính chất quan trọng của ERC4626 composability.
3. **Accounting sạch** — Không có double source of truth, không có ambiguity.
4. **Security tốt nhất** — Ít moving parts, ít attack surface.
5. **Testability** — MockVault đủ để unit test Strategy mà không phụ thuộc Vault thực.

---

## Chi Tiết Thiết Kế: Approach 1

### Thiết Kế StakeInfo Mới

```solidity
struct StakeInfo {
    uint256 poolId;
    uint256 shares;          // Vault shares Strategy đang giữ cho user này
    uint256 assetsAtStake;   // Số assets đã deposit vào Vault lúc stake
                             // (dùng để tính yield delta, NOT cho tính toán tiền)
    uint256 stakedAt;        // Timestamp stake (dùng cho lockDuration check)
    bool    isActive;
}
```

> [!NOTE]
> `assetsAtStake` chỉ dùng để **hiển thị yield** cho user trên UI (`getPendingYield()`).
> Mọi tính toán tài chính thực tế đều dùng `vault.previewRedeem(shares)` — không bao giờ dùng `assetsAtStake` để tính tiền trả về.

### Thiết Kế harvest()

```solidity
/**
 * @notice Keeper/Admin inject reward như realized gain, tăng totalAssets của Vault
 * @dev    Không gọi vault.deposit(): deposit sẽ mint shares mới và không tăng PPS đúng nghĩa
 * @param  rewardAmount Số assets để inject vào Vault
 */
function harvest(uint256 rewardAmount) external onlyOwner nonReentrant {
    if (rewardAmount == 0) revert HarvestAmountZero();
    
    stakingToken.safeTransferFrom(msg.sender, address(this), rewardAmount);
    stakingToken.safeTransfer(address(vault), rewardAmount);
    
    totalHarvested += rewardAmount;
    emit Harvested(rewardAmount);
}
```

> [!NOTE]
> Harvest **không mint shares**. Reward được chuyển trực tiếp vào Vault như profit/donation, làm `totalAssets` tăng trong khi `totalSupply` không đổi; vì vậy các shares đã được map cho user tự động có giá trị cao hơn. Nếu dùng `vault.deposit(rewardAmount)`, Vault sẽ mint shares mới cho `Staking.sol`, làm sai accounting vì shares đó không gắn với user position nào.

### Thiết Kế getPendingYield()

```solidity
/**
 * @notice Tính yield ước tính (chưa thực hiện) của một stake position
 * @dev    Returns 0 nếu vault chưa có yield hoặc yield âm
 */
function getPendingYield(address user, uint256 stakeId) 
    external view returns (uint256 yield) 
{
    StakeInfo storage s = userStakes[user][stakeId];
    if (!s.isActive) return 0;
    
    uint256 currentValue = vault.previewRedeem(s.shares);
    if (currentValue <= s.assetsAtStake) return 0;
    return currentValue - s.assetsAtStake;
}
```

### Thiết Kế getStakeValue()

```solidity
/**
 * @notice Giá trị thị trường hiện tại (assets) của một stake position
 */
function getStakeValue(address user, uint256 stakeId) 
    external view returns (uint256) 
{
    StakeInfo storage s = userStakes[user][stakeId];
    if (!s.isActive) return 0;
    return vault.previewRedeem(s.shares);
}
```

### Constructor Mới

```solidity
constructor(
    address _stakingToken,
    address _vault           // IDefiVault address
) Ownable(msg.sender) {
    require(_stakingToken != address(0), "zero staking token");
    require(_vault != address(0), "zero vault");
    
    stakingToken = IERC20(_stakingToken);
    vault = IDefiVault(_vault);
    
    // CRITICAL: stakingToken phải == vault.asset()
    require(
        vault.asset() == _stakingToken,
        "Staking.sol: token mismatch with vault asset"
    );
}
```

### Approval Strategy

Dùng `SafeERC20.forceApprove(address(vault), amount)` cho `stake()` trước khi gọi `vault.deposit(amount)`, thay vì:
- `approve()` — không an toàn với non-standard ERC20
- `increaseAllowance()` — đã deprecated trong OpenZeppelin v5

Lý do: `forceApprove()` = set về 0 trước, rồi set lên amount. An toàn và tương thích.

`harvest()` không cần approve vì không gọi `vault.deposit()`: nó chuyển reward trực tiếp vào Vault bằng `safeTransfer(address(vault), rewardAmount)`.

### Same-Block Guard Constraint

`DefiVault` đang chặn redeem cùng block theo `_lastDepositBlock[msg.sender]`. Trong kiến trúc này, `msg.sender` khi gọi `vault.deposit()` luôn là `address(Staking.sol)`, nên một user stake có thể làm mọi user khác không unstake được trong cùng block. `harvest()` direct transfer không gọi `vault.deposit()` nên không kích hoạt guard này, nhưng vẫn làm PPS thay đổi ngay trước redeem. Plan này không sửa `DefiVault.sol`; test phải cover cross-user stake/unstake same-block revert và UI/backend nên retry ở block kế tiếp.

### Vault Admin Risk

`DefiVault.emergencyWithdraw()` hiện cho owner rút toàn bộ underlying asset khi Vault paused. Đây là rủi ro admin drain cần đưa vào phần security analysis. Nếu triển khai production thật, nên dùng multisig/timelock hoặc refactor Vault để chỉ rescue non-underlying tokens.

### Penalty Custody

Penalty sau khi user rút sớm được giữ trong `Staking.sol` như protocol reserve, không redeposit vào Vault tự động và không tính vào `totalDeployedToVault`. Contract mới cần track `totalPenalties` và emit `PenaltyCollected`; nếu muốn chuyển về treasury thì thêm hàm owner-only riêng, có test access control và event rõ ràng.

---

## Cấu Trúc File Cuối Cùng

### Contracts Mới/Modified
```
contracts/
├── interfaces/
│   ├── IDefiVault.sol     ✅ Giữ nguyên
│   └── IStrategy.sol      🆕 Tạo mới
├── DefiVault.sol          ✅ Giữ nguyên (KHÔNG modify)
├── WalletStaking.sol      ✅ Giữ nguyên (Baseline)
├── Staking.sol            🔨 Refactor hoàn toàn → Strategy Controller
├── SimpleAMM.sol          ✅ Giữ nguyên
└── Token.sol              ✅ Giữ nguyên
```

### Tests Mới
```
test/
├── StrategyController.Unit.test.ts      🆕 Unit test Strategy (MockVault)
├── StrategyVault.Integration.test.ts    🆕 Integration test (full stack)
├── StrategyVault.Security.test.ts       🆕 Security + reentrancy tests
├── shared/
│   └── fixtures.ts                      🆕 Shared test fixtures
├── DefiVault.Core.test.ts               ✅ Giữ nguyên
├── DefiVault.ERC4626.test.ts            ✅ Giữ nguyên
├── DefiVault.EdgeCases.test.ts          ✅ Giữ nguyên
├── DefiVault.Security.test.ts           ✅ Giữ nguyên
├── SimpleAMM.test.ts                    ✅ Giữ nguyên
└── DefiStaking.test.ts                  🗑️  Thay thế bởi test mới
```
