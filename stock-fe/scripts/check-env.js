#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 检查是否在生产环境（CI/CD或托管平台）
const isProductionEnv = process.env.CI || 
                        process.env.VERCEL || 
                        process.env.NETLIFY || 
                        process.env.GITHUB_ACTIONS ||
                        process.env.NODE_ENV === 'production';

// 如果是生产环境，跳过检查
if (isProductionEnv) {
  console.log('🚀 检测到生产环境，跳过环境配置检查');
  process.exit(0);
}

console.log('🔍 本地开发环境 - 检查环境配置...\n');

// 检查.env文件是否存在
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  console.error('❌ 错误: .env 文件不存在');
  console.log('\n📋 请按照以下步骤配置:');
  console.log('1. 复制 .env.example 到 .env');
  console.log('2. 编辑 .env 文件，填入正确的配置值');
  console.log('\n💡 快速命令:');
  console.log('   cp .env.example .env');
  console.log('\n🔧 或者使用强制启动命令跳过检查:');
  console.log('   npm run dev:force');
  console.log('   npm run build:force');
  process.exit(1);
}

// 读取并验证环境变量
require('dotenv').config();

const requiredVars = [
  'NEXT_PUBLIC_APP_ENABLED',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ 错误: 以下必需的环境变量未配置:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.log('\n📝 请在 .env 文件中配置这些变量');
  console.log('💡 或使用强制启动命令跳过检查: npm run dev:force');
  process.exit(1);
}

// 检查应用是否启用
if (process.env.NEXT_PUBLIC_APP_ENABLED !== 'true') {
  console.error('❌ 错误: 应用被禁用');
  console.log('请将 NEXT_PUBLIC_APP_ENABLED 设置为 true 以启用应用');
  console.log('💡 或使用强制启动命令: npm run dev:force');
  process.exit(1);
}

// 检查关键配置
console.log('✅ 环境配置检查通过\n');
console.log('🔧 当前配置:');
console.log(`   - API URL: ${process.env.NEXT_PUBLIC_API_URL}`);
console.log(`   - Chain ID: ${process.env.NEXT_PUBLIC_CHAIN_ID || '未设置'}`);
console.log(`   - Debug Mode: ${process.env.NEXT_PUBLIC_DEBUG_MODE || 'false'}`);
console.log(`   - Trading Enabled: ${process.env.NEXT_PUBLIC_ENABLE_TRADING || 'false'}`);
console.log('\n🚀 启动应用...');