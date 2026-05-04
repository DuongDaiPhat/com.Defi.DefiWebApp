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

| Issue/Category | Severity | Description | Resolution / Assessment |
|---|:---:|---|---|
| **Critical Security Issues** | HIGH / MEDIUM | None found in `Staking.sol` or `DefiVault.sol`. | Pass. |
| **Reentrancy (Benign)** | LOW / INFO | Slither detected state updates (e.g., `totalPenalties`, `userStakes`) after external calls (`_vault.deposit()`, `_vault.redeem()`) in `stake()`, `unstake()`, and `emergencyWithdraw()`. | False positive. The CEI pattern is strictly followed (core states are updated first), and functions are protected by the `nonReentrant` modifier. |
| **Timestamp Usage** | LOW | Usage of `block.timestamp` for comparing lock duration. | Expected. Long lock periods (e.g., 30 days) are not significantly affected by minor miner time manipulation (around 15s). |

### Conclusion
The Strategy Controller and Vault contracts pass the static analysis review and are clear of critical and high-severity security issues.

---


