const { ethers } = require("hardhat");

async function testSigners() {
  try {
    console.log("🔍 测试签名者获取...");
    const signers = await ethers.getSigners();
    console.log(`✅ 获取到 ${signers.length} 个签名者`);
    
    for (let i = 0; i < Math.min(signers.length, 5); i++) {
      console.log(`   签名者 ${i}: ${signers[i].address}`);
      const balance = await signers[i].getBalance();
      console.log(`   余额: ${ethers.utils.formatEther(balance)} ETH`);
    }
  } catch (error) {
    console.error("❌ 获取签名者失败:", error.message);
  }
}

testSigners();