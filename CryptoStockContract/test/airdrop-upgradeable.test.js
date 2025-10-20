const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("AirdropUpgradeable", function () {
    let airdrop;
    let mockERC20;
    let owner, user1, user2, user3;
    const taskIdRewardMap = { 1: ethers.parseEther("100"), 2: ethers.parseEther("200"), 3: ethers.parseEther("0.001") };
    const taskIds = Object.keys(taskIdRewardMap).map(id => parseInt(id));

    before(async function () {
        [owner, user1, user2, user3] = await ethers.getSigners();
        console.log("📋 部署前准备:");

        // 部署MockERC20
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        mockERC20 = await MockERC20.deploy("Mock Token", "MTK");
        await mockERC20.waitForDeployment();
        console.log("   🪙 MockERC20已部署:", await mockERC20.getAddress());

        // 部署可升级的Airdrop合约
        const AirdropUpgradeable = await ethers.getContractFactory("AirdropUpgradeable");
        airdrop = await upgrades.deployProxy(AirdropUpgradeable, [await mockERC20.getAddress()], {
            initializer: 'initialize'
        });
        await airdrop.waitForDeployment();
        console.log("   📄 AirdropUpgradeable已部署:", await airdrop.getAddress());

        // 获取实现地址
        const implementationAddress = await upgrades.erc1967.getImplementationAddress(await airdrop.getAddress());
        console.log("   🔧 实现合约地址:", implementationAddress);
    });

    it("应该正确设置和获取版本号", async function () {
        const version = await airdrop.version();
        expect(version).to.equal(1n);
    });

    it("应该正确设置和获取合约所有者", async function () {
        const contractOwner = await airdrop.owner();
        expect(contractOwner).to.equal(owner.address);
    });

    it("应该正确设置和获取暂停状态", async function () {
        // 默认不应暂停
        expect(await airdrop.paused()).to.equal(false);

        // 暂停合约
        await airdrop.connect(owner).setPaused(true);
        expect(await airdrop.paused()).to.equal(true);

        // 恢复合约
        await airdrop.connect(owner).setPaused(false);
        expect(await airdrop.paused()).to.equal(false);
    });

    it("非所有者不能暂停合约", async function () {
        await expect(airdrop.connect(user1).setPaused(true))
            .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("应该正确设置和获取Merkle Root", async function () {
        console.log("🔐 设置用户默克尔根:");

        // 为每个任务生成Merkle Root
        const merkleRoots = taskIds.map((taskId) => {
            // 为user1和user2生成叶子节点
            const leaves = [
                ethers.keccak256(ethers.solidityPacked(
                    ["address", "uint256", "uint256"],
                    [user1.address, taskIdRewardMap[taskId], taskId]
                )),
                ethers.keccak256(ethers.solidityPacked(
                    ["address", "uint256", "uint256"],
                    [user2.address, taskIdRewardMap[taskId], taskId]
                ))
            ];

            const tree = new MerkleTree(leaves, keccak256, { sort: true });
            const root = tree.getHexRoot();
            console.log(`   🌳 为任务 ${taskId} 生成默克尔根: ${root}`);
            return root;
        });

        // 设置Merkle Root
        await airdrop.connect(owner).setMerkleRoot(taskIds, merkleRoots);

        // 验证Merkle Root是否设置成功
        const taskMerkleRoot = await airdrop.connect(user1).getMerkleRoot(taskIds[0]);
        expect(taskMerkleRoot).to.equal(merkleRoots[0]);
        console.log(`   ✅ 用户 ${user1.address} 任务${taskIds[0]}的merkleRoot为 ${taskMerkleRoot}`);
    });

    it("应该正确设置和获取奖励", async function () {
        // 设置奖励
        const amounts = taskIds.map(taskId => taskIdRewardMap[taskId]);
        await airdrop.connect(owner).setReward(taskIds, amounts);

        // 验证奖励是否设置成功
        const reward = await airdrop.connect(user1).getReward(taskIds[0]);
        expect(reward).to.equal(amounts[0]);
        console.log(`   💰 任务${taskIds[0]}的奖励为 ${ethers.formatEther(reward)} MTK`);
    });

    it("应该允许用户领取奖励", async function () {
        console.log("🎁 开始领取奖励:");

        // 选择任务1进行测试
        const taskId = taskIds[0];
        const rewardAmount = taskIdRewardMap[taskId];

        // 为 user1 构造叶子节点
        const leaf = ethers.keccak256(ethers.solidityPacked(
            ["address", "uint256", "uint256"],
            [user1.address, rewardAmount, taskId]
        ));

        // user1和user2两个叶子节点
        const leaves = [
            ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user1.address, rewardAmount, taskId]
            )),
            ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user2.address, rewardAmount, taskId]
            ))
        ];

        console.log(`   🌳 构造叶子节点: ${leaf}`);

        // 创建默克尔树并获取证明
        const tree = new MerkleTree(leaves, keccak256, { sort: true });
        const proof = tree.getHexProof(leaf);
        console.log(`   📜 获取默克尔证明:`, proof);

        // 领取奖励前检查用户余额
        const balanceBefore = await mockERC20.balanceOf(user1.address);
        console.log(`   💼 领取前余额: ${ethers.formatEther(balanceBefore)} MTK`);

        // 领取奖励
        await airdrop.connect(user1).claim(taskId, rewardAmount, proof);

        // 领取奖励后检查用户余额
        const balanceAfter = await mockERC20.balanceOf(user1.address);
        console.log(`   💼 领取后余额: ${ethers.formatEther(balanceAfter)} MTK`);

        // 验证余额变化
        expect(balanceAfter - balanceBefore).to.equal(rewardAmount);

        // 验证领取状态
        expect(await airdrop.hasClaimed(taskId, user1.address)).to.equal(true);

        // 尝试再次领取应该失败
        await expect(airdrop.connect(user1).claim(taskId, rewardAmount, proof))
            .to.be.revertedWith("Airdrop: Already claimed");
    });

    it("应该在合约暂停时阻止领取", async function () {
        // 暂停合约
        await airdrop.connect(owner).setPaused(true);
        
        // 尝试领取应该失败
        const taskId = taskIds[1];
        const rewardAmount = taskIdRewardMap[taskId];
        
        // 构造user2的证明
        const leaves = [
            ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user1.address, rewardAmount, taskId]
            )),
            ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user2.address, rewardAmount, taskId]
            ))
        ];
        
        const leaf = ethers.keccak256(ethers.solidityPacked(
            ["address", "uint256", "uint256"],
            [user2.address, rewardAmount, taskId]
        ));
        
        const tree = new MerkleTree(leaves, keccak256, { sort: true });
        const proof = tree.getHexProof(leaf);
        
        await expect(airdrop.connect(user2).claim(taskId, rewardAmount, proof))
            .to.be.revertedWith("Airdrop: contract is paused");
            
        // 恢复合约
        await airdrop.connect(owner).setPaused(false);
    });

    it("应该可以升级合约", async function () {
        // 获取升级前的版本
        const versionBefore = await airdrop.version();
        
        // 获取当前实现地址
        const implementationAddressBefore = await upgrades.erc1967.getImplementationAddress(await airdrop.getAddress());
        
        // 重新部署实现合约（模拟升级）
        const AirdropUpgradeableV2 = await ethers.getContractFactory("AirdropUpgradeable");
        const upgradedAirdrop = await upgrades.upgradeProxy(await airdrop.getAddress(), AirdropUpgradeableV2);
        
        // 获取升级后的版本
        const versionAfter = await upgradedAirdrop.version();
        
        // 获取升级后的实现地址
        const implementationAddressAfter = await upgrades.erc1967.getImplementationAddress(await upgradedAirdrop.getAddress());
        
        // 验证升级成功
        expect(versionAfter).to.equal(versionBefore + 1n);
        expect(implementationAddressBefore).to.not.equal(implementationAddressAfter);
        
        console.log(`   🔧 合约已升级: v${versionBefore} -> v${versionAfter}`);
        console.log(`   🔧 新实现地址: ${implementationAddressAfter}`);
    });
});