import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("OSVAPool Hybrid DeFi", function () {
    let token0: Contract;
    let token1: Contract;
    let pool: Contract;

    let owner: Signer;
    let oracleSigner: Signer;
    let user: Signer;
    let attacker: Signer;

    const INITIAL_SUPPLY = ethers.parseUnits("1000000", 18);
    const MINIMUM_LIQUIDITY = 1000n;

    beforeEach(async function () {
        [owner, oracleSigner, user, attacker] = await ethers.getSigners();

        // 1. Deploy 2 Token ERC20
        const TokenFactory = await ethers.getContractFactory("contracts/CustomToken.sol:Token");
        token0 = await TokenFactory.deploy("Token A", "TKA", await owner.getAddress());
        token1 = await TokenFactory.deploy("Token B", "TKB", await owner.getAddress());
        await token0.waitForDeployment();
        await token1.waitForDeployment();

        // Đảm bảo token0 có address nhỏ hơn token1 (chuẩn AMM cơ bản, dù OSVA không bắt buộc)
        if ((await token0.getAddress()) > (await token1.getAddress())) {
            let temp = token0;
            token0 = token1;
            token1 = temp;
        }

        // 2. Deploy OSVAPool
        const PoolFactory = await ethers.getContractFactory("OSVAPool");
        pool = await PoolFactory.deploy(
            await token0.getAddress(),
            await token1.getAddress(),
            await oracleSigner.getAddress()
        );
        await pool.waitForDeployment();

        // 3. Cấp phát Token cho User
        await token0.mint(await user.getAddress(), ethers.parseUnits("10000", 18));
        await token1.mint(await user.getAddress(), ethers.parseUnits("10000", 18));
    });

    describe("Deployment", function () {
        it("Should set the right tokens and oracle signer", async function () {
            expect(await pool.token0()).to.equal(await token0.getAddress());
            expect(await pool.token1()).to.equal(await token1.getAddress());
            expect(await pool.oracleSigner()).to.equal(await oracleSigner.getAddress());
        });
    });

    describe("Liquidity Provision", function () {
        it("Should add initial liquidity correctly", async function () {
            const amount0 = ethers.parseUnits("1000", 18);
            const amount1 = ethers.parseUnits("1000", 18);
            const deadline = (await time.latest()) + 3600;

            await token0.connect(user).approve(await pool.getAddress(), amount0);
            await token1.connect(user).approve(await pool.getAddress(), amount1);

            await expect(pool.connect(user).addLiquidity(amount0, amount1, deadline))
                .to.emit(pool, "LiquidityAdded");

            const reserve0 = await pool.reserve0();
            const reserve1 = await pool.reserve1();

            expect(reserve0).to.equal(amount0);
            expect(reserve1).to.equal(amount1);

            // Kiểm tra số dư LP Token của user (Bị trừ đi MINIMUM_LIQUIDITY)
            const expectedShares = amount0 - MINIMUM_LIQUIDITY;
            expect(await pool.balanceOf(await user.getAddress())).to.equal(expectedShares);
        });
    });

    describe("Swap Mechanism (OSVA vs Standard V2)", function () {
        beforeEach(async function () {
            // Nạp thanh khoản ban đầu: 1000 TKA và 1000 TKB
            const amount0 = ethers.parseUnits("1000", 18);
            const amount1 = ethers.parseUnits("1000", 18);
            const deadline = (await time.latest()) + 3600;

            await token0.connect(user).approve(await pool.getAddress(), ethers.MaxUint256);
            await token1.connect(user).approve(await pool.getAddress(), ethers.MaxUint256);

            await pool.connect(user).addLiquidity(amount0, amount1, deadline);
        });

        it("Should execute a standard V2 Swap when signature is empty (Fallback)", async function () {
            const amountIn = ethers.parseUnits("100", 18);
            const minAmountOut = 0; // Chấp nhận mọi trượt giá trong test
            const deadline = (await time.latest()) + 60;
            const emptySignature = "0x";

            // Normal V2 Math: (1000 * 1000) = (1000 + 100*0.997) * (1000 - output)
            // Output ~ 90.66 TKB
            await expect(
                pool.connect(user).swapOSVA(
                    await token0.getAddress(),
                    amountIn,
                    minAmountOut,
                    0, // alpha
                    deadline,
                    emptySignature
                )
            ).to.emit(pool, "Swap");

            const reserve1After = await pool.reserve1();
            const token1Balance = await token1.balanceOf(await user.getAddress());

            // Trượt giá khá cao, user chỉ nhận được khoảng ~90.6 token
            expect(reserve1After).to.be.lessThan(ethers.parseUnits("910", 18));
        });

        it("Should execute an OSVA Swap with valid signature and drastically reduce slippage", async function () {
            const userAddress = await user.getAddress();
            const tokenInAddress = await token0.getAddress();
            const amountIn = ethers.parseUnits("100", 18);
            const alpha = 99n; // Khuếch đại x100 (1 thực + 99 ảo)
            const deadline = (await time.latest()) + 60;

            // 1. Backend Java mô phỏng: Cấu trúc EIP-712 Domain
            const domain = {
                name: "OSVA_Protocol",
                version: "1.0",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await pool.getAddress()
            };

            // 2. Types mapping
            const types = {
                SwapRequest: [
                    { name: "user", type: "address" },
                    { name: "tokenIn", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "alpha", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            // 3. Giá trị cần ký
            const value = {
                user: userAddress,
                tokenIn: tokenInAddress,
                amountIn: amountIn,
                alpha: alpha,
                deadline: deadline
            };

            // 4. Oracle (Backend Signer) thực hiện ký
            const signature = await oracleSigner.signTypedData(domain, types, value);

            const balanceOutBefore = await token1.balanceOf(userAddress);

            // 5. User đẩy giao dịch lên cùng với chữ ký của Backend
            await expect(
                pool.connect(user).swapOSVA(
                    tokenInAddress,
                    amountIn,
                    0,
                    alpha,
                    deadline,
                    signature
                )
            ).to.emit(pool, "Swap");

            const balanceOutAfter = await token1.balanceOf(userAddress);
            const amountOut = balanceOutAfter - balanceOutBefore;

            // Với alpha = 99 (pool ảo 100,000), trượt giá sẽ gần bằng 0. 
            // Output sẽ xấp xỉ 99.6 token thay vì 90.6 token như V2 gốc.
            expect(amountOut).to.be.greaterThan(ethers.parseUnits("99", 18));
        });

        it("Should revert if signature is invalid (signed by attacker)", async function () {
            const userAddress = await user.getAddress();
            const tokenInAddress = await token0.getAddress();
            const amountIn = ethers.parseUnits("100", 18);
            const alpha = 99n;
            const deadline = (await time.latest()) + 60;

            const domain = {
                name: "OSVA_Protocol",
                version: "1.0",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await pool.getAddress()
            };

            const types = {
                SwapRequest: [
                    { name: "user", type: "address" },
                    { name: "tokenIn", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "alpha", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };

            const value = { user: userAddress, tokenIn: tokenInAddress, amountIn, alpha, deadline };

            // Kẻ tấn công cố tình ký hệ số Alpha có lợi cho hắn
            const invalidSignature = await attacker.signTypedData(domain, types, value);

            await expect(
                pool.connect(user).swapOSVA(
                    tokenInAddress,
                    amountIn,
                    0,
                    alpha,
                    deadline,
                    invalidSignature
                )
            ).to.be.revertedWith("OSVA: Invalid Signature");
        });

        it("Should revert if alpha exceeds MAX_ALPHA", async function () {
            const userAddress = await user.getAddress();
            const tokenInAddress = await token0.getAddress();
            const amountIn = ethers.parseUnits("100", 18);
            const exceedAlpha = 101n; // Vượt quá MAX_ALPHA = 100 trong Contract
            const deadline = (await time.latest()) + 60;

            const domain = {
                name: "OSVA_Protocol",
                version: "1.0",
                chainId: (await ethers.provider.getNetwork()).chainId,
                verifyingContract: await pool.getAddress()
            };
            const types = {
                SwapRequest: [
                    { name: "user", type: "address" },
                    { name: "tokenIn", type: "address" },
                    { name: "amountIn", type: "uint256" },
                    { name: "alpha", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            };
            const value = { user: userAddress, tokenIn: tokenInAddress, amountIn, alpha: exceedAlpha, deadline };
            const signature = await oracleSigner.signTypedData(domain, types, value);

            await expect(
                pool.connect(user).swapOSVA(
                    tokenInAddress,
                    amountIn,
                    0,
                    exceedAlpha,
                    deadline,
                    signature
                )
            ).to.be.revertedWith("OSVA: Alpha exceeds MAX bounds");
        });
    });
});