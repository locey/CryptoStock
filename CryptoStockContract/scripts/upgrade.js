// scripts/upgrade.js
const { ethers, upgrades } = require("hardhat");

async function main() {
  const proxyAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"; // 替换为实际的代理合约地址
  
  console.log("Preparing to upgrade AirdropUpgradeable contract...");
  
  // 获取新的合约工厂
  const AirdropUpgradeableV2 = await ethers.getContractFactory("AirdropUpgradeable");
  
  // 执行升级
  const airdrop = await upgrades.upgradeProxy(proxyAddress, AirdropUpgradeableV2);
  
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log("AirdropUpgradeable upgraded at:", proxyAddress);
  console.log("New implementation address:", implementationAddress);
  
  // 验证新实现合约
  try {
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: []
    });
    console.log("New implementation verified successfully");
  } catch (error) {
    console.log("Verification failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });