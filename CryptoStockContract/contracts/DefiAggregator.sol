// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface IAavePool {
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;
    
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);
    
    function getAToken(address asset) external view returns (address);
    function getATokenBalance(address user, address asset) external view returns (uint256);
}

interface IAToken {
    function balanceOf(address account) external view returns (uint256);
}

contract DefiAggregator is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // Aave Pool 地址 (可配置)
    address public aavePool;
    
    // USDT 地址 (可配置)
    address public usdtToken;
    
    // 手续费率 (基点，50 = 0.5%)
    uint256 public feeRateBps;
    
    // 累计手续费收入
    uint256 public totalFeesCollected;
    
    // 事件
    event Deposited(address indexed user, uint256 amount, uint256 fee);
    event Withdrawn(address indexed user, uint256 amount, uint256 totalReceived, uint256 fee);
    event FeeCollected(address indexed user, uint256 fee, string operation);
    event FeeRateChanged(uint256 oldRate, uint256 newRate);
    
    // 禁用构造函数，使用初始化函数
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }
    
    // 初始化函数 - 替代构造函数
    function initialize(
        address _aavePool,
        address _usdtToken,
        address _owner
    ) public initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();
        
        require(_aavePool != address(0), "Invalid Aave Pool address");
        require(_usdtToken != address(0), "Invalid USDT address");
        
        aavePool = _aavePool;
        usdtToken = _usdtToken;
        feeRateBps = 50; // 默认0.5%手续费
        totalFeesCollected = 0;
        
        // 自动授权 Aave Pool 转移 USDT (避免每次存款都要授权)
        IERC20(usdtToken).approve(aavePool, type(uint256).max);
    }
    
    // 存款函数 - 用户将USDT存入Aave，收取0.5%手续费
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // 计算手续费
        uint256 fee = amount * feeRateBps / 10000;
        uint256 netAmount = amount - fee;
        
        // 从用户转移USDT到本合约
        require(IERC20(usdtToken).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // 收取手续费（保留在合约中）
        totalFeesCollected += fee;
        
        // 将净金额存入Aave，aToken会直接铸造给用户
        IAavePool(aavePool).supply(usdtToken, netAmount, msg.sender, 0);
        
        emit Deposited(msg.sender, netAmount, fee);
        emit FeeCollected(msg.sender, fee, "deposit");
    }
    
    // 取款函数 - 用户从Aave取回USDT，收取0.5%手续费
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        
        // 获取aToken地址
        address aTokenAddress = IAavePool(aavePool).getAToken(usdtToken);
        require(aTokenAddress != address(0), "aToken not found");
        
        // 检查用户的aToken余额是否足够
        uint256 aTokenBalance = IAToken(aTokenAddress).balanceOf(msg.sender);
        require(aTokenBalance >= amount, "Insufficient balance");
        
        // 用户将aToken转给本合约（这样本合约就能调用Pool的withdraw）
        require(IERC20(aTokenAddress).transferFrom(msg.sender, address(this), amount), "aToken transfer failed");
        
        // 本合约调用Pool的withdraw，USDT会先到达本合约
        uint256 totalReceived = IAavePool(aavePool).withdraw(usdtToken, amount, address(this));
        
        // 计算手续费（从实际收到的金额中扣除）
        uint256 fee = totalReceived * feeRateBps / 10000;
        uint256 netAmount = totalReceived - fee;
        
        // 收取手续费
        totalFeesCollected += fee;
        
        // 将净金额转给用户
        require(IERC20(usdtToken).transfer(msg.sender, netAmount), "Transfer to user failed");
        
        emit Withdrawn(msg.sender, amount, netAmount, fee);
        emit FeeCollected(msg.sender, fee, "withdraw");
    }
    
    // 获取用户在Aave中的存款余额（通过aToken余额）
    function getDepositBalance(address user) external view returns (uint256) {
        address aTokenAddress = IAavePool(aavePool).getAToken(usdtToken);
        if (aTokenAddress == address(0)) return 0;
        return IAToken(aTokenAddress).balanceOf(user);
    }
    
    // 紧急情况下所有者可以提取任何误转入的ERC20代币
    function rescueTokens(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20(tokenAddress).transfer(owner(), amount);
    }
    
    // 设置新的Aave Pool地址 - 只有owner可以调用
    function setAavePool(address _aavePool) external onlyOwner {
        require(_aavePool != address(0), "Invalid Aave Pool address");
        aavePool = _aavePool;
    }
    
    // 设置新的USDT地址 - 只有owner可以调用
    function setUsdtToken(address _usdtToken) external onlyOwner {
        require(_usdtToken != address(0), "Invalid USDT address");
        usdtToken = _usdtToken;
    }
    
    // 设置手续费率 - 只有owner可以调用
    function setFeeRate(uint256 _feeRateBps) external onlyOwner {
        require(_feeRateBps <= 1000, "Fee rate too high"); // 最大10%
        uint256 oldRate = feeRateBps;
        feeRateBps = _feeRateBps;
        emit FeeRateChanged(oldRate, _feeRateBps);
    }
    
    // 提取累计手续费 - 只有owner可以调用
    function withdrawFees() external onlyOwner {
        require(totalFeesCollected > 0, "No fees to withdraw");
        uint256 fees = totalFeesCollected;
        totalFeesCollected = 0;
        require(IERC20(usdtToken).transfer(owner(), fees), "Fee withdrawal failed");
    }
    
    // 查看当前手续费率
    function getFeeRate() external view returns (uint256) {
        return feeRateBps;
    }
    
    // 计算手续费（用于前端预览）
    function calculateFee(uint256 amount) external view returns (uint256) {
        return amount * feeRateBps / 10000;
    }
    
    // UUPS升级授权 - 只有owner可以升级合约
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
