import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-chai-matchers";
import "hardhat-gas-reporter";
import * as dotenv from "dotenv";

// Khởi tạo dotenv để đọc file .env
dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun"
    }
  },
  networks: {
    sepolia: {
      // Dùng toán tử "||" để tránh lỗi undefined nếu file .env chưa có giá trị
      url: process.env.RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    reportFormat: "terminal",
    excludeContracts: ["MockERC20", "MockVault"],
  },
};

export default config;