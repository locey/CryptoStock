// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "../contracts/mock/MockERC20.sol";

contract Airdrop {
    MockERC20 token;
    //不可变的默克尔根
    mapping(uint256 => mapping(address => bytes32)) public merkleRootMap;
    //任务ID对应的奖励数量
    mapping(uint256 => uint256) public rewardMap;
    //账户的空投Claim状态
    mapping(uint256 => mapping(address => bool)) public claimStatus;

    //空投Claim事件
    event AirDropClaim(
        address indexed user,
        uint256 indexed taskId,
        uint256 amount
    );

    //构造函数
    constructor(
        address _token,
        uint256[] memory taskIds,
        uint256[] memory merkleRoots
    ) {
        token = MockERC20(_token);
        for (uint256 i = 0; i < taskIds.length; i++) {
            merkleRootMap[taskIds[i]][msg.sender] = bytes32(merkleRoots[i]);
        }
    }

    //设置任务 merkleRoot（链下计算merkleRoot）
    function setMerkleRoot(
        uint256[] calldata taskIds,
        bytes32[] calldata merkleRoots
    ) public {
        for (uint256 i = 0; i < taskIds.length; i++) {
            merkleRootMap[taskIds[i]][msg.sender] = merkleRoots[i];
        }
    }

    //获取任务 merkleRoot
    function getMerkleRoot(uint256 taskId) public view returns (bytes32) {
        return merkleRootMap[taskId][msg.sender];
    }

    //设置任务奖励数量
    function setReward(
        uint256[] calldata taskIds,
        uint256[] calldata amounts
    ) public {
        for (uint256 i = 0; i < taskIds.length; i++) {
            rewardMap[taskIds[i]] = amounts[i];
        }
    }

    //获取任务奖励数量
    function getReward(uint256 taskId) public view returns (uint256) {
        return rewardMap[taskId];
    }

    //空投提现
    function claim(
        uint256 taskId,
        uint256 amount,
        bytes32[] memory merkleProof
    ) public {
        require(merkleRootMap[taskId][msg.sender] != 0, "Task not found");
        require(!claimStatus[taskId][msg.sender], "Already claimed");
        require(amount > 0, unicode"不合法的奖励大小");
        require(rewardMap[taskId] == amount, unicode"提取的奖励等于应得奖励");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount, taskId));
        require(
            MerkleProof.verify(
                merkleProof,
                merkleRootMap[taskId][msg.sender],
                leaf
            ),
            "Invalid proof"
        );
        claimStatus[taskId][msg.sender] = true;
        token.mint(msg.sender, amount);
        emit AirDropClaim(msg.sender, taskId, amount);
    }
}
