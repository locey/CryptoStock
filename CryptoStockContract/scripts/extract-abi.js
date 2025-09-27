const fs = require('fs');
const path = require('path');

/**
 * 从artifacts中提取ABI文件的脚本
 * 用法: node scripts/extract-abi.js
 */

// 需要提取ABI的合约列表 - 区分普通合约和mock合约
const contracts = [
  'StockToken',
  'StockTokenV2', 
  'TokenFactory',
  'TokenFactoryV2',
  'OracleAggregator',
  'OracleAggregatorV2',
  'CSToken',
  'DefiAggregator'
];

// DeFi 适配器合约 (已更新 - 移除 BaseDefiModule)
const adapterContracts = [
  'AaveAdapter'      // Aave 适配器实现 (现在位于 adapters/ 目录)
];

const mockContracts = [
  'MockERC20',
  'MockPyth',
  'MockAavePool',
  'MockAToken'
];

// 创建abi输出目录
const abiDir = path.join(__dirname, '..', 'abi');
if (!fs.existsSync(abiDir)) {
  fs.mkdirSync(abiDir, { recursive: true });
  console.log('✅ 创建ABI目录:', abiDir);
}

function extractABI() {
  console.log('🔄 开始提取ABI文件...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  // 处理普通合约
  contracts.forEach(contractName => {
    try {
      // 构建artifact文件路径
      const artifactPath = path.join(
        __dirname, 
        '..', 
        'artifacts', 
        'contracts', 
        `${contractName}.sol`, 
        `${contractName}.json`
      );
      
      processContract(contractName, artifactPath);
      successCount++;
      
    } catch (error) {
      console.log(`❌ 提取失败 ${contractName}:`, error.message);
      failCount++;
    }
  });
  
  // 处理mock合约
  mockContracts.forEach(contractName => {
    try {
      // 构建artifact文件路径 (mock目录)
      const artifactPath = path.join(
        __dirname, 
        '..', 
        'artifacts', 
        'contracts',
        'mock', 
        `${contractName}.sol`, 
        `${contractName}.json`
      );
      
      processContract(contractName, artifactPath);
      successCount++;
      
    } catch (error) {
      console.log(`❌ 提取失败 ${contractName}:`, error.message);
      failCount++;
    }
  });
  
  // 处理适配器合约 (adapters 目录)
  adapterContracts.forEach(contractName => {
    try {
      // 构建artifact文件路径 (adapters目录)
      const artifactPath = path.join(
        __dirname, 
        '..', 
        'artifacts', 
        'contracts',
        'adapters', 
        `${contractName}.sol`, 
        `${contractName}.json`
      );
      
      processContract(contractName, artifactPath);
      successCount++;
      
    } catch (error) {
      console.log(`❌ 提取失败 ${contractName}:`, error.message);
      failCount++;
    }
  });
  
  console.log(`\n📊 提取完成:`);
  console.log(`   成功: ${successCount} 个合约`);
  console.log(`   失败: ${failCount} 个合约`);
  console.log(`   输出目录: ${abiDir}`);
}

function processContract(contractName, artifactPath) {
  // 检查文件是否存在
  if (!fs.existsSync(artifactPath)) {
    console.log(`⚠️  跳过 ${contractName}: artifact文件不存在`);
    throw new Error(`Artifact not found: ${artifactPath}`);
  }
  
  // 读取artifact文件
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  
  // 提取ABI
  const abi = artifact.abi;
  
  // 创建输出文件路径
  const abiPath = path.join(abiDir, `${contractName}.abi`);
  
  // 写入ABI文件 (格式化JSON)
  fs.writeFileSync(abiPath, JSON.stringify(abi, null, 2));
  
  console.log(`✅ 成功提取: ${contractName}.abi`);
}

// 执行提取
extractABI();