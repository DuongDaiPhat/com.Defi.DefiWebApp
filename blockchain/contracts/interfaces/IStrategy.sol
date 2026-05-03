// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStrategy
 * @dev Interface chuẩn cho Strategy Controller trong kiến trúc Strategy-Vault.
 *      Strategy Controller là hợp đồng nằm giữa User và ERC4626 Vault:
 *      - Nhận token từ User khi stake
 *      - Deposit token vào Vault và giữ Shares thay mặt User
 *      - Redeem Shares từ Vault khi User unstake
 *      - Trigger harvest để inject yield vào Vault
 */
interface IStrategy {
    // =========================================================
    //  VIEW FUNCTIONS
    // =========================================================

    /**
     * @notice Địa chỉ ERC4626 Vault mà Strategy này kết nối.
     * @return Địa chỉ của Vault contract.
     */
    function vault() external view returns (address);

    /**
     * @notice Tổng lượng underlying asset (principal) đang được deploy vào Vault.
     * @dev Chỉ dùng để tracking/monitoring, KHÔNG dùng cho financial calculation.
     *      Mọi financial calculation phải dùng vault.previewRedeem(shares).
     * @return Tổng assets (principal) đang active trong Vault tính bằng underlying token.
     */
    function totalDeployed() external view returns (uint256);

    // =========================================================
    //  HARVEST
    // =========================================================

    /**
     * @notice Trigger thu yield và inject vào Vault để tăng pricePerShare cho mọi staker.
     * @dev Implementation: owner/keeper transfer `rewardAmount` token vào Strategy,
     *      sau đó Strategy donate thẳng vào Vault bằng safeTransfer (KHÔNG gọi vault.deposit())
     *      để tăng totalAssets mà không tăng totalSupply (shares).
     *      Chỉ callable bởi owner/keeper (access control do implementation quyết định).
     * @param rewardAmount Lượng underlying token để donate vào Vault như realized gain.
     */
    function harvest(uint256 rewardAmount) external;
}
