import { expect } from "chai";
import { ethers } from "hardhat";
import { Token, SimpleAMM } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SimpleAMM", function () {
  let gld: Token;
  let slv: Token;
  let amm: SimpleAMM;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const INITIAL_MINT = ethers.parseUnits("10000", 18);
  const INITIAL_LIQUIDITY = ethers.parseUnits("1000", 18);

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("Token");
    gld = await Token.deploy(owner.address) as unknown as Token;
    slv = await Token.deploy(owner.address) as unknown as Token;

    await gld.waitForDeployment();
    await slv.waitForDeployment();

    const gldAddress = await (gld as any).getAddress();
    const slvAddress = await (slv as any).getAddress();

    const SimpleAMM = await ethers.getContractFactory("SimpleAMM");
    amm = await SimpleAMM.deploy(gldAddress, slvAddress) as unknown as SimpleAMM;
    await amm.waitForDeployment();

    // Mint tokens for users
    await gld.mint(owner.address, INITIAL_MINT);
    await slv.mint(owner.address, INITIAL_MINT);
    await gld.mint(user1.address, INITIAL_MINT);
    await slv.mint(user1.address, INITIAL_MINT);
  });

  describe("Deployment", function () {
    it("Should set the correct tokens", async function () {
      expect(await amm.token0()).to.equal(await (gld as any).getAddress());
      expect(await amm.token1()).to.equal(await (slv as any).getAddress());
    });
  });

  describe("Liquidity", function () {
    it("Should add initial liquidity correctly", async function () {
      const ammAddress = await amm.getAddress();
      await gld.approve(ammAddress, INITIAL_LIQUIDITY);
      await slv.approve(ammAddress, INITIAL_LIQUIDITY);

      await expect(amm.addLiquidity(INITIAL_LIQUIDITY, INITIAL_LIQUIDITY))
        .to.emit(amm, "LiquidityAdded")
        .withArgs(owner.address, INITIAL_LIQUIDITY, INITIAL_LIQUIDITY, INITIAL_LIQUIDITY - 1000n); // 1000n is MINIMUM_LIQUIDITY

      expect(await amm.reserve0()).to.equal(INITIAL_LIQUIDITY);
      expect(await amm.reserve1()).to.equal(INITIAL_LIQUIDITY);
      expect(await amm.balanceOf(owner.address)).to.equal(INITIAL_LIQUIDITY - 1000n);
    });
  });

  describe("Swap", function () {
    beforeEach(async function () {
      const ammAddress = await amm.getAddress();
      await gld.approve(ammAddress, INITIAL_LIQUIDITY);
      await slv.approve(ammAddress, INITIAL_LIQUIDITY);
      await amm.addLiquidity(INITIAL_LIQUIDITY, INITIAL_LIQUIDITY);
    });

    it("Should allow user to swap GLD for SLV", async function () {
      const swapAmount = ethers.parseUnits("100", 18);
      const ammAddress = await amm.getAddress();

      await gld.connect(user1).approve(ammAddress, swapAmount);
      
      // We expect some SLV back, let's just assert the balance increases
      const slvBalanceBefore = await slv.balanceOf(user1.address);
      await amm.connect(user1).swap(await (gld as any).getAddress(), swapAmount, 1);
      const slvBalanceAfter = await slv.balanceOf(user1.address);

      expect(slvBalanceAfter).to.be.greaterThan(slvBalanceBefore);
    });

    it("Should fail swap if slippage is too high", async function () {
      const swapAmount = ethers.parseUnits("100", 18);
      const ammAddress = await amm.getAddress();

      await gld.connect(user1).approve(ammAddress, swapAmount);
      
      // Set an impossible minimum out expectation (more than the pool has)
      const impossibleMinOut = ethers.parseUnits("2000", 18);
      
      await expect(
        amm.connect(user1).swap(await (gld as any).getAddress(), swapAmount, impossibleMinOut)
      ).to.be.revertedWith("AMM: Insufficient output amount (Slippage)");
    });
  });
});
