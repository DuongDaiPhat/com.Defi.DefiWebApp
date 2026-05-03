# Discovery Report — Strategy-Based Vault Refactor

> **Feature:** Refactor `Staking.sol` → Strategy Controller + kết nối `DefiVault.sol`
> **Ngày khám phá:** 2026-05-03

---

## 1. Cấu Trúc Thư Mục Blockchain

```
blockchain/
├── contracts/
│   ├── interfaces/
│   │   └── IDefiVault.sol          ✅ Đã có — ERC4626 interface đầy đủ
│   ├── DefiVault.sol               ✅ Đã có — ERC4626 compliant, production-grade
│   ├── WalletStaking.sol           ✅ Đã có — Giữ nguyên để làm baseline so sánh (Không sửa đổi)
│   ├── Staking.sol                 ⚠️  Cần refactor → Strategy Controller
│   ├── SimpleAMM.sol               ✅ Đã có — AMM cơ bản (Strategy B tiềm năng)
│   ├── Token.sol                   ✅ Đã có — ERC20 mock cho test
│   ├── Ethereum.sol                📄 Utility contract nhỏ
│   └── Wallet.sol                  📄 Stub nhỏ
├── test/
│   ├── DefiStaking.test.ts         ⚠️  Script demo, KHÔNG phải unit test chuẩn
│   ├── DefiVault.Core.test.ts      ✅ Unit test chuẩn cho Vault
│   ├── DefiVault.ERC4626.test.ts   ✅ ERC4626 compliance tests
│   ├── DefiVault.EdgeCases.test.ts ✅ Edge case tests
│   ├── DefiVault.Security.test.ts  ✅ Security tests cho Vault
│   └── SimpleAMM.test.ts           ✅ Unit test cho AMM
├── hardhat.config.ts               ✅ Solidity 0.8.28, optimizer on, Sepolia configured
├── package.json                    ✅ Hardhat toolbox, chai-matchers, dotenv
└── deployed-addresses.json         📄 Placeholder, chưa có địa chỉ thực
```

---

## 2. Phân Tích Chi Tiết: Staking.sol (Hiện Tại)

### 2.1 State Variables
| Variable | Type | Ghi Chú |
|---|---|---|
| `stakingToken` | `IERC20 immutable` | Token user stake vào |
| `rewardToken` | `IERC20 immutable` | Token trả reward (có thể khác stakingToken) |
| `rewardPoolBalance` | `uint256` | Tổng reward đang giữ trong contract |
| `pools` | `StakingPool[]` | Mảng các pool (4 pool mặc định) |
| `userStakes` | `mapping(addr→id→StakeInfo)` | Stake positions của user |
| `userStakeCount` | `mapping(addr→uint256)` | Số lần stake của mỗi user |
| `totalRewardClaimed` | `mapping(addr→uint256)` | Tổng reward đã claim |

### 2.2 StakeInfo Struct (Hiện Tại)
```solidity
struct StakeInfo {
    uint256 poolId;
    uint256 amount;         // ← raw token amount (cần đổi thành shares)
    uint256 stakedAt;
    uint256 lastClaimAt;    // ← dùng cho APR calculation (sẽ bỏ)
    uint256 pendingReward;  // ← tích lũy APR reward (sẽ bỏ)
    bool    isActive;
}
```

### 2.3 Luồng Stake Hiện Tại
```
User → approve → stake(poolId, amount)
    → transferFrom(user, contract, amount)
    → lưu StakeInfo { amount }
    → pool.totalStaked += amount
```

### 2.4 Luồng Yield Hiện Tại (Fixed APR)
```
_calculateReward(user, stakeId):
    duration = now - lastClaimAt
    reward = (amount * apr * duration) / (365days * 10000)
    
→ reward trả từ rewardPoolBalance (pool riêng, tách biệt với principal)
→ rewardToken.transfer(user, reward)
```

### 2.5 Các Hàm Cần Xóa/Thay Thế
| Hàm | Lý do |
|---|---|
| `depositReward(amount)` | Replaced by `harvest()` direct donation vào Vault |
| `claimReward(stakeId)` | Replaced by Vault-backed yield reflected in share value |
| `_calculateReward()` | APR-based — replaced by Vault share value / pricePerShare |
| Biến `rewardPoolBalance` | Không còn cần |
| Biến `totalRewardClaimed` | Có thể giữ để tracking (optional) |
| Biến `rewardToken` | Yield giờ là cùng token với stakingToken |

---

## 3. Phân Tích Chi Tiết: DefiVault.sol (Hiện Tại)

### 3.1 Kiến Trúc Vault
- **Chuẩn:** ERC4626-compliant 100%
- **Share token:** `dvSKT` (ERC20)
- **Security features đã có:**
  - Virtual Shares offset (10^18) — chống Inflation Attack ✅
  - ReentrancyGuard ✅
  - CEI Pattern ✅
  - SafeERC20 ✅
  - Same-block withdrawal guard (`_lastDepositBlock`) ✅
  - Slippage protection (minShares, maxAssets) ✅
  - Pausable ✅

### 3.2 Điểm Quan Trọng Cho Strategy Integration

**`totalAssets()`:**
```solidity
function totalAssets() public view override returns (uint256) {
    return _asset.balanceOf(address(this)); // ← đơn giản, dùng balance
}
```
→ **Ý nghĩa đúng cho Strategy integration:** `deposit()` mint thêm shares cho caller, nên không được dùng `vault.deposit(reward)` để tạo yield chung. Muốn mô phỏng realized gain, Strategy phải chuyển underlying asset trực tiếp vào Vault (donation) hoặc nhận profit từ strategy thật, làm `totalAssets()` tăng trong khi `totalSupply()` không đổi → `pricePerShare` tăng → tất cả staker hiện hữu hưởng yield theo shares.

**Same-Block Withdrawal Guard — PROBLEM:**
```solidity
mapping(address => uint256) private _lastDepositBlock;
// Trong _redeem():
if (block.number <= _lastDepositBlock[msg.sender]) revert SameBlockWithdrawal();
```
→ **Vấn đề:** Khi **Strategy contract** gọi `vault.deposit()` rồi cùng block có user gọi `unstake()`, guard này sẽ check `_lastDepositBlock[address(Strategy)]`. Vì mọi user đi qua cùng một Strategy address, một user stake có thể làm user khác unstake cùng block bị revert.
→ **Trong plan hiện tại:** Không modify `DefiVault.sol`; cần test cross-user same-block revert và frontend/backend retry ở block kế tiếp.

**`deposit()` signature:**
```solidity
function deposit(uint256 assets) public nonReentrant whenNotPaused returns (uint256)
function deposit(uint256 assets, uint256 minShares) public nonReentrant whenNotPaused returns (uint256)
```
→ Strategy gọi `vault.deposit(amount)` — `msg.sender` = Strategy contract. Vault mint shares **cho Strategy** (không phải user). ✅ Đây là đúng pattern.

### 3.3 Không Cần Modify DefiVault
Vault hiện tại đã đủ để Strategy tích hợp mà **không cần thay đổi**:
- Strategy call `vault.deposit(assets)` → Vault mint shares cho Strategy.
- Strategy lưu shares cho từng user position.
- Strategy call `vault.redeem(shares)` → Vault burn shares, trả assets cho Strategy.
- Strategy trả assets cho user sau khi tính penalty.

---

## 4. Phân Tích: IDefiVault.sol (Interface)

```solidity
// Các hàm Strategy cần dùng — đã có đủ:
function deposit(uint256 assets) external returns (uint256 shares);
function redeem(uint256 shares) external returns (uint256 assets);
function redeem(uint256 shares, uint256 minAssets) external returns (uint256 assets);
function previewRedeem(uint256 shares) external view returns (uint256);
function previewDeposit(uint256 assets) external view returns (uint256);
function totalAssets() external view returns (uint256);
function asset() external view returns (address);
```
→ **Kết luận:** Interface đầy đủ, không cần bổ sung.

---

## 5. Phân Tích: Test Hiện Tại

### 5.1 DefiStaking.test.ts — Vấn Đề
- Đây là **script chạy tuần tự** (kiểu integration script), KHÔNG phải unit test dùng `describe/it`.
- Không có assertion (`expect`), chỉ `console.log`.
- Sẽ **không được tái sử dụng** — thay bằng test chuẩn mới.

### 5.2 DefiVault tests — Pattern Tốt Cần Học
Từ `DefiVault.Core.test.ts`, `DefiVault.Security.test.ts`:
- Dùng `loadFixture()` từ Hardhat Helpers ✅
- Mỗi test case độc lập ✅
- Dùng `expect().to.emit()` cho events ✅
- Dùng `ethers.provider.send("evm_increaseTime", [...])` cho time travel ✅
- Dùng `expect().to.be.revertedWithCustomError()` ✅

→ **Phải follow pattern này** cho các test file mới.

---

## 6. Gap Analysis Tổng Hợp

### 6.1 Contract Gaps
| Gap | Mức độ | Giải pháp |
|---|---|---|
| Staking.sol không biết Vault tồn tại | 🔴 Critical | Refactor toàn bộ state + flow |
| StakeInfo lưu `amount` thay vì `shares` | 🔴 Critical | Đổi struct |
| Không có `harvest()` | 🔴 Critical | Thêm mới |
| Không có `IStrategy.sol` | 🟡 Medium | Tạo interface mới |
| WalletStaking.sol trùng lặp Staking.sol | 🟡 Medium | Giữ WalletStaking.sol làm baseline, refactor/rename contract trong Staking.sol để tránh artifact ambiguity |

### 6.2 Test Gaps
| Gap | Mức độ | Giải pháp |
|---|---|---|
| Không có unit test chuẩn cho Staking.sol | 🔴 Critical | Tạo mới |
| Không có integration test Vault↔Strategy | 🔴 Critical | Tạo mới |
| Không có security test cho Strategy | 🔴 Critical | Tạo mới |
| Gas benchmark chưa có | 🟡 Medium | Thêm vào integration test |

### 6.3 Infrastructure Gaps
| Gap | Mức độ | Giải pháp |
|---|---|---|
| Không có Ignition deploy module cho Strategy | 🟡 Medium | Tạo mới |
| `hardhat-gas-reporter` chưa cấu hình | 🟡 Medium | Thêm vào hardhat.config.ts |
| `deployed-addresses.json` trống | 🟢 Low | Cập nhật sau deploy |

---

## 7. Dependencies & Toolchain

```json
// package.json (đã có)
"@nomicfoundation/hardhat-toolbox": "^5.0.0"
"@nomicfoundation/hardhat-chai-matchers": "^2.0.0"
"@openzeppelin/contracts": "^5.x"
"hardhat": "^2.x"
"typescript": "^5.x"
"dotenv": "^16.x"

// Cần bổ sung (nếu chưa có):
"hardhat-gas-reporter": "^1.x"
```

---

## 8. Phát Hiện Rủi Ro

| Rủi ro | Xác suất | Tác động | Giảm thiểu |
|---|---|---|---|
| Same-block withdrawal guard chặn cross-user unstake | Cao | Medium | Test user A stake/user B unstake cùng block; UI/backend retry sau block kế tiếp |
| Shares rounding làm mất 1 wei của user | Trung bình | Low | Đây là behavior đúng của ERC4626 (vault-favoring), document rõ |
| `stakingToken != vault.asset()` gây silent failure | Thấp | Critical | Thêm validation trong constructor |
| harvest() bị gọi với 0 amount | Cao | Low | Guard: `if (amount == 0) revert HarvestAmountZero()` |
| `harvest()` dùng `vault.deposit()` làm reward bị kẹt dưới dạng shares không map user | Cao | Critical | Harvest phải direct transfer/donation vào Vault, không gọi `deposit()` |
| Vault owner có thể emergency drain underlying khi paused | Thấp-Trung bình | Critical | Ghi rõ admin risk; production cần multisig/timelock hoặc giới hạn rescue non-underlying |
| Penalty sau unstake nằm lại trong Strategy không được track | Trung bình | Medium | Thêm `totalPenalties`, event `PenaltyCollected`, và policy rõ cho treasury/reserve |
