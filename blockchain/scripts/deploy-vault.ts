import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy the underlying Token (assume new SKT token for this testnet deploy)
  const Token = await ethers.getContractFactory("Token");
  // Assuming Token constructor needs an initialOwner
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("Token (SKT) deployed to:", tokenAddress);

  // 2. Deploy the DefiVault contract
  const DefiVault = await ethers.getContractFactory("DefiVault");
  const DefiVault = await DefiVault.deploy(tokenAddress);
  await DefiVault.waitForDeployment();
  const withdrawAddress = await DefiVault.getAddress();
  console.log("DefiVault deployed to:", withdrawAddress);

  console.log("==========================================");
  console.log("Deployment successful!");
  console.log(`Underlying Asset: ${tokenAddress}`);
  console.log(`Withdraw Contract: ${withdrawAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });
