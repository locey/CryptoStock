// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./OracleAggregator.sol";

/**
 * @title StockToken - 改进版股票代币合约
 * @dev 可升级的ERC20代币，代表股票份额，支持买卖功能
 * 
 * 主要改进：
 * 1. 代币初始化时分配给owner，而非合约
 * 2. 修复价格计算逻辑
 * 3. 添加安全机制（暂停、重入保护）
 * 4. 增加管理功能（提取、调整参数）
 * 5. 添加滑点保护和最小交易限制
 */
contract StockToken is
    Initializable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    OracleAggregator public oracleAggregator;
    IERC20 public usdtToken;
    string public stockSymbol;
    
    // 交易参数
    uint256 public minTradeAmount = 1e6; // 最小交易金额 1 USDT (6 decimals)
    uint256 public maxSlippage = 300; // 最大滑点 3% (基点表示)
    uint256 public tradeFeeRate = 30; // 交易手续费 0.3% (基点表示)
    address public feeReceiver; // 手续费接收地址
    
    // 事件
    event TokenPurchased(address indexed buyer, uint256 usdtAmount, uint256 tokenAmount, uint256 price);
    event TokenSold(address indexed seller, uint256 tokenAmount, uint256 usdtAmount, uint256 price);
    event ParameterUpdated(string indexed parameter, uint256 oldValue, uint256 newValue);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address owner_,
        address oracleAggregator_,
        address usdtToken_
    ) public initializer {
        __ERC20_init(name_, symbol_);
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();
        __Pausable_init();
        __ReentrancyGuard_init();
        
        stockSymbol = symbol_;
        oracleAggregator = OracleAggregator(oracleAggregator_);
        usdtToken = IERC20(usdtToken_);
        feeReceiver = owner_; // 默认手续费接收者为owner
        
        // 🔥 关键改进：代币分配给owner而不是合约
        _mint(owner_, initialSupply_);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}

    /**
     * @dev 铸造新代币 - 分配给owner
     */
    function mint(uint256 amount) external onlyOwner {
        _mint(owner(), amount);
    }

    /**
     * @dev 向合约注入代币用于交易
     */
    function injectTokens(uint256 amount) external onlyOwner {
        require(balanceOf(owner()) >= amount, "Insufficient owner balance");
        _transfer(owner(), address(this), amount);
    }

    /**
     * @dev 购买股票代币
     * @param usdtAmount 投入的USDT数量
     * @param minTokenAmount 最少获得的代币数量（滑点保护）
     */
    function buy(uint256 usdtAmount, uint256 minTokenAmount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(usdtAmount >= minTradeAmount, "Amount below minimum");

        // 获取当前股票价格
        (uint256 stockPrice, , , ) = oracleAggregator.getPrice(stockSymbol);
        require(stockPrice > 0, "Invalid stock price");

        // 🔥 修复价格计算逻辑
        // USDT: 6 decimals, stockPrice: 18 decimals, 目标: 18 decimals
        // tokenAmount = (usdtAmount * 1e12) * 1e18 / stockPrice
        uint256 tokenAmountBeforeFee = (usdtAmount * 1e30) / stockPrice;
        
        // 计算手续费
        uint256 feeAmount = (tokenAmountBeforeFee * tradeFeeRate) / 10000;
        uint256 tokenAmount = tokenAmountBeforeFee - feeAmount;
        
        // 滑点保护
        require(tokenAmount >= minTokenAmount, "Slippage too high");

        // 检查合约代币余额
        require(
            balanceOf(address(this)) >= tokenAmount,
            "Insufficient token supply"
        );

        // 转移USDT到合约
        require(
            usdtToken.transferFrom(msg.sender, address(this), usdtAmount),
            "USDT transfer failed"
        );

        // 转移代币给用户
        _transfer(address(this), msg.sender, tokenAmount);
        
        // 转移手续费代币给手续费接收者
        if (feeAmount > 0) {
            _transfer(address(this), feeReceiver, feeAmount);
        }

        emit TokenPurchased(msg.sender, usdtAmount, tokenAmount, stockPrice);
    }

    /**
     * @dev 出售股票代币
     * @param tokenAmount 出售的代币数量
     * @param minUsdtAmount 最少获得的USDT数量（滑点保护）
     */
    function sell(uint256 tokenAmount, uint256 minUsdtAmount) 
        external 
        nonReentrant 
        whenNotPaused 
    {
        require(tokenAmount > 0, "Invalid token amount");
        require(
            balanceOf(msg.sender) >= tokenAmount,
            "Insufficient token balance"
        );

        // 获取当前股票价格
        (uint256 stockPrice, , , ) = oracleAggregator.getPrice(stockSymbol);
        require(stockPrice > 0, "Invalid stock price");

        // 🔥 修复价格计算逻辑
        // tokenAmount: 18 decimals, stockPrice: 18 decimals, 目标: 6 decimals (USDT)
        uint256 usdtAmountBeforeFee = (tokenAmount * stockPrice) / 1e30;
        
        // 计算手续费
        uint256 feeAmount = (usdtAmountBeforeFee * tradeFeeRate) / 10000;
        uint256 usdtAmount = usdtAmountBeforeFee - feeAmount;
        
        // 滑点保护
        require(usdtAmount >= minUsdtAmount, "Slippage too high");
        require(usdtAmount >= minTradeAmount, "Amount below minimum");

        // 检查合约USDT余额
        require(
            usdtToken.balanceOf(address(this)) >= usdtAmount + feeAmount,
            "Insufficient USDT in contract"
        );

        // 转移代币到合约
        _transfer(msg.sender, address(this), tokenAmount);

        // 转移USDT给用户
        require(
            usdtToken.transfer(msg.sender, usdtAmount),
            "USDT transfer failed"
        );
        
        // 转移手续费USDT给手续费接收者
        if (feeAmount > 0) {
            require(
                usdtToken.transfer(feeReceiver, feeAmount),
                "Fee transfer failed"
            );
        }

        emit TokenSold(msg.sender, tokenAmount, usdtAmount, stockPrice);
    }

    /**
     * @dev 获取购买预估（包含手续费计算）
     */
    function getBuyEstimate(uint256 usdtAmount) 
        external 
        view 
        returns (uint256 tokenAmount, uint256 feeAmount) 
    {
        (uint256 stockPrice, , , ) = oracleAggregator.getPrice(stockSymbol);
        require(stockPrice > 0, "Invalid stock price");
        
        uint256 tokenAmountBeforeFee = (usdtAmount * 1e30) / stockPrice;
        feeAmount = (tokenAmountBeforeFee * tradeFeeRate) / 10000;
        tokenAmount = tokenAmountBeforeFee - feeAmount;
    }

    /**
     * @dev 获取出售预估（包含手续费计算）
     */
    function getSellEstimate(uint256 tokenAmount) 
        external 
        view 
        returns (uint256 usdtAmount, uint256 feeAmount) 
    {
        (uint256 stockPrice, , , ) = oracleAggregator.getPrice(stockSymbol);
        require(stockPrice > 0, "Invalid stock price");
        
        uint256 usdtAmountBeforeFee = (tokenAmount * stockPrice) / 1e30;
        feeAmount = (usdtAmountBeforeFee * tradeFeeRate) / 10000;
        usdtAmount = usdtAmountBeforeFee - feeAmount;
    }

    // ========== 管理功能 ==========

    /**
     * @dev 设置交易参数
     */
    function setTradeParameters(
        uint256 _minTradeAmount,
        uint256 _maxSlippage,
        uint256 _tradeFeeRate
    ) external onlyOwner {
        require(_maxSlippage <= 1000, "Max slippage too high"); // 最大10%
        require(_tradeFeeRate <= 1000, "Trade fee too high"); // 最大10%
        
        emit ParameterUpdated("minTradeAmount", minTradeAmount, _minTradeAmount);
        emit ParameterUpdated("maxSlippage", maxSlippage, _maxSlippage);
        emit ParameterUpdated("tradeFeeRate", tradeFeeRate, _tradeFeeRate);
        
        minTradeAmount = _minTradeAmount;
        maxSlippage = _maxSlippage;
        tradeFeeRate = _tradeFeeRate;
    }

    /**
     * @dev 设置手续费接收地址
     */
    function setFeeReceiver(address _feeReceiver) external onlyOwner {
        require(_feeReceiver != address(0), "Invalid fee receiver");
        feeReceiver = _feeReceiver;
    }

    /**
     * @dev 暂停/恢复合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 紧急提取功能
     */
    function emergencyWithdrawToken(uint256 amount) external onlyOwner {
        require(amount <= balanceOf(address(this)), "Insufficient balance");
        _transfer(address(this), owner(), amount);
        emit EmergencyWithdraw(address(this), owner(), amount);
    }

    function emergencyWithdrawUSDT(uint256 amount) external onlyOwner {
        require(amount <= usdtToken.balanceOf(address(this)), "Insufficient balance");
        require(usdtToken.transfer(owner(), amount), "Transfer failed");
        emit EmergencyWithdraw(address(usdtToken), owner(), amount);
    }

    // ========== 查询功能 ==========

    function getStockPrice() external view returns (uint256) {
        (uint256 price, , , ) = oracleAggregator.getPrice(stockSymbol);
        return price;
    }

    function getContractTokenBalance() external view returns (uint256) {
        return balanceOf(address(this));
    }

    function getContractUSDTBalance() external view returns (uint256) {
        return usdtToken.balanceOf(address(this));
    }

    function getTradingInfo() external view returns (
        uint256 _minTradeAmount,
        uint256 _maxSlippage,
        uint256 _tradeFeeRate,
        address _feeReceiver,
        bool _paused
    ) {
        return (minTradeAmount, maxSlippage, tradeFeeRate, feeReceiver, paused());
    }
}