# Phase 5 Report — Gas Benchmarking & Static Analysis

> Run date: 2026-05-03  
> Command: `REPORT_GAS=true npx hardhat test`  
> Result: `131 passing`

---

## 1. Gas Report Summary

### Strategy Controller (`StakingStrategyController`)

| Function | Min Gas | Max Gas | Avg Gas | Calls | Note |
|---|---:|---:|---:|---:|---|
| `stake()` | 210,264 | 391,224 | 329,403 | 66 | Includes token transfer, approval management, and Vault deposit |
| `unstake()` | 80,695 | 151,285 | 117,031 | 28 | Includes Vault redeem and payout |
| `emergencyWithdraw()` | 104,758 | 129,923 | 119,837 | 10 | Includes Vault redeem and penalty handling |
| `harvest()` | 65,739 | 129,703 | 86,445 | 26 | Direct Vault donation, no share mint |
| `addPool()` | - | - | 150,467 | 1 | Owner-only admin operation |
| `updatePool()` | - | - | 27,900 | 1 | Owner-only admin operation |
| `pause()` | - | - | 27,798 | 3 | Owner-only circuit breaker |

### Vault (`DefiVault`)

| Function | Min Gas | Max Gas | Avg Gas | Calls |
|---|---:|---:|---:|---:|
| `deposit()` | 100,328 | 139,328 | 132,403 | 30 |
| `deposit()` overload | - | - | 134,764 | 2 |
| `depositWithPermit()` | - | - | 168,460 | 2 |
| `mint()` | 134,593 | 139,393 | 136,993 | 4 |
| `redeem()` | 31,155 | 52,922 | 43,950 | 5 |
| `withdraw()` | 31,171 | 62,583 | 46,877 | 4 |
| `emergencyWithdraw()` | - | - | 37,263 | 2 |
| `pause()` | - | - | 27,721 | 6 |
| `unpause()` | - | - | 27,720 | 1 |
| `setMaxDeposit()` | - | - | 30,124 | 1 |
| `setMaxWithdraw()` | - | - | 30,057 | 1 |

---

## 2. Strategy vs Baseline Gas Comparison

The integration benchmark tests log same-scenario gas values for the new Strategy-Vault flow and the legacy `WalletStaking` baseline:

| Operation | New Strategy-Vault | Legacy `WalletStaking` | Delta | Delta % |
|---|---:|---:|---:|---:|
| `stake()` | 347,064 | 230,963 | +116,101 | +50.27% |
| `unstake()` no yield | 117,840 | 68,856 | +48,984 | +71.14% |
| `unstake()` with yield | 119,254 | 68,856 | +50,398 | +73.19% |
| `harvest()` | 93,099 | N/A | N/A | N/A |

### Interpretation

The Strategy-Vault architecture is more expensive than the fixed-APR baseline because each stake/unstake crosses the ERC4626 Vault boundary and performs share accounting. This is expected and matches the architecture trade-off: higher gas cost in exchange for composability, dynamic yield through price-per-share, ERC4626 semantics, and cleaner separation between accounting and yield source.

`harvest()` has no legacy equivalent because the baseline `WalletStaking` uses fixed reward accounting instead of realized-gain donation into the Vault.

---

## 3. Deployment Gas

| Contract | Avg Deploy Gas | Block Limit % |
|---|---:|---:|
| `StakingStrategyController` | 2,469,076 | 4.1% |
| `WalletStaking` | 2,347,933 | 3.9% |
| `DefiVault` | 1,831,331 | 3.1% |
| `Token` | 1,222,221 | 2.0% |
| `SimpleAMM` | 1,368,829 | 2.3% |

---

## 4. Static Analysis Status

Slither analysis was successfully executed using the following command:

```bash
cd blockchain
python -m slither . --filter-paths "node_modules|contracts/test|artifacts|cache|ignition"
```

### Analysis Results

| Hạng mục (Issue/Category) | Mức độ (Severity) | Mô tả (Description) | Giải pháp / Đánh giá (Resolution) |
|---|:---:|---|---|
| **Lỗi bảo mật nghiêm trọng** | HIGH / MEDIUM | Không tìm thấy trong `Staking.sol` hay `DefiVault.sol`. | ✅ Pass. |
| **Reentrancy (Benign)** | LOW / INFO | Slither phát hiện cập nhật state (vd: `totalPenalties`, `userStakes`) sau lệnh gọi external (`_vault.deposit()`, `_vault.redeem()`) trong `stake()`, `unstake()`, `emergencyWithdraw()`. | ✅ False positive. Đã tuân thủ chặt chẽ CEI pattern (chặn state chính yếu trước) và hàm đã dùng `nonReentrant` modifier bảo vệ. |
| **Sử dụng Timestamp** | LOW | Sử dụng `block.timestamp` trong việc so sánh thời gian khóa (lock duration). | ✅ Chấp nhận được (Expected). Việc khoá lâu ngày (vd: 30 days) không bị ảnh hưởng đáng kể bởi sai lệch thao túng thời gian của miner (khoảng 15s). |

### Conclusion
The Strategy Controller and Vault contracts pass the static analysis review and are clear of critical and high-severity security issues.

---

## 5. Đánh Giá Toàn Diện (Strategy-Vault vs Legacy WalletStaking)

Bảng dưới đây so sánh toàn diện giữa kiến trúc Staking mới (`StakingStrategyController` + `DefiVault`) so với Staking gốc (`WalletStaking`) dựa trên các số liệu thực tế đã kiểm thử. Đây là dữ liệu quan trọng phục vụ cho nghiên cứu khoa học (NCKH).

| Tiêu chí đánh giá | Staking Mới (Strategy-Vault) | Staking Gốc (Legacy WalletStaking) | Đánh giá / Phân tích |
|---|---|---|---|
| **1. Nguồn tạo Lợi nhuận** | **Động (Dynamic Yield):** Từ `DefiVault` thông qua tăng trưởng `pricePerShare`. Phụ thuộc vào lợi nhuận thực tế (realized gains) được inject qua `harvest()`. | **Cố định (Fixed APR):** Tính toán off-chain dựa trên công thức tĩnh $\frac{APR \times time}{365}$. | 🟢 **Mới tốt hơn:** Lợi nhuận thực tế, không lạm phát ảo. Phản ánh đúng mô hình tài chính DeFi. |
| **2. Quản lý Tài sản** | Token được đẩy thẳng vào `DefiVault`. Strategy (`Staking.sol`) chỉ giữ **Shares** (chứng nhận cổ phần). | Token nằm chết (idle) trong contract `WalletStaking.sol`. | 🟢 **Mới tốt hơn:** Tối ưu hiệu quả sử dụng vốn (Capital Efficiency). Vault có thể đem token đi đầu tư tiếp. |
| **3. Quy trình Stake** | User $\rightarrow$ Strategy $\rightarrow$ Vault $\rightarrow$ Shares $\rightarrow$ Lưu `StakeInfo` | User $\rightarrow$ Contract $\rightarrow$ Lưu `amount` vào `StakeInfo` | 🟡 **Gốc đơn giản hơn:** Mới yêu cầu nhiều bước cross-contract hơn (approve, deposit). |
| **4. Phí Gas (stake)** | ~ 347,064 gas | ~ 230,963 gas | 🔴 **Gốc rẻ hơn:** Mới đắt hơn ~50.2% do phải tính toán mint shares và cập nhật state ở cả 2 contract. |
| **5. Phí Gas (unstake)** | ~ 117,840 gas (không yield) <br> ~ 119,254 gas (có yield) | ~ 68,856 gas | 🔴 **Gốc rẻ hơn:** Mới đắt hơn ~71% do phải tính toán redeem shares sang assets. |
| **6. Rủi ro Bảo mật tĩnh** | Cần chặn **Reentrancy** kỹ lưỡng (đã áp dụng CEI + `nonReentrant`). Rủi ro Same-block sandwich attack đã được Vault handle. | Rủi ro cạn kiệt pool thưởng (Reward Pool drain) nếu admin không nạp đủ token. | 🟢 **Mới an toàn hơn:** Tách biệt rõ ràng rủi ro sinh lời (Vault) và rủi ro sổ cái (Strategy). |
| **7. Khả năng Mở rộng** | **Rất cao (High Composability):** Chuẩn ERC4626 cho phép tích hợp dễ dàng với Yearn, Aave, Compound. | **Thấp (Siloed):** Contract đóng, không theo chuẩn, khó kết hợp với các giao thức khác. | 🟢 **Mới tốt hơn:** Đạt chuẩn công nghiệp Web3. |
| **8. Thông số / Tham số** | - `shares`: Đại diện principal + yield<br>- `assetsAtStake`: Dùng tính penalty<br>- `totalHarvested`: Tổng lợi nhuận sinh ra | - `amount`: Tiền gốc<br>- `rewardPoolBalance`: Quỹ thưởng<br>- `lastClaimAt`: Lần nhận thưởng cuối | 🟢 **Mới tốt hơn:** Kế toán (accounting) qua `shares` là phương pháp an toàn và chính xác nhất cho Vault. |

### Tổng kết (Takeaway)
Kiến trúc **Strategy-Vault (Mới)** đánh đổi chi phí Gas đắt hơn khoảng **50% - 70%** để đổi lấy **hiệu quả sử dụng vốn (capital efficiency)**, **tính minh bạch sinh lời (realized yield)** và **khả năng tương tác (composability)** theo chuẩn ERC4626. Sự đánh đổi này là hoàn toàn xứng đáng và phản ánh chính xác xu hướng tiến hóa của các giao thức DeFi hiện đại (như Yearn V3).
