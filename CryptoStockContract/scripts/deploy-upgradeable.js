// scripts/deploy-upgradeable.js
const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying AirdropUpgradeable contract...");

  // 获取合约工厂
  const AirdropUpgradeable = await ethers.getContractFactory("AirdropUpgradeable");
  
  // 部署可升级合约
  const airdrop = await upgrades.deployProxy(AirdropUpgradeable, [
    "0x5FbDB2315678afecb367f032d93F642f64180aa3" // MockERC20地址，实际部署时需要替换
  ], {
    initializer: 'initialize',
    kind: 'uups'
  });

  await airdrop.waitForDeployment();
  
  const proxyAddress = await airdrop.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  
  console.log("AirdropUpgradeable deployed to:", proxyAddress);
  console.log("Implementation address:", implementationAddress);
  
  // 验证合约
  try {
    await run("verify:verify", {
      address: implementationAddress,
      constructorArguments: []
    });
    console.log("Implementation verified successfully");
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