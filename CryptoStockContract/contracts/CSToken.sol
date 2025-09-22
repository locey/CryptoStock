// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CSToken - 增强版代币合约
 * @dev 实现ERC20标准，集成Pausable、Ownable和ReentrancyGuard功能
 *
 * 主要功能：
 * 1. 标准ERC20代币功能
 * 2. 暂停/恢复机制
 * 3. 所有权管理
 * 4. 重入攻击保护
 * 5. 铸造和销毁功能
 * 6. 紧急提取功能
 * 7. 批量操作功能
 * 8. 代币元数据管理
 */
contract CSToken is ERC20, Pausable, Ownable, ReentrancyGuard {
    // 代币精度
    uint8 private _decimals;

    // 最大供应量
    uint256 public maxSupply;

    // 是否允许铸造
    bool public mintingEnabled;

    // 是否允许销毁
    bool public burningEnabled;

    // 代币元数据
    string public tokenURI;

    // 事件定义
    event Mint(address indexed to, uint256 amount, string reason);
    event Burn(address indexed from, uint256 amount, string reason);
    event MintingToggled(bool enabled);
    event BurningToggled(bool enabled);
    event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
    event TokenURIUpdated(string oldURI, string newURI);
    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );
    event BatchTransfer(
        address indexed from,
        address[] recipients,
        uint256[] amounts
    );

    /**
     * @dev 构造函数
     * @param name_ 代币名称
     * @param symbol_ 代币符号
     * @param decimals_ 代币精度
     * @param initialSupply_ 初始供应量
     * @param maxSupply_ 最大供应量
     * @param owner_ 合约所有者
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_,
        uint256 maxSupply_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(owner_) {
        require(owner_ != address(0), "CSToken: owner cannot be zero address");
        require(
            initialSupply_ <= maxSupply_,
            "CSToken: initial supply exceeds max supply"
        );
        require(maxSupply_ > 0, "CSToken: max supply must be greater than 0");

        _decimals = decimals_;
        maxSupply = maxSupply_;
        mintingEnabled = true;
        burningEnabled = true;

        // 所有权已在构造函数中设置

        // 铸造初始供应量
        if (initialSupply_ > 0) {
            _mint(owner_, initialSupply_);
            emit Mint(owner_, initialSupply_, "Initial supply");
        }
    }

    /**
     * @dev 返回代币精度
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev 铸造代币
     * @param to 接收地址
     * @param amount 铸造数量
     * @param reason 铸造原因
     */
    function mint(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyOwner whenNotPaused nonReentrant {
        require(mintingEnabled, "CSToken: minting is disabled");
        require(to != address(0), "CSToken: mint to zero address");
        require(amount > 0, "CSToken: amount must be greater than 0");
        require(
            totalSupply() + amount <= maxSupply,
            "CSToken: exceeds max supply"
        );

        _mint(to, amount);
        emit Mint(to, amount, reason);
    }

    /**
     * @dev 批量空投代币（仅拥有者可调用）
     * @param recipients 接收地址数组
     * @param amount 每个地址接收数量
     */
    function airdrop(
        address[] memory recipients,
        uint256 amount,
        string calldata reason
    ) public onlyOwner whenNotPaused nonReentrant {
        require(recipients.length > 0, "No recipients provided");

        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amount);
            emit Mint(recipients[i], amount, reason);
        }
    }

    /**
     * @dev 销毁代币
     * @param from 销毁地址
     * @param amount 销毁数量
     * @param reason 销毁原因
     */
    function burn(
        address from,
        uint256 amount,
        string calldata reason
    ) external onlyOwner whenNotPaused nonReentrant {
        require(burningEnabled, "CSToken: burning is disabled");
        require(from != address(0), "CSToken: burn from zero address");
        require(amount > 0, "CSToken: amount must be greater than 0");
        require(balanceOf(from) >= amount, "CSToken: insufficient balance");

        _burn(from, amount);
        emit Burn(from, amount, reason);
    }

    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 切换铸造功能
     */
    function toggleMinting() external onlyOwner {
        mintingEnabled = !mintingEnabled;
        emit MintingToggled(mintingEnabled);
    }

    /**
     * @dev 切换销毁功能
     */
    function toggleBurning() external onlyOwner {
        burningEnabled = !burningEnabled;
        emit BurningToggled(burningEnabled);
    }

    /**
     * @dev 设置最大供应量
     * @param newMaxSupply 新的最大供应量
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(
            newMaxSupply >= totalSupply(),
            "CSToken: new max supply below current supply"
        );
        uint256 oldMaxSupply = maxSupply;
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(oldMaxSupply, newMaxSupply);
    }

    /**
     * @dev 批量转账
     * @param recipients 接收地址数组
     * @param amounts 转账数量数组
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external whenNotPaused nonReentrant {
        require(
            recipients.length == amounts.length,
            "CSToken: arrays length mismatch"
        );
        require(recipients.length > 0, "CSToken: empty arrays");
        require(recipients.length <= 100, "CSToken: too many recipients");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(
            balanceOf(msg.sender) >= totalAmount,
            "CSToken: insufficient balance"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            require(
                recipients[i] != address(0),
                "CSToken: transfer to zero address"
            );
            require(amounts[i] > 0, "CSToken: amount must be greater than 0");
            _transfer(msg.sender, recipients[i], amounts[i]);
        }

        emit BatchTransfer(msg.sender, recipients, amounts);
    }

    /**
     * @dev 重写transfer函数，添加暂停检查
     */
    function transfer(
        address to,
        uint256 amount
    ) public override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    /**
     * @dev 重写transferFrom函数，添加暂停检查
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    /**
     * @dev 获取合约信息
     */
    function getTokenInfo()
        external
        view
        returns (
            string memory name_,
            string memory symbol_,
            uint8 decimals_,
            uint256 totalSupply_,
            uint256 maxSupply_,
            bool mintingEnabled_,
            bool burningEnabled_,
            bool paused_,
            address owner_
        )
    {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            maxSupply,
            mintingEnabled,
            burningEnabled,
            paused(),
            owner()
        );
    }

    /**
     * @dev 获取合约代币余额
     */
    function getContractBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }

    /**
     * @dev 检查是否可以铸造指定数量
     */
    function canMint(uint256 amount) external view returns (bool) {
        return mintingEnabled && totalSupply() + amount <= maxSupply;
    }

    /**
     * @dev 获取剩余可铸造数量
     */
    function getRemainingMintable() external view returns (uint256) {
        return maxSupply - totalSupply();
    }
}
