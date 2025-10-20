// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "./mock/MockERC20.sol";

contract AirdropUpgradeable is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    MockERC20 public token;

    // 不可变的默克尔根
    mapping(uint256 => bytes32) public merkleRootMap;

    // 账户的空投Claim状态
    mapping(uint256 => mapping(uint256 => mapping(address => bool)))
        public claimStatus;
    // 合约版本
    uint256 public version;

    // 空投暂停状态
    bool public paused;

    // 空投Claim事件
    event AirDropClaim(
        address indexed user,
        uint256 indexed batchId,
        uint256 indexed taskId,
        uint256 amount
    );

    // 暂停状态切换事件
    event PausedStateChanged(bool paused);

    // 升级事件
    event Upgraded(address indexed implementation, uint256 version);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        token = MockERC20(_token);
        version = 1;
        paused = false;
    }

    modifier whenNotPaused() {
        require(!paused, "Airdrop: contract is paused");
        _;
    }

    /**
     * @dev 设置任务 merkleRoot
     * @param taskIds 任务ID数组
     * @param merkleRoots 对应的默克尔根数组
     */
    function setMerkleRoot(
        uint256[] calldata taskIds,
        bytes32[] calldata merkleRoots
    ) external onlyOwner {
        require(
            taskIds.length == merkleRoots.length,
            "Airdrop: array length mismatch"
        );

        for (uint256 i = 0; i < taskIds.length; i++) {
            merkleRootMap[taskIds[i]] = merkleRoots[i];
        }
    }

    /**
     * @dev 获取任务 merkleRoot
     * @param taskId 任务ID
     * @return 对应的默克尔根
     */
    function getMerkleRoot(uint256 taskId) public view returns (bytes32) {
        return merkleRootMap[taskId];
    }

    //空投提现
    function claim(
        uint256 batchId,
        uint256 taskId,
        uint256 amount,
        bytes32[] memory merkleProof
    ) public whenNotPaused nonReentrant {
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

    /**
     * @dev 切换暂停状态
     * @param _paused 新的暂停状态
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedStateChanged(_paused);
    }

    /**
     * @dev 获取用户对特定任务的领取状态
     * @param taskId 任务ID
     * @param user 用户地址
     * @return 是否已领取
     */
    function hasClaimed(
        uint256 batchId,
        uint256 taskId,
        address user
    ) external view returns (bool) {
        return claimStatus[batchId][taskId][user];
    }

    /**
     * @dev 升级合约实现
     * @param newImplementation 新的实现合约地址
     */
    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {
        version++;
        emit Upgraded(newImplementation, version);
    }
}
