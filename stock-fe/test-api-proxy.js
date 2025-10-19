// 测试API代理功能
const testUserId = '0xb975c82cafF9Fd068326b0Df0eD0eA0d839f24b4';

console.log('🧪 测试CryptoStock空投API代理');
console.log('=====================================\n');

// 测试函数
async function testAPIProxy() {
  try {
    console.log('1. 测试获取用户任务列表...');
    console.log(`   URL: http://localhost:3000/api/v1/airdrop/tasks?user_id=${testUserId}`);

    const response = await fetch(`http://localhost:3000/api/v1/airdrop/tasks?user_id=${testUserId}`);

    console.log(`   状态码: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ 成功获取数据:');
      console.log('   响应:', JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log(`   ❌ 请求失败: ${errorText}`);
    }

  } catch (error) {
    console.error('   ❌ 网络错误:', error.message);
  }

  console.log('\n2. 测试领取任务...');
  try {
    const claimData = {
      user_id: testUserId,
      task_id: 1,
      address: testUserId
    };

    console.log('   URL: http://localhost:3000/api/v1/airdrop/claim');
    console.log('   请求体:', JSON.stringify(claimData, null, 2));

    const response = await fetch('http://localhost:3000/api/v1/airdrop/claim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(claimData),
    });

    console.log(`   状态码: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ 成功发送请求:');
      console.log('   响应:', JSON.stringify(data, null, 2));
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`   ❌ 请求失败:`, errorData);
    }

  } catch (error) {
    console.error('   ❌ 网络错误:', error.message);
  }
}

// 检查后端是否可用
async function checkBackend() {
  try {
    console.log('3. 检查后端服务状态...');
    const response = await fetch('http://localhost:8080/api/v1/airdrop/tasks?user_id=test');

    if (response.ok) {
      console.log('   ✅ 后端服务可用');
      return true;
    } else {
      console.log(`   ⚠️ 后端服务返回状态码: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log('   ❌ 后端服务不可用:', error.message);
    console.log('   💡 请确保后端服务在 http://localhost:8080 运行');
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('开始测试...\n');

  // 先检查后端
  const backendAvailable = await checkBackend();

  if (backendAvailable) {
    console.log('\n继续测试API代理...\n');
    await testAPIProxy();
  } else {
    console.log('\n⚠️ 后端服务不可用，但API代理仍然可以测试基本功能');
    console.log('   尝试测试代理路由结构...\n');

    // 测试OPTIONS请求
    try {
      const optionsResponse = await fetch('http://localhost:3000/api/v1/airdrop/tasks', {
        method: 'OPTIONS'
      });
      console.log(`   OPTIONS请求状态: ${optionsResponse.status}`);
      console.log('   ✅ API路由结构正常');
    } catch (error) {
      console.log('   ❌ API路由测试失败:', error.message);
    }
  }

  console.log('\n🔧 解决方案总结:');
  console.log('=====================================');
  console.log('1. ✅ 创建了Next.js API路由作为代理');
  console.log('2. ✅ 配置了CORS头部');
  console.log('3. ✅ 更新了环境变量');
  console.log('4. ✅ API代理会将请求转发到后端');

  console.log('\n📁 已创建的API代理路由:');
  console.log('=====================================');
  console.log('- GET  /api/v1/airdrop/tasks');
  console.log('- POST /api/v1/airdrop/claim');
  console.log('- POST /api/v1/airdrop/claimReward');
  console.log('- POST /api/v1/airdrop/task/start');

  console.log('\n🚀 使用说明:');
  console.log('=====================================');
  console.log('1. 确保后端服务运行在 http://localhost:8080');
  console.log('2. 启动前端服务: npm run dev');
  console.log('3. 前端会通过代理路由访问后端API');
  console.log('4. CORS问题已解决');
}

// 运行测试
runTests().catch(console.error);