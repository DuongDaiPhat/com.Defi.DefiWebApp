// Mute TypeScript warnings for JSON imports if not enabled in tsconfig
import DefiVaultMetadata from "./src/abi/DefiVault.json";

// We extract just the `.abi` array from the Hardhat artifact JSON
export const DefiVaultABI = DefiVaultMetadata.abi;

// You can add addresses here after deployment, e.g.
export const CONTRACT_ADDRESSES = {
  // sepolia: "0x123..."
};
