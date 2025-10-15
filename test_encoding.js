const { ethers } = require('ethers');

async function testEncoding() {
  // 模拟测试中的参数
  const userAddress = '0x4ffDe62cE898639329850eC872A5535F64cb8181';
  const reward = ethers.parseEther('100');  // 100 ETH in wei
  const taskId = 1;

  console.log('参数:');
  console.log('  地址:', userAddress);
  console.log('  奖励:', reward.toString());
  console.log('  任务ID:', taskId);

  // 使用ethers.solidityPacked进行编码
  const encoded = ethers.solidityPacked(
    ['address', 'uint256', 'uint256'],
    [userAddress, reward, taskId]
  );

  console.log('\n编码结果:');
  console.log('  长度:', encoded.length);
  console.log('  十六进制:', encoded);

  // 计算keccak256哈希
  const leaf = ethers.keccak256(encoded);
  console.log('\n叶子节点哈希:');
  console.log('  ', leaf);
  
  // 显示每个部分的十六进制表示
  console.log('\n各部分编码:');
  const addressBytes = ethers.zeroPadValue(userAddress, 32);
  console.log('  地址 (32字节):', addressBytes);
  
  const rewardBytes = ethers.zeroPadValue(ethers.toBeHex(reward), 32);
  console.log('  奖励 (32字节):', rewardBytes);
  
  const taskIdBytes = ethers.zeroPadValue(ethers.toBeHex(taskId), 32);
  console.log('  任务ID (32字节):', taskIdBytes);
}

testEncoding();