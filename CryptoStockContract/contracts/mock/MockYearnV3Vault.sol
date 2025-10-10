// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IYearnV3.sol";
import "./MockERC20.sol";

/**
 * @title MockYearnV3Vault
 * @notice Mock Yearn V3 Vault 用于测试
 * @dev 简化实现，模拟基本的存取款和收益功能
 */
contract MockYearnV3Vault is ERC20, IYearnV3Vault {
    
    // ============ 状态变量 ============
    
    /// @notice 底层资产代币
    IERC20 public immutable _asset;
    
    /// @notice 资产的小数位数
    uint8 private immutable _assetDecimals;
    
    /// @notice 模拟的年化收益率 (基点, 500 = 5%)
    uint256 public yieldRate = 500;
    
    /// @notice 上次更新收益的时间戳
    uint256 public lastYieldUpdate;
    
    /// @notice 累计收益倍数 (1e18 = 1.0倍)
    uint256 public cumulativeYieldMultiplier;
    
    // ============ 构造函数 ============
    
    constructor(
        address assetAddress,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        _asset = IERC20(assetAddress);
        _assetDecimals = ERC20(assetAddress).decimals();
        lastYieldUpdate = block.timestamp;
        cumulativeYieldMultiplier = 1e18; // 初始倍数为1.0
    }
    
    // ============ IYearnV3Vault 接口实现 ============
    
    /**
     * @notice 获取底层资产地址
     */
    function asset() external view override returns (address) {
        return address(_asset);
    }
    
    // ============ ERC20 函数重写 ============
    
    function balanceOf(address account) public view override(ERC20, IYearnV3Vault) returns (uint256) {
        return ERC20.balanceOf(account);
    }
    
    function totalSupply() public view override(ERC20, IYearnV3Vault) returns (uint256) {
        return ERC20.totalSupply();
    }
    
    function allowance(address owner, address spender) public view override(ERC20, IYearnV3Vault) returns (uint256) {
        return ERC20.allowance(owner, spender);
    }
    
    function approve(address spender, uint256 amount) public override(ERC20, IYearnV3Vault) returns (bool) {
        return ERC20.approve(spender, amount);
    }
    
    function transfer(address to, uint256 amount) public override(ERC20, IYearnV3Vault) returns (bool) {
        return ERC20.transfer(to, amount);
    }
    
    function transferFrom(address from, address to, uint256 amount) public override(ERC20, IYearnV3Vault) returns (bool) {
        return ERC20.transferFrom(from, to, amount);
    }
    
    function name() public view override(ERC20, IYearnV3Vault) returns (string memory) {
        return ERC20.name();
    }
    
    function symbol() public view override(ERC20, IYearnV3Vault) returns (string memory) {
        return ERC20.symbol();
    }
    
    // ============ 核心存取款函数 ============
    
    /**
     * @notice 存入资产，获得份额
     */
    function deposit(uint256 assets, address receiver) external override returns (uint256 shares) {
        require(assets > 0, "Cannot deposit 0");
        require(receiver != address(0), "Invalid receiver");
        
        // 更新收益
        _updateYield();
        
        // 转入资产
        _asset.transferFrom(msg.sender, address(this), assets);
        
        // 计算份额 (首次存入时 1:1, 之后按当前汇率)
        if (totalSupply() == 0) {
            shares = assets;
        } else {
            shares = (assets * totalSupply()) / totalAssets();
        }
        
        // 铸造份额代币
        _mint(receiver, shares);
        
        emit Deposit(msg.sender, receiver, assets, shares);
        
        return shares;
    }
    
    /**
     * @notice 取出资产，销毁份额
     */
    function withdraw(uint256 assets, address receiver, address owner) external override returns (uint256 shares) {
        require(assets > 0, "Cannot withdraw 0");
        require(receiver != address(0), "Invalid receiver");
        
        // 更新收益
        _updateYield();
        
        // 计算需要销毁的份额
        shares = previewWithdraw(assets);
        
        // 检查权限和余额
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }
        
        require(balanceOf(owner) >= shares, "Insufficient balance");
        
        // 销毁份额
        _burn(owner, shares);
        
        // 转出资产
        _asset.transfer(receiver, assets);
        
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        
        return shares;
    }
    
    /**
     * @notice 赎回份额，取出对应资产
     */
    function redeem(uint256 shares, address receiver, address owner) external override returns (uint256 assets) {
        require(shares > 0, "Cannot redeem 0");
        require(receiver != address(0), "Invalid receiver");
        
        // 更新收益
        _updateYield();
        
        // 计算能获得的资产
        assets = previewRedeem(shares);
        
        // 检查权限和余额
        if (msg.sender != owner) {
            uint256 allowed = allowance(owner, msg.sender);
            require(allowed >= shares, "Insufficient allowance");
            _approve(owner, msg.sender, allowed - shares);
        }
        
        require(balanceOf(owner) >= shares, "Insufficient balance");
        
        // 销毁份额
        _burn(owner, shares);
        
        // 转出资产
        _asset.transfer(receiver, assets);
        
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        
        return assets;
    }
    
    // ============ 查询函数 ============
    
    /**
     * @notice 获取总资产管理量
     */
    function totalAssets() public view override returns (uint256) {
        uint256 assetBalance = _asset.balanceOf(address(this));
        
        // 如果没有份额，返回资产余额
        if (totalSupply() == 0) {
            return assetBalance;
        }
        
        // 计算包含未实现收益的总资产
        uint256 timeElapsed = block.timestamp - lastYieldUpdate;
        if (timeElapsed > 0) {
            uint256 yieldMultiplier = _calculateYieldMultiplier(timeElapsed);
            return (assetBalance * yieldMultiplier) / 1e18;
        }
        
        return assetBalance;
    }
    
    /**
     * @notice 将资产数量转换为份额数量
     */
    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        uint256 supply = totalSupply();
        return supply == 0 ? assets : (assets * supply) / totalAssets();
    }
    
    /**
     * @notice 将份额数量转换为资产数量
     */
    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        uint256 supply = totalSupply();
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }
    
    /**
     * @notice 预览存款能获得的份额
     */
    function previewDeposit(uint256 assets) external view override returns (uint256 shares) {
        return convertToShares(assets);
    }
    
    /**
     * @notice 预览取款需要销毁的份额
     */
    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        uint256 supply = totalSupply();
        if (supply == 0) return assets;
        
        // 使用实际资产余额而不是虚拟收益放大的 totalAssets()
        // 这样可以避免收益计算导致的份额需求过大问题
        uint256 actualAssets = _asset.balanceOf(address(this));
        if (actualAssets == 0) return 0;
        
        // 简单的比例计算：需要的份额 = (要取的资产 * 总份额) / 实际资产
        return (assets * supply + actualAssets - 1) / actualAssets;
    }
    
    /**
     * @notice 预览赎回能获得的资产
     */
    function previewRedeem(uint256 shares) public view override returns (uint256 assets) {
        return convertToAssets(shares);
    }
    
    /**
     * @notice 获取用户最大取款额度
     */
    function maxWithdraw(address owner) external view override returns (uint256 maxAssets) {
        return convertToAssets(balanceOf(owner));
    }
    
    /**
     * @notice 获取用户最大赎回份额
     */
    function maxRedeem(address owner) external view override returns (uint256 maxShares) {
        return balanceOf(owner);
    }
    
    // ============ ERC20 重写 ============
    
    function decimals() public view override(ERC20, IYearnV3Vault) returns (uint8) {
        return _assetDecimals;
    }
    
    // ============ 管理员功能 ============
    
    /**
     * @notice 设置年化收益率（仅用于测试）
     * @param newYieldRate 新的年化收益率（基点）
     */
    function setYieldRate(uint256 newYieldRate) external {
        _updateYield();
        yieldRate = newYieldRate;
    }
    
    /**
     * @notice 手动触发收益更新（仅用于测试）
     */
    function updateYield() external {
        _updateYield();
    }
    
    // ============ 内部函数 ============
    
    /**
     * @notice 更新收益
     */
    function _updateYield() internal {
        uint256 timeElapsed = block.timestamp - lastYieldUpdate;
        if (timeElapsed > 0 && totalSupply() > 0) {
            uint256 yieldMultiplier = _calculateYieldMultiplier(timeElapsed);
            cumulativeYieldMultiplier = (cumulativeYieldMultiplier * yieldMultiplier) / 1e18;
            lastYieldUpdate = block.timestamp;
            
            // 模拟收益：给合约mint一些资产代币
            uint256 currentAssets = _asset.balanceOf(address(this));
            uint256 yieldAmount = (currentAssets * (yieldMultiplier - 1e18)) / 1e18;
            
            if (yieldAmount > 0) {
                // 这里在真实环境中收益是自动产生的，mock中我们需要mint
                // 注意：这需要MockERC20支持mint功能
                try this._mintYield(yieldAmount) {} catch {}
            }
        }
    }
    
    /**
     * @notice 计算时间段内的收益倍数
     */
    function _calculateYieldMultiplier(uint256 timeElapsed) internal view returns (uint256) {
        if (timeElapsed == 0) return 1e18;
        
        // 简化的复利计算：假设按秒计算
        // yearlyMultiplier = 1 + (yieldRate / 10000)
        // secondlyRate = (yieldRate / 10000) / (365 * 24 * 3600)
        uint256 secondlyRate = yieldRate * 1e18 / (10000 * 365 * 24 * 3600);
        return 1e18 + (secondlyRate * timeElapsed) / 1e18;
    }
    
    /**
     * @notice 模拟铸造收益代币（需要MockERC20支持）
     */
    function _mintYield(uint256 /* amount */) external view {
        require(msg.sender == address(this), "Only self");
        // 这里需要底层资产是MockERC20并支持mint
        // 在实际测试中，可能需要从外部注入资产来模拟收益
        // 简化实现：不实际mint，只是预留接口
    }
    
    // ============ 测试辅助函数 ============
    
    /**
     * @notice 模拟收益生成（用于测试）
     * @param yieldPercentageBps 收益百分比基点 (100 = 1%, 500 = 5%)
     */
    function simulateYield(uint256 yieldPercentageBps) external {
        // 更新累积收益倍数
        cumulativeYieldMultiplier = (cumulativeYieldMultiplier * (10000 + yieldPercentageBps)) / 10000;
        
        // 计算需要增加的总资产来实现收益
        uint256 currentAssets = totalAssets();
        uint256 yieldAssets = (currentAssets * yieldPercentageBps) / 10000;
        
        // 向vault增加资产来模拟收益
        if (yieldAssets > 0) {
            try MockERC20(address(_asset)).mint(address(this), yieldAssets) {} catch {}
        }
        
        lastYieldUpdate = block.timestamp;
    }
}