import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Lock", function () {
  // ================================================================
  //  FIXTURE — setup chung, chạy 1 lần rồi snapshot lại
  //  loadFixture sẽ reset về snapshot này trước mỗi test case
  // ================================================================
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS: number = 365 * 24 * 60 * 60;
    const ONE_GWEI: number = 1_000_000_000;

    const lockedAmount: number = ONE_GWEI;
    const unlockTime: number = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Lấy 2 account mặc định từ Hardhat Network
    const [owner, otherAccount] = await ethers.getSigners();

    const Lock = await ethers.getContractFactory("Lock");
    const lock = await Lock.deploy(unlockTime, { value: lockedAmount });

    return { lock, unlockTime, lockedAmount, owner, otherAccount };
  }

  // ================================================================
  //  DEPLOYMENT — kiểm tra trạng thái sau khi deploy
  // ================================================================
  describe("Deployment", function () {

    it("Should set the right unlockTime", async function () {
      const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.unlockTime()).to.equal(unlockTime);
    });

    it("Should set the right owner", async function () {
      const { lock, owner } = await loadFixture(deployOneYearLockFixture);

      expect(await lock.owner()).to.equal(owner.address);
    });

    it("Should receive and store the funds to lock", async function () {
      const { lock, lockedAmount } = await loadFixture(deployOneYearLockFixture);

      expect(await ethers.provider.getBalance(lock.target)).to.equal(lockedAmount);
    });

    it("Should fail if the unlockTime is not in the future", async function () {
      // Không dùng fixture vì cần deploy với tham số khác
      const latestTime: number = await time.latest();
      const Lock = await ethers.getContractFactory("Lock");

      await expect(
        Lock.deploy(latestTime, { value: 1 })
      ).to.be.revertedWith("Unlock time should be in the future");
    });
  });

  // ================================================================
  //  WITHDRAWALS — kiểm tra các trường hợp rút tiền
  // ================================================================
  describe("Withdrawals", function () {

    // ── Validations: kiểm tra revert đúng lý do ──────────────────
    describe("Validations", function () {

      it("Should revert with the right error if called too soon", async function () {
        const { lock } = await loadFixture(deployOneYearLockFixture);

        // Gọi withdraw trước khi đến unlockTime → phải revert
        await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
      });

      it("Should revert with the right error if called from another account", async function () {
        const { lock, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        );

        // Tua thời gian đến đúng unlockTime
        await time.increaseTo(unlockTime);

        // Gọi từ account khác (không phải owner) → phải revert
        await expect(
          lock.connect(otherAccount).withdraw()
        ).to.be.revertedWith("You aren't the owner");
      });

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        const { lock, unlockTime } = await loadFixture(deployOneYearLockFixture);

        await time.increaseTo(unlockTime);

        // Owner gọi đúng thời điểm → không được revert
        await expect(lock.withdraw()).not.to.be.reverted;
      });
    });

    // ── Events: kiểm tra event được emit đúng ────────────────────
    describe("Events", function () {

      it("Should emit an event on withdrawals", async function () {
        const { lock, unlockTime, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(lockedAmount, anyValue); // chấp nhận bất kỳ giá trị nào cho `when`
      });
    });

    // ── Transfers: kiểm tra số dư thay đổi đúng ─────────────────
    describe("Transfers", function () {

      it("Should transfer the funds to the owner", async function () {
        const { lock, unlockTime, lockedAmount, owner } = await loadFixture(
          deployOneYearLockFixture
        );

        await time.increaseTo(unlockTime);

        // Sau withdraw: owner nhận thêm lockedAmount, contract giảm lockedAmount
        await expect(lock.withdraw()).to.changeEtherBalances(
          [owner, lock],
          [lockedAmount, -lockedAmount]
        );
      });
    });
  });
});