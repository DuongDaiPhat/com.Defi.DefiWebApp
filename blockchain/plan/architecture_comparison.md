# Phân Tích Kiến Trúc Kết Hợp: Staking + ERC4626 Vault
> **Đề tài:** Nghiên cứu các giao thức DeFi trên Blockchain và phát triển ứng dụng WebDefi  
> **Thử nghiệm trên:** Ethereum Sepolia

---

## 1. Phân Tích 2 Pattern Phổ Biến

### Pattern 1: Staking-Inside-Vault (Nội Bộ)

**Mô tả:** Vault (ERC4626) tích hợp thêm logic staking bên trong. User chỉ gọi `deposit()`, Vault tự động stake số assets đó vào một giao thức bên trong.

```
User
 └─► Vault.deposit(assets) ──► [Staking Logic bên trong Vault]
                                       │
                    Shares ◄───────────┘  (ERC4626 shares đại diện cho stake position)
```

**Ưu điểm:**
- Đơn giản về UX — user chỉ cần 1 bước.
- Tuân thủ ERC4626 thuần túy.

**Nhược điểm:**
- Phá vỡ nguyên tắc Single Responsibility — Vault ôm quá nhiều logic.
- Khó audit và test.
- Không thể tái sử dụng hay thay đổi chiến lược staking mà không deploy lại Vault.
- **Về mặt học thuật:** Quá đơn giản, không thể hiện được tính Composability của DeFi.

---

### Pattern 2: External Staking + Auto-Compound vào Vault

**Mô tả:** Staking contract hoạt động bên ngoài, độc lập. Khi user claim reward, reward tự động được `deposit()` vào Vault thay vì trả về ví user.

```
User ──► ExternalStaking.stake()
              │
              │ (harvest rewards)
              ▼
         Reward Token ──► Vault.deposit() ──► Nhiều Shares hơn cho User
```

**Ưu điểm:**
- Auto-compounding: Lợi nhuận kép tự động.
- 2 contract tách biệt, dễ audit từng phần.

**Nhược điểm:**
- Reward token phải là cùng loại với Vault's underlying asset, hoặc cần thêm bước swap.
- Nếu có swap → rủi ro slippage, price manipulation.
- **Về mặt học thuật:** Hay nhưng thiếu chiều sâu về composability giữa các giao thức.

---

## 2. Kết Luận Về 2 Pattern Phổ Biến

| Tiêu Chí | Pattern 1: Staking-Inside-Vault | Pattern 2: External + Auto-Compound |
|---|---|---|
| **Phù hợp NCKH** | Không — Quá đơn giản | Trung bình |
| **Thể hiện Composability** | Không | Một phần |
| **Độ phức tạp kỹ thuật** | Thấp | Trung bình |
| **Tính mới học thuật** | Rất thấp | Trung bình |

> **Kết luận: Cả 2 pattern phổ biến này đều CHƯA đủ giá trị cho một đề tài NCKH ở mức đại học/sau đại học. Cần một kiến trúc thể hiện rõ hơn tính nghiên cứu.**

---

## 3. Kiến Trúc Đề Xuất: "Strategy-Based Vault" (Mô hình Yearn V2/V3)

**Tên kiến trúc:** **Vault + Strategy Layer Architecture**  
**Cảm hứng từ:** Yearn Finance, Morpho Blue, EIP-4626

### Nguyên lý cốt lõi:
> Vault (ERC4626) chỉ chịu trách nhiệm **quản lý tài sản và kế toán (accounting)**. Mọi chiến lược sinh lời được tách ra thành các "Strategy" contract độc lập. Giao thức DeFi thực sự nằm ở tầng Strategy.

### Sơ đồ kiến trúc:

```
┌─────────────────────────────────────────────────────────┐
│                      USER (Frontend)                     │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
         deposit/withdraw          stake/unstake
               │                      │
               ▼                      ▼
┌──────────────────────┐   ┌──────────────────────────────┐
│   DefiVault.sol      │   │    Staking.sol                │
│   (ERC4626)          │◄──│    (Strategy Controller)      │
│                      │   │                               │
│  - manage shares     │   │  - stake()                   │
│  - accounting        │   │  - unstake()                 │
│  - totalAssets()     │   │  - harvest() ──► Vault       │
│  - pricePerShare     │   │  - allocate() ──► Strategy   │
└──────────┬───────────┘   └───────────┬───────────────────┘
           │                           │
           │ totalAssets cập nhật      │ allocate funds
           ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│                  Strategy Layer                           │
│                                                           │
│   ┌─────────────────┐     ┌─────────────────────────┐   │
│   │ Strategy A:     │     │ Strategy B:              │   │
│   │ Fixed APR       │     │ Liquidity Pool (AMM)     │   │
│   │ Staking Pool    │     │ SimpleAMM.sol            │   │
│   └─────────────────┘     └─────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
           │
           ▼
   [Ethereum Sepolia Testnet]
```

---

## 4. Bảng So Sánh Đầy Đủ 3 Kiến Trúc

| Tiêu Chí | Pattern 1: Inside-Vault | Pattern 2: External+Compound | Pattern 3: Strategy-Vault |
|---|---|---|---|
| **Độ phức tạp kỹ thuật** | Thấp | Trung bình | **Cao — phù hợp NCKH** |
| **Tính Composability** | Không | Một phần | **Hoàn toàn** |
| **Source of Yield** | Từ Vault logic | Từ Staking reward | **Từ nhiều Strategy đa dạng** |
| **Có thể thay Strategy** | Không | Không | **Có — không đổi Vault** |
| **Bảo mật Vault** | Rủi ro cao (nhiều logic) | Trung bình | **Thấp — Vault nhỏ gọn** |
| **Giá trị NCKH** | 1/5 | 2/5 | **5/5** |
| **Tính mới học thuật** | Rất thấp | Thấp | **Cao** |
| **Benchmark được với** | Không | Một số protocol | **Yearn, Morpho, ERC4626 chuẩn** |
| **Keywords bài báo** | Vault | Auto-compound | **Strategy Pattern, Capital Efficiency, DeFi Composability, Yield Aggregation** |
| **Phù hợp đề tài WebDefi** | Trung bình | Khá | **Rất cao** |
| **Testability** | Dễ | Trung bình | **Cần thiết kế test kỹ** |
| **Gas Cost** | Thấp | Trung bình | **Cao hơn (trade-off)** |

---

## 5. Chi Tiết Kiến Trúc Strategy-Vault Cho Đề Tài NCKH

### 5.1. Vai trò của từng Contract

| Contract | Vai Trò | Tương đương trong thực tế |
|---|---|---|
| `DefiVault.sol (ERC4626)` | Quản lý shares, accounting, tổng tài sản | Yearn's Vault, Morpho Vault |
| `Staking.sol` | Strategy Controller — điều phối vốn, giữ Vault shares và map theo user position | Yearn's BaseStrategy |
| `WalletStaking.sol` | Baseline Fixed APR giữ nguyên để so sánh nghiên cứu | Legacy/simple staking |
| `StakingPool` (trong Staking.sol) | Pool config: lockDuration, penaltyRate, min/max stake | Simple staking policy layer |
| `SimpleAMM.sol` | Strategy B — Liquidity Pool yield | Uniswap V2 style |

### 5.2. Luồng Stake (Vault-Backed)
```
1. User approve token → Staking.sol
2. User gọi Staking.stake(poolId, amount)
3. Staking.sol gọi DefiVault.deposit(amount) → nhận về Shares
4. Staking.sol lưu số Shares này gắn với stakeId của User
5. Trên UI: User thấy "đang stake X tokens" + "pending yield từ Vault"
```

### 5.3. Luồng Unstake
```
1. User gọi Staking.unstake(stakeId)
2. Staking.sol kiểm tra lockDuration
3. Staking.sol gọi DefiVault.redeem(shares) → nhận lại assets (gốc + yield/loss)
4. Tính toán: yield = (assets_nhận_về - amount_gốc)
5. Nếu rút trước hạn → tính penalty trên principal snapshot (`assetsAtStake`) và cap theo `assetsReturned` để tránh underflow khi Vault bị loss
6. Penalty nằm lại trong Staking.sol như protocol reserve và được track bằng event/counter
7. Trả phần còn lại về User
```

### 5.4. Harvest (Auto-Compound)
```
1. Keeper/Admin gọi Staking.harvest()
2. Strategy/mock source trả về reward bằng underlying asset
3. Staking.sol nhận reward từ keeper/admin
4. Staking.sol chuyển reward trực tiếp vào Vault bằng ERC20 transfer, KHÔNG gọi Vault.deposit()
5. totalAssets tăng, totalSupply không đổi → pricePerShare tăng → mọi active staker đều hưởng lợi theo shares
```

---

## 6. Lý Do Kiến Trúc Này Phù Hợp Với Đề Tài NCKH

### 6.1. Thể hiện được nhiều giao thức DeFi trong 1 hệ thống:
- **ERC4626 Vault** — Tiêu chuẩn vault của Ethereum
- **Fixed APR Staking** — Giao thức staking cơ bản
- **AMM (Automated Market Maker)** — `SimpleAMM.sol`
- **Strategy Pattern** — Kiến trúc tổng hợp yield

### 6.2. Đề tài sẽ có thể trả lời các câu hỏi nghiên cứu:
- **RQ1:** Làm thế nào để kết hợp nhiều giao thức DeFi trong 1 hệ thống thống nhất?
- **RQ2:** Kiến trúc Strategy-Vault có cải thiện Capital Efficiency so với Fixed APR không?
- **RQ3:** Chi phí Gas (gas cost) thay đổi như thế nào khi độ phức tạp protocol tăng?
- **RQ4:** ERC4626 có phải là tiêu chuẩn phù hợp để xây dựng DeFi Protocol composable?

### 6.3. Đóng góp học thuật của đề tài:
1. **Cài đặt và thử nghiệm** kiến trúc Strategy-Vault trên Sepolia Testnet.
2. **So sánh định lượng** giữa Fixed APR Staking (cũ) và Vault-Backed Dynamic Yield (mới).
3. **Đánh giá bảo mật** các điểm attack surface trong kiến trúc multi-contract.
4. **Xây dựng WebDefi App** (Frontend + Backend) tích hợp đầy đủ luồng người dùng.

---

## 7. Roadmap Thực Hiện

```
Phase 1 (Hiện tại — MVP):
  - WalletStaking.sol — Fixed APR baseline (đã có, giữ nguyên)
  - SimpleAMM.sol — AMM cơ bản (đã có)
  - DefiVault.sol — ERC4626 standalone (đã có)

Phase 2 (NCKH Core — Kết hợp):
  - Refactor Staking.sol → trở thành Strategy Controller
  - Kết nối Staking.stake() → DefiVault.deposit()
  - Thêm hàm harvest() theo cơ chế direct Vault donation/realized gain
  - Viết test đầy đủ (unit + integration)
  - Deploy trên Sepolia, ghi lại gas costs

Phase 3 (NCKH Analysis):
  - So sánh APY: Fixed APR (P1) vs Vault-backed (P2)
  - Benchmark gas costs
  - Đánh giá bảo mật: chạy Slither/MythX
  - Viết phần kết quả thực nghiệm cho báo cáo NCKH
```
