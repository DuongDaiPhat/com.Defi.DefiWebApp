import { expect } from "chai";
import { ethers } from "hardhat";

// ------------------------------------------------------------------
// PHẦN 1: MOCK THUẬT TOÁN ĐỊNH LƯỢNG (JAVA BACKEND LOGIC)
// ------------------------------------------------------------------

/**
 * Mô phỏng hàm tính delta_final từ Java Backend
 * Công thức: δ_final = δ_base * M_imb * M_depth
 */
function calculateDeltaFinal(deltaBase: number, mImb: number, mDepth: number): number {
    return deltaBase * mImb * mDepth;
}

/**
 * Mô phỏng hàm tính hệ số Alpha từ Java Backend
 * Công thức: α = 1 / (sqrt(1 + δ_final) - 1)
 */
function calculateAlpha(deltaFinal: number): number {
    if (deltaFinal <= 0) return 0;
    const alpha = 1 / (Math.sqrt(1 + deltaFinal) - 1);
    // Smart contract giới hạn MAX_ALPHA = 100
    return Math.min(Math.floor(alpha), 100);
}

/**
 * Helper tính Slippage %
 * So sánh thực nhận với lượng kỳ vọng lý tưởng (không tính phí, không trượt giá)
 */
function calculateSlippage(expectedOut: bigint, actualOut: bigint): number {
    const expected = Number(ethers.formatEther(expectedOut));
    const actual = Number(ethers.formatEther(actualOut));
    return ((expected - actual) / expected) * 100;
}

describe("OSVA Hybrid DeFi Model - Slippage Research", function () {
    let tokenA: any;
    let tokenB: any;
    let osvaPool: any;
    let owner: any;
    let oracleSigner: any;
    let user: any;

    const INITIAL_RESERVE_A = ethers.parseEther("100000");
    const INITIAL_RESERVE_B = ethers.parseEther("50000");
    const AMOUNT_IN = ethers.parseEther("100");

    before(async function () {
        [owner, oracleSigner, user] = await ethers.getSigners();

        // 1. Deploy Tokens
        const TokenFactory = await ethers.getContractFactory("contracts/CustomToken.sol:Token");
        tokenA = await TokenFactory.deploy("Token A", "TKA", owner.address);
        tokenB = await TokenFactory.deploy("Token B", "TKB", owner.address);

        const addrA = await tokenA.getAddress();
        const addrB = await tokenB.getAddress();

        // 2. Deploy OSVAPool
        const OSVAFactory = await ethers.getContractFactory("OSVAPool");
        osvaPool = await OSVAFactory.deploy(addrA, addrB, oracleSigner.address);

        // 3. Setup Liquidity
        await tokenA.mint(owner.address, INITIAL_RESERVE_A);
        await tokenB.mint(owner.address, INITIAL_RESERVE_B);

        await tokenA.approve(await osvaPool.getAddress(), INITIAL_RESERVE_A);
        await tokenB.approve(await osvaPool.getAddress(), INITIAL_RESERVE_B);

        const deadline = Math.floor(Date.now() / 1000) + 3600;
        await osvaPool.addLiquidity(INITIAL_RESERVE_A, INITIAL_RESERVE_B, deadline);

        // 4. Setup User
        await tokenA.mint(user.address, ethers.parseEther("1000"));
        await tokenA.connect(user).approve(await osvaPool.getAddress(), ethers.MaxUint256);
    });

    describe("Phần 1: Mock thuật toán Định lượng (Backend Logic)", function () {
        it("Nên tính toán đúng delta_final", function () {
            const deltaFinal = calculateDeltaFinal(0.02, 1, 1);
            expect(deltaFinal).to.be.closeTo(0.02, 0.0001);
        });

        it("Nên tính toán đúng alpha cho Sideway Market (delta_final nhỏ -> alpha cao)", function () {
            // δ_final = 0.02 => α = 1 / (sqrt(1.02) - 1) ≈ 100.49 => floor = 100
            const alpha = calculateAlpha(0.02);
            expect(alpha).to.equal(100);
        });

        it("Nên tính toán đúng alpha cho High Volatility (delta_final cao -> alpha thấp)", function () {
            // δ_final = 0.1 => α = 1 / (sqrt(1.1) - 1) ≈ 20.48 => floor = 20
            const alpha = calculateAlpha(0.1);
            expect(alpha).to.equal(20);
        });
    });

    describe("Phần 2 & 3: Kiểm thử kịch bản Trượt giá (Slippage Scenarios)", function () {
        const scenarios = [
            { 
                name: "Kịch bản 1 (Sideway Market)", 
                deltaBase: 0.02, 
                mImb: 1, 
                mDepth: 1, 
                expectedAlpha: 100 
            },
            { 
                name: "Kịch bản 2 (High Volatility)", 
                deltaBase: 0.1, 
                mImb: 1, 
                mDepth: 1, 
                expectedAlpha: 20 
            },
            { 
                name: "Kịch bản 3 (V2 Baseline)", 
                deltaBase: 0, 
                mImb: 0, 
                mDepth: 0, 
                expectedAlpha: 0 
            }
        ];

        // Expected out theory (không có fee, không trượt giá): 100A = 50B do tỷ lệ 2:1
        const expectedOut = ethers.parseEther("50"); 
        
        let snapshotId: any;

        it("Nên thực thi 3 kịch bản thị trường và so sánh Slippage", async function () {
            console.log("\n================ KẾT QUẢ NGHIÊN CỨU TRƯỢT GIÁ (SLIPPAGE) ================");
            console.log("Pool Reserve : 100,000 Token A - 50,000 Token B (Tỷ lệ 2:1)");
            console.log("Giao dịch    : Swap 100 Token A -> lấy Token B");
            console.log(`Kỳ vọng lý tưởng: ${ethers.formatEther(expectedOut)} Token B (Chưa tính fee)`);
            console.log("-------------------------------------------------------------------------");

            for (const s of scenarios) {
                // Tạo snapshot state blockchain trước khi swap để pool luôn ở trạng thái gốc
                snapshotId = await ethers.provider.send("evm_snapshot", []);

                let alpha = s.name.includes("V2 Baseline") 
                    ? 0 
                    : calculateAlpha(calculateDeltaFinal(s.deltaBase, s.mImb, s.mDepth));

                expect(alpha).to.equal(s.expectedAlpha);

                const deadline = Math.floor(Date.now() / 1000) + 3600;

                // Cấu hình EIP-712 cho OSVAPool
                const domain = {
                    name: "OSVA_Protocol",
                    version: "1.0",
                    chainId: (await ethers.provider.getNetwork()).chainId,
                    verifyingContract: await osvaPool.getAddress()
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

                const value = {
                    user: user.address,
                    tokenIn: await tokenA.getAddress(),
                    amountIn: AMOUNT_IN,
                    alpha: alpha,
                    deadline: deadline
                };

                // Oracle Signer (Backend Java) ký xác nhận giao dịch
                const signature = await oracleSigner.signTypedData(domain, types, value);

                // Thực thi Swap
                const tx = await osvaPool.connect(user).swapOSVA(
                    await tokenA.getAddress(),
                    AMOUNT_IN,
                    0n,
                    alpha,
                    deadline,
                    signature
                );
                const receipt = await tx.wait();

                // Lọc sự kiện Swap để lấy số lượng Token B thực nhận
                const event = receipt.logs.find((log: any) => {
                    try {
                        const parsed = osvaPool.interface.parseLog(log);
                        return parsed?.name === "Swap";
                    } catch (e) {
                        return false;
                    }
                });

                const parsedEvent = osvaPool.interface.parseLog(event);
                const actualOut = parsedEvent.args.amountOut;

                // Tính toán phần trăm trượt giá
                const slippagePercent = calculateSlippage(expectedOut, actualOut);

                console.log(`\n🔹 ${s.name}`);
                console.log(`   - Hệ số Alpha   : ${alpha}`);
                console.log(`   - Thực nhận     : ${ethers.formatEther(actualOut)} Token B`);
                console.log(`   - Trượt giá (%) : ${slippagePercent.toFixed(4)} %`);

                // Hoàn tác state để test kịch bản tiếp theo với pool nguyên vẹn
                await ethers.provider.send("evm_revert", [snapshotId]);
            }
            console.log("\n=========================================================================\n");
        });
    });
});
