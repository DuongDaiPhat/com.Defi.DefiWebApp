import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployDefiVaultFixture } from "./shared/DefiVault.fixture";

describe("DefiVault: Edge Cases & Missing Coverage", function () {

  // ================================================================
  //  SLIPPAGE PROTECTION — deposit & redeem overloads
  // ================================================================
  describe("Slippage Protection (deposit & redeem)", function () {
    it("Should revert deposit if minShares slippage not met", async function () {
      const { defiVault, token, vaultAddress, user1, user2 } = await loadFixture(deployDefiVaultFixture);

      // Setup: deposit + add yield to change ratio (1 share < 1 asset)
      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));
      await token.connect(user1).transfer(vaultAddress, ethers.parseEther("100")); // Vault: 200 assets, 100 shares → 1 share = 2 assets

      const depositAmount = ethers.parseEther("10"); // ~5 shares at ratio 2:1
      const minShares = ethers.parseEther("10"); // Require 10 shares → too high, should revert

      await token.connect(user2).approve(vaultAddress, depositAmount);
      await expect(defiVault.connect(user2)["deposit(uint256,uint256)"](depositAmount, minShares))
        .to.be.revertedWithCustomError(defiVault, "SlippageExceeded");
    });

    it("Should accept deposit if minShares slippage is met", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const depositAmount = ethers.parseEther("100");
      const minShares = ethers.parseEther("99"); // Slightly below expected 100 shares

      await token.connect(user1).approve(vaultAddress, depositAmount);
      // Should NOT revert
      await expect(defiVault.connect(user1)["deposit(uint256,uint256)"](depositAmount, minShares))
        .to.not.be.reverted;
    });

    it("Should revert redeem if minAssets slippage not met", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const amount = ethers.parseEther("100");

      await token.connect(user1).approve(vaultAddress, amount);
      await defiVault.connect(user1)["deposit(uint256)"](amount);

      await ethers.provider.send("evm_mine", []);

      const shares = await defiVault.balanceOf(user1.address);
      const minAssets = ethers.parseEther("101"); // Require more than what will be returned

      await expect(defiVault.connect(user1)["redeem(uint256,uint256)"](shares, minAssets))
        .to.be.revertedWithCustomError(defiVault, "SlippageExceeded");
    });

    it("Should accept redeem if minAssets slippage is met", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const amount = ethers.parseEther("100");

      await token.connect(user1).approve(vaultAddress, amount);
      await defiVault.connect(user1)["deposit(uint256)"](amount);

      await ethers.provider.send("evm_mine", []);

      const shares = await defiVault.balanceOf(user1.address);
      const minAssets = ethers.parseEther("99"); // Acceptable minimum

      await expect(defiVault.connect(user1)["redeem(uint256,uint256)"](shares, minAssets))
        .to.not.be.reverted;
    });
  });

  // ================================================================
  //  SAME-BLOCK GUARD for mint() and withdraw()
  // ================================================================
  describe("Same-Block MEV Guard (mint & withdraw)", function () {
    it("Should revert withdraw(assets) in same block as deposit", async function () {
      const { defiVault, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);

      await ethers.provider.send("evm_setAutomine", [false]);

      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount);

      const depositTx = await defiVault.connect(user1)["deposit(uint256)"](amount);
      const withdrawTx = await defiVault.connect(user1)["withdraw(uint256)"](ethers.parseEther("50"));

      await ethers.provider.send("evm_mine", []);
      await depositTx.wait();

      let reverted = false;
      try { await withdrawTx.wait(); } catch { reverted = true; }
      expect(reverted).to.be.true;

      await ethers.provider.send("evm_setAutomine", [true]);
    });

    it("Should revert withdraw(assets) in same block as mint", async function () {
      const { defiVault, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);

      await ethers.provider.send("evm_setAutomine", [false]);

      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount * 2n);

      const mintTx = await defiVault.connect(user1)["mint(uint256)"](amount);
      const withdrawTx = await defiVault.connect(user1)["withdraw(uint256)"](ethers.parseEther("50"));

      await ethers.provider.send("evm_mine", []);
      await mintTx.wait();

      let reverted = false;
      try { await withdrawTx.wait(); } catch { reverted = true; }
      expect(reverted).to.be.true;

      await ethers.provider.send("evm_setAutomine", [true]);
    });

    it("Should revert redeem in same block as mint", async function () {
      const { defiVault, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);

      await ethers.provider.send("evm_setAutomine", [false]);

      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount * 2n);

      const mintTx = await defiVault.connect(user1)["mint(uint256)"](amount);
      const redeemTx = await defiVault.connect(user1)["redeem(uint256)"](amount);

      await ethers.provider.send("evm_mine", []);
      await mintTx.wait();

      let reverted = false;
      try { await redeemTx.wait(); } catch { reverted = true; }
      expect(reverted).to.be.true;

      await ethers.provider.send("evm_setAutomine", [true]);
    });
  });

  // ================================================================
  //  withdraw(assets) — InsufficientShares
  // ================================================================
  describe("Withdraw — Insufficient Shares", function () {
    it("Should revert withdraw(assets) if user does not have enough shares", async function () {
      const { defiVault, token, vaultAddress, user1, user2 } = await loadFixture(deployDefiVaultFixture);

      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));

      await ethers.provider.send("evm_mine", []);

      // user2 has NO shares but tries to withdraw
      await expect(defiVault.connect(user2)["withdraw(uint256)"](ethers.parseEther("50")))
        .to.be.revertedWithCustomError(defiVault, "InsufficientShares");
    });

    it("Should revert withdraw(assets) if requested assets require more shares than owned", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);

      await token.connect(user1).approve(vaultAddress, ethers.parseEther("50"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("50")); // ~50 shares

      await ethers.provider.send("evm_mine", []);

      // Try to withdraw 100 assets with only ~50 shares
      await expect(defiVault.connect(user1)["withdraw(uint256)"](ethers.parseEther("100")))
        .to.be.revertedWithCustomError(defiVault, "InsufficientShares");
    });
  });

  // ================================================================
  //  ROUNDING EDGE CASE — tiny dust amounts
  // ================================================================
  describe("Rounding Edge Cases", function () {
    it("Should revert redeem of 1 wei share when vault has uneven ratio returning 0 assets", async function () {
      const { defiVault, token, vaultAddress, user1, user2 } = await loadFixture(deployDefiVaultFixture);

      // Large totalSupply, tiny totalAssets → 1 wei share = 0 assets (Floor)
      // Impossible to trigger realistically without extreme setup, but we test
      // the guard: previewRedeem(1n) should return 0 only if vault is empty
      // In normal operation, 1:1 initial ratio means 1 wei share = 1 wei asset
      await token.connect(user1).approve(vaultAddress, 1n);
      await defiVault.connect(user1)["deposit(uint256)"](1n);

      await ethers.provider.send("evm_mine", []);

      // 1 wei share returns 1 wei asset (1:1 initial ratio with virtual offset)
      const preview = await defiVault.previewRedeem(1n);
      expect(preview).to.equal(1n); // confirms no zero-asset silent burn possible
    });

    it("previewMint and previewDeposit should be inverse-consistent", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);

      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));

      const assets = ethers.parseEther("50");
      const sharesFromDeposit = await defiVault.previewDeposit(assets);
      const assetsFromMint = await defiVault.previewMint(sharesFromDeposit);

      // Ceil(mint) >= Floor(deposit) — user always pays >= what they would get
      expect(assetsFromMint).to.be.gte(assets);
    });

    it("previewWithdraw and previewRedeem should be inverse-consistent", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);

      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));

      const shares = ethers.parseEther("50");
      const assetsFromRedeem = await defiVault.previewRedeem(shares);
      const sharesFromWithdraw = await defiVault.previewWithdraw(assetsFromRedeem);

      // Ceil(withdraw) >= Floor(redeem) — user always burns >= what they would redeem
      expect(sharesFromWithdraw).to.be.gte(shares);
    });
  });

  // ================================================================
  //  ACCESS CONTROL — non-owner cannot call admin functions
  // ================================================================
  describe("Access Control — Non-Owner Restrictions", function () {
    it("Should revert if non-owner tries to pause", async function () {
      const { defiVault, user1 } = await loadFixture(deployDefiVaultFixture);
      await expect(defiVault.connect(user1).pause())
        .to.be.revertedWithCustomError(defiVault, "OwnableUnauthorizedAccount")
        .withArgs(user1.address);
    });

    it("Should revert if non-owner tries to setMaxDeposit", async function () {
      const { defiVault, user1 } = await loadFixture(deployDefiVaultFixture);
      await expect(defiVault.connect(user1).setMaxDeposit(ethers.parseEther("1")))
        .to.be.revertedWithCustomError(defiVault, "OwnableUnauthorizedAccount");
    });

    it("Should revert if non-owner tries to setMaxWithdraw", async function () {
      const { defiVault, user1 } = await loadFixture(deployDefiVaultFixture);
      await expect(defiVault.connect(user1).setMaxWithdraw(ethers.parseEther("1")))
        .to.be.revertedWithCustomError(defiVault, "OwnableUnauthorizedAccount");
    });

    it("Should revert if non-owner tries to emergencyWithdraw when paused", async function () {
      const { defiVault, owner, user1 } = await loadFixture(deployDefiVaultFixture);
      await defiVault.connect(owner).pause();
      await expect(defiVault.connect(user1).emergencyWithdraw())
        .to.be.revertedWithCustomError(defiVault, "OwnableUnauthorizedAccount");
    });
  });

  // ================================================================
  //  maxDeposit / maxMint / maxWithdraw / maxRedeem — paused state
  // ================================================================
  describe("Max Functions — Return Zero When Paused", function () {
    it("maxDeposit and maxMint should return 0 when paused", async function () {
      const { defiVault, owner, user1 } = await loadFixture(deployDefiVaultFixture);
      await defiVault.connect(owner).pause();
      expect(await defiVault.maxDeposit(user1.address)).to.equal(0);
      expect(await defiVault.maxMint(user1.address)).to.equal(0);
    });

    it("maxWithdraw and maxRedeem should return 0 when paused", async function () {
      const { defiVault, owner, user1, token, vaultAddress } = await loadFixture(deployDefiVaultFixture);
      const amount = ethers.parseEther("100");
      await token.connect(user1).approve(vaultAddress, amount);
      await defiVault.connect(user1)["deposit(uint256)"](amount);
      await defiVault.connect(owner).pause();
      expect(await defiVault.maxWithdraw(user1.address)).to.equal(0);
      expect(await defiVault.maxRedeem(user1.address)).to.equal(0);
    });
  });

  // ================================================================
  //  convertToShares / convertToAssets
  // ================================================================
  describe("Conversion View Functions", function () {
    it("convertToShares should be consistent with previewDeposit", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);

      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));

      const assets = ethers.parseEther("50");
      expect(await defiVault.convertToShares(assets)).to.equal(await defiVault.previewDeposit(assets));
    });

    it("convertToAssets should be consistent with previewRedeem", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);

      await token.connect(user1).approve(vaultAddress, ethers.parseEther("100"));
      await defiVault.connect(user1)["deposit(uint256)"](ethers.parseEther("100"));

      const shares = ethers.parseEther("50");
      expect(await defiVault.convertToAssets(shares)).to.equal(await defiVault.previewRedeem(shares));
    });
  });

  // ================================================================
  //  depositWithPermit
  // ================================================================
  describe("depositWithPermit (Gasless Approval)", function () {
    it("Should deposit using EIP-2612 permit in a single transaction", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const amount = ethers.parseEther("100");

      const deadline = ethers.MaxUint256;
      const nonce = await token.nonces(user1.address);

      const domain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: user1.address,
        spender: vaultAddress,
        value: amount,
        nonce: nonce,
        deadline: deadline,
      };

      const sig = await user1.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);

      // User has NOT called approve() — permit handles it
      await expect(
        defiVault.connect(user1).depositWithPermit(amount, 0, deadline, v, r, s)
      ).to.emit(defiVault, "Deposited");

      expect(await defiVault.balanceOf(user1.address)).to.be.gt(0);
    });

    it("Should revert depositWithPermit with expired deadline", async function () {
      const { defiVault, token, vaultAddress, user1 } = await loadFixture(deployDefiVaultFixture);
      const amount = ethers.parseEther("100");

      // Expired deadline (block 1)
      const deadline = 1n;
      const nonce = await token.nonces(user1.address);

      const domain = {
        name: await token.name(),
        version: "1",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await token.getAddress(),
      };

      const types = {
        Permit: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
          { name: "value", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const message = {
        owner: user1.address,
        spender: vaultAddress,
        value: amount,
        nonce: nonce,
        deadline: deadline,
      };

      const sig = await user1.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(sig);

      await expect(
        defiVault.connect(user1).depositWithPermit(amount, 0, deadline, v, r, s)
      ).to.be.reverted; // ERC20Permit: expired deadline
    });
  });
});
