const { ethers } = require("hardhat");

async function main() {
  const [deployer, user1, user2] = await ethers.getSigners();
  
  console.log("🚀 MetaNodeStake Interaction Script");
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);

  // 获取合约实例
  const metaNodeStakeAddress = process.env.METANODE_STAKE_ADDRESS || 
    (await deployments.get("MetaNodeStake")).address;
  
  const metaNodeStake = await ethers.getContractAt("MetaNodeStake", metaNodeStakeAddress);
  const metaNodeTokenAddress = await metaNodeStake.MetaNode();
  const metaNodeToken = await ethers.getContractAt("MockERC20", metaNodeTokenAddress);

  console.log("MetaNodeStake Address:", metaNodeStakeAddress);
  console.log("MetaNode Token Address:", metaNodeTokenAddress);

  // 显示当前状态
  console.log("\n📊 Current Status:");
  const startBlock = await metaNodeStake.startBlock();
  const endBlock = await metaNodeStake.endBlock();
  const metaNodePerBlock = await metaNodeStake.MetaNodePerBlock();
  const currentBlock = await ethers.provider.getBlockNumber();
  
  console.log("Start Block:", startBlock.toString());
  console.log("End Block:", endBlock.toString());
  console.log("Current Block:", currentBlock);
  console.log("MetaNode Per Block:", ethers.formatEther(metaNodePerBlock));

  // ETH 质押示例
  console.log("\n💰 ETH Staking Example:");
  const ethStakeAmount = ethers.parseEther("0.1");
  
  try {
    // 用户1质押ETH
    const tx1 = await metaNodeStake.connect(user1).depositETH({ value: ethStakeAmount });
    await tx1.wait();
    console.log("✅ User1 staked", ethers.formatEther(ethStakeAmount), "ETH");

    // 检查质押余额
    const user1Balance = await metaNodeStake.stakingBalance(0, user1.address);
    console.log("User1 ETH staking balance:", ethers.formatEther(user1Balance));

    // 挖一些区块来产生奖励
    console.log("⛏️ Mining 10 blocks to generate rewards...");
    await ethers.provider.send("hardhat_mine", ["0xa"]); // 挖10个区块

    // 检查待领取奖励
    const pendingReward = await metaNodeStake.pendingMetaNode(0, user1.address);
    console.log("User1 pending rewards:", ethers.formatEther(pendingReward), "META");

    // 领取奖励
    if (pendingReward > 0) {
      const claimTx = await metaNodeStake.connect(user1).claim(0);
      await claimTx.wait();
      console.log("✅ User1 claimed rewards");
      
      const metaBalance = await metaNodeToken.balanceOf(user1.address);
      console.log("User1 META token balance:", ethers.formatEther(metaBalance));
    }

  } catch (error) {
    console.log("❌ Error in ETH staking:", error.message);
  }

  // 显示最终状态
  console.log("\n📈 Final Status:");
  const poolLength = await metaNodeStake.poolLength();
  for (let i = 0; i < poolLength; i++) {
    const pool = await metaNodeStake.pool(i);
    console.log(`Pool ${i} total staked:`, ethers.formatEther(pool.stTokenAmount));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
