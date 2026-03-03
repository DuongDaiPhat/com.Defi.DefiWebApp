import hre from "hardhat";
import { deployContracts } from "./deploy-contract";
import { ethers } from "ethers";

async function demo(): Promise<void> {
  const {
    token: tokenAddress,
    wallet: walletAddress,
    transfer: transferAddress,
    deployer,
  } = await deployContracts();

  const [_, user1, user2] = await hre.ethers.getSigners();

  const Token = await hre.ethers.getContractFactory("MyToken");
  const token = Token.attach(tokenAddress);

  const Transfer = await hre.ethers.getContractFactory("Transfer");
  const transfer = Transfer.attach(transferAddress);

  const format = (value: bigint): string => hre.ethers.formatUnits(value, 18);
  const parse = (value: string): bigint => hre.ethers.parseUnits(value, 18);

  async function showBalances(title: string): Promise<void> {
    console.log(`\n${title}`);
    console.log("Deployer:", format(await token.balanceOf(deployer.address)));
    console.log("User1   :", format(await token.balanceOf(user1.address)));
    console.log("User2   :", format(await token.balanceOf(user2.address)));
  }

  async function checkBalance(
    user: Awaited<ReturnType<typeof hre.ethers.getSigner>>,
    amount: bigint
  ): Promise<void> {
    const balance: bigint = await token.balanceOf(user.address);
    if (balance < amount) {
      throw new Error("Không đủ số dư");
    }
    console.log("\nuser đủ khả năng để gửi", format(amount), "tokens");
  }

  async function checkAllowance(
    owner: Awaited<ReturnType<typeof hre.ethers.getSigner>>,
    spender: string,
    amount: bigint
  ): Promise<void> {
    const allowance: bigint = await token.allowance(owner.address, spender);
    console.log("Allowance:", format(allowance));
    if (allowance < amount) {
      throw new Error("Not allowance");
    }
    console.log("Check allowance ok");
  }

  await showBalances("Khởi tạo số dư token");

  // chuyển token từ deployer → user1
  let tx = await token.transfer(user1.address, parse("100"));
  await tx.wait();
  console.log("\nDeployer gửi 100 tokens cho User1");

  await showBalances("Sau khi gửi token cho user1");

  // check balance user1
  const amount = parse("50");
  await checkBalance(user1, amount);

  // cấp quyền cho Transfer contract
  const tokenUser1 = token.connect(user1);
  tx = await tokenUser1.approve(transferAddress, amount);
  await tx.wait();
  console.log(`user1 approved ${format(amount)} tokens`);

  await checkAllowance(user1, transferAddress, amount);

  // transferToken từ user1 → user2
  const transferUser1 = transfer.connect(user1);
  tx = await transferUser1.transferToken(user2.address, amount);
  await tx.wait();
  console.log(`user1 gửi ${format(amount)} tokens cho user2`);

  await showBalances("Sau khi transferToken từ user1 → user2");

  // Thu hồi quyền
  tx = await tokenUser1.approve(transferAddress, 0);
  await tx.wait();
  console.log("Thu hôi quyền user1");

  await checkAllowance(user1, transferAddress, 0n);

  // Lấy lịch sử chuyển token
  console.log("\nLịch sử chuyển token:");
  const events = await transfer.queryFilter("TransferHistory");
  events.forEach((e) => {
    console.log({
      from: e.args.from,
      to: e.args.to,
      amount: hre.ethers.formatUnits(e.args.amount, 18),
      time: new Date(Number(e.args.timestamp) * 1000).toLocaleString(),
    });
  });
}

demo().catch(console.error);