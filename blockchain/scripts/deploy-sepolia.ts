import { ethers } from "hardhat";

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  const MyContract = await ethers.getContractFactory("MyContract");
  const myContract = await MyContract.deploy("Hello Testnet");
  await myContract.deployed();

  console.log("Contract deployed to:", myContract.address);
}

main()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error(err);
    process.exit(1);
  });