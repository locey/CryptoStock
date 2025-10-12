const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { ethers } = require("hardhat");
const { expect } = require("chai");

describe('Airdrop', function () {

    let airdrop;
    let mockERC20;
    let owner, user1, user2, user3;
    const taskIdRewardMap = { 1: ethers.parseEther("100"), 2: ethers.parseEther("200"), 3: ethers.parseEther("0.001") };
    //从taskIdRewardMap获取taskIds
    const taskIds = Object.keys(taskIdRewardMap).map(id => parseInt(id));

    before(async function () {
        //构造默克尔树
        [owner, user1, user2, user3] = await ethers.getSigners();
        console.log("📋 部署前准备:");

        const merkleRoots = taskIds.map((taskId, index) => {
            const leaf = ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user1.address, taskIdRewardMap[taskIds[index]], taskId]
            ));
            console.log(`   🌳 为任务 ${taskId} 生成叶子节点: ${leaf}`);

            const tree = new MerkleTree([leaf], keccak256, { sort: true });
            const root = tree.getHexRoot();
            console.log(`   🔑 为任务 ${taskId} 生成默克尔根: ${root}`);
            return root;
        });
        //部署MockERC20
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        mockERC20 = await MockERC20.deploy("MockERC20", "MOCK", 18);
        await mockERC20.waitForDeployment();
        const mockERC20Address = await mockERC20.getAddress();
        const Airdrop = await ethers.getContractFactory('Airdrop');
        airdrop = await Airdrop.deploy(mockERC20Address, taskIds, merkleRoots);
        await airdrop.waitForDeployment();
        console.log('✅ Airdrop 合约已部署到:', await airdrop.getAddress());
    });

    //设置任务奖励
    it('Should set reward', async function () {
        console.log("💰 设置任务奖励:");

        await airdrop.setReward(taskIds, taskIds.map(id => taskIdRewardMap[id]));

        for (let i = 0; i < taskIds.length; i++) {
            const taskId = taskIds[i];
            const reward = taskIdRewardMap[taskId];
            const taskReward = await airdrop.getReward(taskId);
            expect(taskReward).to.equal(reward);
            console.log(`   📊 任务${taskId}的奖励为${ethers.formatEther(reward)} CST`);
        }
    });

    //设置任务 merkleRoot
    it('Should set merkleRoot', async function () {
        console.log("🔐 设置用户默克尔根:");

        const merkleRoots = taskIds.map((taskId, index) => {
            //user1和user2两个叶子节点
            const leaves = [
                ethers.keccak256(ethers.solidityPacked(
                    ["address", "uint256", "uint256"],
                    [user1.address, taskIdRewardMap[taskId], taskId]
                )),
                ethers.keccak256(ethers.solidityPacked(
                    ["address", "uint256", "uint256"],
                    [user2.address, taskIdRewardMap[taskId], taskId]
                ))
            ]
            const leaf = ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user1.address, taskIdRewardMap[taskId], taskId]
            ));
            console.log(`   🌳 为用户 ${user1.address} 任务 ${taskId} 生成叶子节点: ${leaves}`);

            const tree = new MerkleTree(leaves, keccak256, { sort: true });
            const root = tree.getHexRoot();
            console.log(`   🔑 为用户 ${user1.address} 任务 ${taskId} 生成默克尔根: ${root}`);
            return root;
        });

        await airdrop.connect(user1).setMerkleRoot(taskIds, merkleRoots);

        const taskMerkleRoot = await airdrop.connect(user1).getMerkleRoot(taskIds[0]);
        expect(taskMerkleRoot).to.equal(merkleRoots[0]);
        console.log(`   ✅ 用户 ${user1.address} 任务${taskIds[0]}的merkleRoot为 ${taskMerkleRoot}`);
    });

    //领取奖励
    it('Should claim reward', async function () {
        console.log("🎁 开始领取奖励:");

        // 为 user1 构造叶子节点（与before中部署时使用的地址一致）
        const leaf = ethers.keccak256(ethers.solidityPacked(
            ["address", "uint256", "uint256"],
            [user1.address, taskIdRewardMap[taskIds[0]], taskIds[0]]
        ));
        const leaves = [
            ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user1.address, taskIdRewardMap[taskIds[0]], taskIds[0]]
            )),
            ethers.keccak256(ethers.solidityPacked(
                ["address", "uint256", "uint256"],
                [user2.address, taskIdRewardMap[taskIds[0]], taskIds[0]]
            ))
        ]
        console.log(`   🌳 构造叶子节点: ${leaf}`);

        // 创建默克尔树并获取证明（与before中使用的相同数据）
        const tree = new MerkleTree(leaves, keccak256, { sort: true });
        const proof = tree.getHexProof(leaf);
        console.log(`   📜 获取默克尔证明:`, proof);

        // 使用user1调用claim（与叶子节点中的地址一致）
        console.log(`   💸 用户 ${user1.address} 尝试领取任务 ${taskIds[0]} 的奖励...`);
        await airdrop.connect(user1).claim(taskIds[0], taskIdRewardMap[taskIds[0]], proof);
        expect(await mockERC20.balanceOf(user1.address)).to.equal(taskIdRewardMap[taskIds[0]]);

        console.log(`   ✅ 用户 ${user1.address} 成功领取任务 ${taskIds[0]} 的奖励: ${ethers.formatEther(taskIdRewardMap[taskIds[0]])} CST`);

        // 测试错误情况
        console.log(`   ⚠️  测试错误情况 - 尝试用错误的奖励金额领取任务 ${taskIds[1]}...`);
        await airdrop.connect(user1).claim(taskIds[1], taskIdRewardMap[taskIds[0]], proof)
            .then(() => {
                throw new Error("预期应该失败");
            })
            .catch((error) => {
                expect(error.message).to.include(`提取的奖励等于应得奖励`);
                console.log(`   ✅ 正确捕获错误: ${error.message}`);
            });

        console.log(`🎉 最终用户 ${user1.address} 余额: ${ethers.formatEther(await mockERC20.balanceOf(user1.address))} CST`);
    });
});