// 直接测试后端API（绕过前端代理）
const fetch = require('node-fetch');

const testAddress = '0xb975c82caff9fd068326b0df0ed0ea0d839f24b4';

async function testDirectAPI() {
  console.log('🧪 测试直接调用后端API');
  console.log('================================');

  try {
    console.log('\n1. 测试获取任务列表...');
    const response = await fetch(`http://localhost:8080/api/v1/airdrop/tasks?user_id=${testAddress}`);

    console.log(`状态码: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ 成功获取数据:');
      console.log(JSON.stringify(data, null, 2));

      // 检查是否有userId错误
      if (data.msg && data.msg.includes('userId addr is null')) {
        console.log('❌ 后端仍然期望userId参数，而不是user_id');
        console.log('\n测试使用userId参数...');

        const response2 = await fetch(`http://localhost:8080/api/v1/airdrop/tasks?userId=${testAddress}`);
        console.log(`状态码: ${response2.status}`);

        if (response2.ok) {
          const data2 = await response2.json();
          console.log('✅ userId参数成功:');
          console.log(JSON.stringify(data2, null, 2));
        } else {
          console.log('❌ userId参数也失败');
        }
      }
    } else {
      console.log('❌ 请求失败');
      const text = await response.text();
      console.log('错误内容:', text);
    }

  } catch (error) {
    console.error('❌ 网络错误:', error.message);
  }

  console.log('\n2. 测试开启空投...');
  try {
    const startResponse = await fetch('http://localhost:8080/api/v1/airdrop/task/start?address=0x4aD10F9F9D655B287C7402d3Ebb643bc4b2bE2BF', {
      method: 'POST'
    });

    console.log(`状态码: ${startResponse.status}`);

    if (startResponse.ok) {
      const startData = await startResponse.json();
      console.log('✅ 开启空投成功:');
      console.log(JSON.stringify(startData, null, 2));
    } else {
      console.log('❌ 开启空投失败');
      const startText = await startResponse.text();
      console.log('错误内容:', startText);
    }
  } catch (error) {
    console.error('❌ 开启空投网络错误:', error.message);
  }

  console.log('\n🎯 测试总结:');
  console.log('================================');
  console.log('1. 检查后端API是否响应');
  console.log('2. 确认参数名称（user_id vs userId）');
  console.log('3. 验证开启空投功能');
}

// 运行测试
testDirectAPI().catch(console.error);