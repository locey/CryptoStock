const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * 查询股票代币余额脚本 + 自动补充功能
 * 读取 deployments-uups-sepolia.json 文件中的股票代币地址
 * 查询每个代币的合约余额信息，并在余额不足时自动 mint 代币
 * 
 * 自动补充规则:
 * - 如果合约代币余额 < 1,000,000，则 mint 1,000,000 个对应代币
 * - 如果合约 USDT 余额 < 1,000,000，则 mint 1,000,000 个 USDT
 */

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// 彩色打印函数
function colorLog(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// mint StockToken 到合约地址的函数 (先 mint 到 owner，再 inject 到合约)
async function mintStockTokenToContract(contract, contractAddress, amount, tokenSymbol, decimals) {
  try {
    colorLog(`🔄 正在为 ${tokenSymbol} 合约补充 ${ethers.formatUnits(amount, decimals)} 代币...`, 'yellow');
    
    // 直接 mint 代币到合约地址
    colorLog(`   🎯 直接 mint ${ethers.formatUnits(amount, decimals)} ${tokenSymbol} 到合约...`, 'blue');
    const mintTx = await contract.mint(contractAddress, amount);
    colorLog(`   ⏳ Mint 交易已提交: ${mintTx.hash}`, 'blue');
    const mintReceipt = await mintTx.wait();
    colorLog(`   ✅ Mint 完成! Gas: ${mintReceipt.gasUsed.toString()}`, 'green');
    
    colorLog(`✅ ${tokenSymbol} 补充成功!`, 'green');
    return true;
  } catch (error) {
    colorLog(`❌ ${tokenSymbol} 补充失败: ${error.message}`, 'red');
    return false;
  }
}

// mint USDT 到合约地址的函数 (直接 mint 到指定地址)
async function mintUsdtToContract(contract, contractAddress, amount, decimals) {
  try {
    colorLog(`🔄 正在为合约 mint ${ethers.formatUnits(amount, decimals)} USDT...`, 'yellow');
    
    // 直接 mint 到合约地址
    const tx = await contract.mint(contractAddress, amount);
    colorLog(`⏳ 交易已提交: ${tx.hash}`, 'blue');
    
    // 等待确认
    const receipt = await tx.wait();
    colorLog(`✅ USDT Mint 成功! Gas 使用: ${receipt.gasUsed.toString()}`, 'green');
    
    return true;
  } catch (error) {
    colorLog(`❌ USDT Mint 失败: ${error.message}`, 'red');
    return false;
  }
}

// 检查并自动补充余额的函数
async function checkAndMintIfNeeded(tokenContract, usdtContract, contractAddress, symbol, decimals) {
  const results = {
    tokenMinted: false,
    usdtMinted: false,
    tokenBalance: 0n,
    usdtBalance: 0n
  };

  try {
    // 检查代币余额
    const tokenBalance = await tokenContract.balanceOf(contractAddress);
    const usdtBalance = await usdtContract.balanceOf(contractAddress);
    
    results.tokenBalance = tokenBalance;
    results.usdtBalance = usdtBalance;

    // 检查是否需要 mint 代币
    if (tokenBalance < MIN_BALANCE_THRESHOLD) {
      colorLog(`⚠️  ${symbol} 余额不足 (${ethers.formatUnits(tokenBalance, decimals)} < 1,000,000)`, 'yellow');
      results.tokenMinted = await mintStockTokenToContract(
        tokenContract, 
        contractAddress, 
        MINT_AMOUNT, 
        symbol, 
        decimals
      );
      
      if (results.tokenMinted) {
        results.tokenBalance = await tokenContract.balanceOf(contractAddress);
      }
    }

    // 检查是否需要 mint USDT
    if (usdtBalance < MIN_USDT_THRESHOLD) {
      colorLog(`⚠️  USDT 余额不足 (${ethers.formatUnits(usdtBalance, 6)} < 1,000,000)`, 'yellow');
      results.usdtMinted = await mintUsdtToContract(
        usdtContract, 
        contractAddress, 
        MINT_USDT_AMOUNT, 
        6
      );
      
      if (results.usdtMinted) {
        results.usdtBalance = await usdtContract.balanceOf(contractAddress);
      }
    }

  } catch (error) {
    colorLog(`❌ 检查余额失败: ${error.message}`, 'red');
  }

  return results;
}

// StockToken ABI (查询 + mint + inject 功能)
const STOCK_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
  "function mint(address to, uint256 amount) external",
  "function injectTokens(uint256 amount) external"
];

// MockERC20 ABI (USDT 合约)
const MOCK_ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function mint(address to, uint256 amount) external"
];

// 最小余额阈值 (1,000,000 个代币)
const MIN_BALANCE_THRESHOLD = ethers.parseUnits("1000000", 18);
const MIN_USDT_THRESHOLD = ethers.parseUnits("1000000", 6);

// mint 数量
const MINT_AMOUNT = ethers.parseUnits("1000000", 18);
const MINT_USDT_AMOUNT = ethers.parseUnits("1000000", 6);

async function main() {
  try {
    colorLog("\n🚀 股票代币余额查询脚本启动", 'cyan');
    colorLog("=" .repeat(50), 'cyan');

    // 获取网络信息
    const network = await ethers.provider.getNetwork();
    colorLog(`🌐 当前网络: ${network.name} (Chain ID: ${network.chainId})`, 'blue');

    // 读取部署文件
    const deploymentFile = path.join(__dirname, "../deployments-uups-sepolia.json");
    
    if (!fs.existsSync(deploymentFile)) {
      throw new Error(`部署文件不存在: ${deploymentFile}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    colorLog(`📄 成功读取部署文件: ${deploymentFile}`, 'green');
    
    // 获取股票代币列表
    const stockTokens = deployment.stockTokens;
    const usdtAddress = deployment.contracts.USDT;
    
    if (!stockTokens) {
      throw new Error("部署文件中未找到 stockTokens 配置");
    }

    colorLog(`\n📊 发现 ${Object.keys(stockTokens).length} 个股票代币:`, 'yellow');
    
    // 获取 USDT 合约用于查询 USDT 余额
    const usdtContract = await ethers.getContractAt("MockERC20", usdtAddress);
    colorLog(`💰 USDT 合约地址: ${usdtAddress}`, 'blue');

    colorLog("\n" + "=".repeat(80), 'cyan');
    colorLog("📈 股票代币余额详情 + 自动补充", 'cyan');
    colorLog("=".repeat(80), 'cyan');

    // 统计变量
    let totalMintedTokens = 0;
    let totalMintedUsdt = 0;
    let processedTokens = 0;

    // 遍历所有股票代币
    for (const [symbol, address] of Object.entries(stockTokens)) {
      try {
        colorLog(`\n🔍 正在查询 ${symbol} (${address})...`, 'yellow');
        
        // 连接到代币合约
        const tokenContract = await ethers.getContractAt("StockToken", address);
        
        // 查询基本信息
        const name = await tokenContract.name();
        const tokenSymbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        const totalSupply = await tokenContract.totalSupply();
        
        // 查询所有者
        let owner;
        try {
          owner = await tokenContract.owner();
        } catch (e) {
          owner = "无法获取";
        }

        // 格式化输出基本信息
        colorLog(`📋 代币信息:`, 'bright');
        colorLog(`   名称: ${name}`, 'white');
        colorLog(`   符号: ${tokenSymbol}`, 'white');
        colorLog(`   精度: ${decimals} decimals`, 'white');
        colorLog(`   总供应量: ${ethers.formatUnits(totalSupply, decimals)} ${tokenSymbol}`, 'white');
        colorLog(`   合约所有者: ${owner}`, 'white');
        
        // 检查并自动补充余额
        colorLog(`🔍 检查余额并自动补充...`, 'cyan');
        const mintResults = await checkAndMintIfNeeded(tokenContract, usdtContract, address, tokenSymbol, decimals);
        
        // 使用更新后的余额
        const finalTokenBalance = mintResults.tokenBalance;
        const finalUsdtBalance = mintResults.usdtBalance;
        
        colorLog(`💼 合约余额:`, 'bright');
        if (mintResults.tokenMinted) {
          colorLog(`   ${tokenSymbol} 余额: ${ethers.formatUnits(finalTokenBalance, decimals)} ${tokenSymbol} ✨ (已补充)`, 'green');
        } else {
          colorLog(`   ${tokenSymbol} 余额: ${ethers.formatUnits(finalTokenBalance, decimals)} ${tokenSymbol}`, 'green');
        }
        
        if (mintResults.usdtMinted) {
          colorLog(`   USDT 余额: ${ethers.formatUnits(finalUsdtBalance, 6)} USDT ✨ (已补充)`, 'green');
        } else {
          colorLog(`   USDT 余额: ${ethers.formatUnits(finalUsdtBalance, 6)} USDT`, 'green');
        }
        
        // 计算百分比 (使用更新后的余额)
        const tokenPercentage = totalSupply > 0 ? (finalTokenBalance * 100n) / totalSupply : 0n;
        colorLog(`📊 统计:`, 'bright');
        colorLog(`   合约持有比例: ${tokenPercentage}% (${ethers.formatUnits(finalTokenBalance, decimals)} / ${ethers.formatUnits(totalSupply, decimals)})`, 'magenta');
        
        // 状态判断 (使用更新后的余额)
        if (finalTokenBalance === 0n) {
          colorLog(`⚠️  警告: 合约中没有 ${tokenSymbol} 代币余额!`, 'red');
        } else if (finalTokenBalance < (totalSupply / 10n)) {
          colorLog(`⚠️  注意: 合约 ${tokenSymbol} 余额较低 (<10%)`, 'yellow');
        } else {
          colorLog(`✅ 合约 ${tokenSymbol} 余额充足`, 'green');
        }

        // 显示 mint 操作总结
        if (mintResults.tokenMinted || mintResults.usdtMinted) {
          colorLog(`🎯 自动补充总结:`, 'bright');
          if (mintResults.tokenMinted) {
            colorLog(`   ✅ ${tokenSymbol}: 已补充 1,000,000 个代币`, 'green');
            totalMintedTokens++;
          }
          if (mintResults.usdtMinted) {
            colorLog(`   ✅ USDT: 已补充 1,000,000 个代币`, 'green');
            totalMintedUsdt++;
          }
        }

        processedTokens++;
        colorLog("-".repeat(60), 'cyan');

      } catch (error) {
        colorLog(`❌ 查询 ${symbol} 失败:`, 'red');
        colorLog(`   错误: ${error.message}`, 'red');
        colorLog("-".repeat(60), 'cyan');
      }
    }

    // 汇总统计
    colorLog("\n📊 操作汇总统计", 'cyan');
    colorLog("=".repeat(50), 'cyan');
    
    // 重新统计最终余额状态
    let totalTokens = 0;
    let tokensWithBalance = 0;
    let tokensWithUsdtBalance = 0;
    
    for (const [symbol, address] of Object.entries(stockTokens)) {
      try {
        totalTokens++;
        const tokenContract = await ethers.getContractAt("StockToken", address);
        const tokenBalance = await tokenContract.balanceOf(address);
        const usdtBalance = await usdtContract.balanceOf(address);
        
        if (tokenBalance > 0) tokensWithBalance++;
        if (usdtBalance > 0) tokensWithUsdtBalance++;
        
      } catch (error) {
        // 统计时忽略错误
      }
    }
    
    colorLog(`📈 处理结果:`, 'white');
    colorLog(`   总代币数量: ${processedTokens}`, 'white');
    colorLog(`   自动补充代币: ${totalMintedTokens} 个合约`, totalMintedTokens > 0 ? 'green' : 'white');
    colorLog(`   自动补充USDT: ${totalMintedUsdt} 个合约`, totalMintedUsdt > 0 ? 'green' : 'white');
    
    colorLog(`📊 最终状态:`, 'white');
    colorLog(`   有代币余额的合约: ${tokensWithBalance}/${totalTokens}`, 'green');
    colorLog(`   有USDT余额的合约: ${tokensWithUsdtBalance}/${totalTokens}`, 'green');
    
    if (tokensWithBalance === totalTokens && tokensWithUsdtBalance === totalTokens) {
      colorLog(`🎉 所有合约都有足够余额! 系统准备就绪`, 'green');
    } else {
      const missingTokens = totalTokens - tokensWithBalance;
      const missingUsdt = totalTokens - tokensWithUsdtBalance;
      
      if (missingTokens > 0) {
        colorLog(`⚠️  还有 ${missingTokens} 个合约缺少代币余额`, 'yellow');
      }
      if (missingUsdt > 0) {
        colorLog(`⚠️  还有 ${missingUsdt} 个合约缺少USDT余额`, 'yellow');
      }
    }

    // 显示 mint 操作总结
    if (totalMintedTokens > 0 || totalMintedUsdt > 0) {
      colorLog(`\n� 自动补充操作总结:`, 'cyan');
      colorLog(`   ✅ 成功补充 ${totalMintedTokens} 个合约的代币余额`, totalMintedTokens > 0 ? 'green' : 'white');
      colorLog(`   ✅ 成功补充 ${totalMintedUsdt} 个合约的USDT余额`, totalMintedUsdt > 0 ? 'green' : 'white');
      colorLog(`   💰 总计mint: ${totalMintedTokens * 1000000} 代币 + ${totalMintedUsdt * 1000000} USDT`, 'green');
    }

    colorLog("\n✅ 余额查询完成!", 'green');
    colorLog("=".repeat(50), 'cyan');

  } catch (error) {
    colorLog("\n❌ 脚本执行失败:", 'red');
    colorLog(`错误信息: ${error.message}`, 'red');
    if (error.stack) {
      colorLog(`错误堆栈:\n${error.stack}`, 'red');
    }
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      colorLog(`\n💥 未捕获的错误: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { main };