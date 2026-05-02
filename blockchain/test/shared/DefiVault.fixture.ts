import { ethers } from "hardhat";

export async function deployDefiVaultFixture() {
  const [owner, user1, user2] = await ethers.getSigners();

  // Deploy underlying token
  const Token = await ethers.getContractFactory("Token");
  const token = await Token.deploy(owner.address);

  // Give some tokens to users
  const mintAmount = ethers.parseEther("1000000");
  await token.mint(user1.address, mintAmount);
  await token.mint(user2.address, mintAmount);

  // Deploy DefiVault contract
  const tokenAddress = await token.getAddress();
  const DefiVaultFactory = await ethers.getContractFactory("DefiVault");
  const defiVault = await DefiVaultFactory.deploy(tokenAddress);
  const vaultAddress = await defiVault.getAddress();

  return { defiVault, token, vaultAddress, tokenAddress, owner, user1, user2 };
}
