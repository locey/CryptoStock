// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

// 简单ERC20接口（用于USDT/USDC交互）
interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns(bool);
    function transfer(address to, uint256 amount) external returns(bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

// 简化的aToken接口
interface IAToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
}

contract MockAavePool {
    
    // 映射：underlying asset => aToken 地址
    mapping(address => address) public aTokens;
    
    // 记录虚拟利息率（每次withdraw时按固定比例添加）
    uint256 public interestRateBps = 50; // 0.5%

    event Supplied(address indexed asset, address indexed user, uint256 amount);
    event Withdrawn(address indexed asset, address indexed user, uint256 amount, uint256 interest);
    event ReserveInitialized(address indexed asset, address indexed aToken);

    // 初始化资产储备（设置aToken地址）
    function initReserve(address asset, address aToken) external {
        require(asset != address(0), "Invalid asset");
        require(aToken != address(0), "Invalid aToken");
        aTokens[asset] = aToken;
        emit ReserveInitialized(asset, aToken);
    }

    // 存入 - 实现真正的Aave逻辑
    function supply(
        address asset,         // ERC20 Token合约地址（比如USDT/USDC）
        uint256 amount,
        address onBehalfOf,    // 受益人地址（接收aToken的地址）
        uint16 /* referralCode */
    ) public {
        require(amount > 0, "Invalid amount");
        require(aTokens[asset] != address(0), "Asset not supported");
        
        // 1. 从调用者转移underlying asset到Pool
        require(IERC20(asset).transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        // 2. 铸造等量的aToken给受益人 - 这是关键！
        IAToken(aTokens[asset]).mint(onBehalfOf, amount);
        
        emit Supplied(asset, onBehalfOf, amount);
    }

    // 取出 - 实现真正的Aave逻辑
    function withdraw(address asset, uint256 amount, address to) public returns (uint256) {
        require(aTokens[asset] != address(0), "Asset not supported");
        
        // 1. 检查调用者的aToken余额是否足够
        uint256 aTokenBalance = IAToken(aTokens[asset]).balanceOf(msg.sender);
        require(aTokenBalance >= amount, "Insufficient aToken balance");

        // 2. 计算虚拟利息（实际Aave中利息是通过aToken余额增长体现的）
        uint256 interest = amount * interestRateBps / 10000;
        uint256 totalWithdraw = amount + interest;

        // 3. 销毁用户的aToken
        IAToken(aTokens[asset]).burn(msg.sender, amount);

        // 4. 转移underlying asset + 利息给接收者
        // 注意：这里需要确保Pool有足够余额支付利息
        require(IERC20(asset).transfer(to, totalWithdraw), "Withdraw transfer failed");
        
        emit Withdrawn(asset, msg.sender, amount, interest);
        return totalWithdraw;
    }

    // 获取用户的aToken余额（存款余额）
    function getATokenBalance(address user, address asset) external view returns (uint256) {
        if (aTokens[asset] == address(0)) return 0;
        return IAToken(aTokens[asset]).balanceOf(user);
    }

    // 获取aToken地址
    function getAToken(address asset) external view returns (address) {
        return aTokens[asset];
    }
}
