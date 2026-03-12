import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy Tokens
  const Token = await ethers.getContractFactory("Token");
  
  const tokenGLD = await Token.deploy(deployer.address);
  await tokenGLD.waitForDeployment();
  const addressGLD = await tokenGLD.getAddress();
  console.log("Token 1 (used as GLD) deployed to:", addressGLD);

  const tokenSLV = await Token.deploy(deployer.address);
  await tokenSLV.waitForDeployment();
  const addressSLV = await tokenSLV.getAddress();
  console.log("Token 2 (used as SLV) deployed to:", addressSLV);

  // 2. Deploy SimpleAMM
  const SimpleAMM = await ethers.getContractFactory("SimpleAMM");
  const amm = await SimpleAMM.deploy(addressGLD, addressSLV);
  await amm.waitForDeployment();
  const addressAMM = await amm.getAddress();
  console.log("SimpleAMM deployed to:", addressAMM);

  // 3. Mint some initial tokens to deployer for testing
  const mintAmount = ethers.parseUnits("10000", 18); // 10,000 tokens
  await tokenGLD.mint(deployer.address, mintAmount);
  await tokenSLV.mint(deployer.address, mintAmount);
  console.log(`Minted 10000 GLD and 10000 SLV to ${deployer.address}`);

  // 4. (Optional) Provide Initial Liquidity to the Pool
  const liquidityGLD = ethers.parseUnits("1000", 18);
  const liquiditySLV = ethers.parseUnits("1000", 18);

  // Approve AMM to spend deployer's tokens
  await tokenGLD.approve(addressAMM, liquidityGLD);
  await tokenSLV.approve(addressAMM, liquiditySLV);

  console.log("Adding initial liquidity (1000 GLD + 1000 SLV)...");
  await amm.addLiquidity(liquidityGLD, liquiditySLV);
  
  const reserveGLD = await amm.reserve0();
  const reserveSLV = await amm.reserve1();
  console.log(`Liquidity Added. Pool Reserves -> GLD: ${ethers.formatUnits(reserveGLD, 18)}, SLV: ${ethers.formatUnits(reserveSLV, 18)}`);
  
  console.log("Deployment and setup complete!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
