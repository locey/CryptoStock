// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./MockERC20.sol";

contract Airdrop {
    MockERC20 token;
    //不可变的默克尔根
    mapping(uint256 => bytes32) public merkleRootMap;
    //账户的空投Claim状态
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))
        public claimStatus;

    //空投Claim事件
    event AirDropClaim(
        address indexed user,
        uint256 indexed batchId,
        uint256 indexed taskId,
        uint256 amount
    );

    //构造函数
    constructor(
        address _token,
        uint256[] memory batchIds,
        uint256[] memory merkleRoots
    ) {
        token = MockERC20(_token);
        for (uint256 i = 0; i < batchIds.length; i++) {
            merkleRootMap[batchIds[i]] = bytes32(merkleRoots[i]);
        }
    }

    //设置任务 merkleRoot（链下计算merkleRoot）
    function setMerkleRoot(
        uint256[] calldata batchIds,
        bytes32[] calldata merkleRoots
    ) public {
        for (uint256 i = 0; i < batchIds.length; i++) {
            merkleRootMap[batchIds[i]] = merkleRoots[i];
        }
    }

    //获取任务 merkleRoot
    function getMerkleRoot(uint256 batchId) public view returns (bytes32) {
        return merkleRootMap[batchId];
    }

    //空投提现
    function claim(
        uint256 batchId,
        uint256 taskId,
        uint256 amount,
        bytes32[] memory merkleProof
    ) public {
        require(merkleRootMap[batchId] != 0, "Task not found");
        require(!claimStatus[batchId][taskId][msg.sender], "Already claimed");
        require(amount > 0, unicode"不合法的奖励大小");

        bytes32 leaf = keccak256(
            abi.encodePacked(msg.sender, amount, batchId, taskId)
        );
        require(
            MerkleProof.verify(merkleProof, merkleRootMap[batchId], leaf),
            "Invalid proof"
        );
        claimStatus[batchId][taskId][msg.sender] = true;
        token.mint(msg.sender, amount);
        emit AirDropClaim(msg.sender, batchId, taskId, amount);
    }
}
