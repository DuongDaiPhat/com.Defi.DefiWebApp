import hre from "hardhat";

interface DeployResult {
  token: string;
  wallet: string;
  transfer: string;
  deployer: Awaited<ReturnType<typeof hre.ethers.getSigner>>;
}

async function deployContracts(): Promise<DeployResult> {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy Token
  const Token = await hre.ethers.getContractFactory("MyToken");
  const token = await Token.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("Token deployed at:", tokenAddress);

  // Deploy Wallet
  const Wallet = await hre.ethers.getContractFactory("Wallet");
  const wallet = await Wallet.deploy(tokenAddress);
  await wallet.waitForDeployment();
  const walletAddress = await wallet.getAddress();
  console.log("Wallet deployed at:", walletAddress);

  // Deploy Transfer
  const Transfer = await hre.ethers.getContractFactory("Transfer");
  const transfer = await Transfer.deploy(tokenAddress);
  await transfer.waitForDeployment();
  const transferAddress = await transfer.getAddress();
  console.log("Transfer deployed at:", transferAddress);

  return { token: tokenAddress, wallet: walletAddress, transfer: transferAddress, deployer };
}

export { deployContracts };