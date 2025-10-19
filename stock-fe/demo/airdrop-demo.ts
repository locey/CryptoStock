// 空投功能演示脚本
import { useAirdrop } from '../hooks/useAirdrop';

// 模拟 wagmi account
const mockAccount = {
  address: '0x1234567890123456789012345678901234567890',
  isConnected: true
};

// 模拟空投任务数据
const mockAirdropTasks = [
  {
    id: 1,
    name: "早期用户奖励",
    description: "完成平台注册并进行首次交易",
    reward_amount: 100,
    status: "active" as const,
    user_status: null as string | null,
    end_date: "2024-12-31T23:59:59Z",
    max_participants: 1000,
    current_participants: 256
  },
  {
    id: 2,
    name: "流动性提供奖励",
    description: "向币股池提供流动性超过7天",
    reward_amount: 200,
    status: "active" as const,
    user_status: "claimed" as const,
    claimed_at: "2024-10-18T10:30:00Z",
    end_date: "2024-12-31T23:59:59Z",
    max_participants: 500,
    current_participants: 128
  },
  {
    id: 3,
    name: "社交活动奖励",
    description: "关注官方社交媒体并转发活动内容",
    reward_amount: 50,
    status: "completed" as const,
    user_status: "completed" as const,
    proof: '["0x123...", "0x456..."]',
    reward: "50",
    reward_claimed_at: "2024-10-15T10:30:00Z"
  }
];

// 演示函数
export function demoAirdropFunctionality() {
  console.log('🎯 CryptoStock 空投功能演示');
  console.log('=====================================\n');

  // 1. 显示任务统计
  console.log('📊 空投任务统计:');
  const availableTasks = mockAirdropTasks.filter(t => t.status === "active" && !t.user_status);
  const pendingRewards = mockAirdropTasks.filter(t => t.user_status === "completed");
  const claimedRewards = mockAirdropTasks.filter(t => t.user_status === "rewarded");

  console.log(`   可参与任务: ${availableTasks.length}`);
  console.log(`   待领取奖励: ${pendingRewards.length}`);
  console.log(`   已获得奖励: ${claimedRewards.length}\n`);

  // 2. 显示任务列表
  console.log('📋 任务列表:');
  mockAirdropTasks.forEach((task, index) => {
    const statusIcon = getStatusIcon(task.user_status);
    const statusBadge = getStatusBadge(task.user_status);
    const actionButton = getActionButton(task);

    console.log(`\n   ${index + 1}. ${task.name}`);
    console.log(`      ${statusIcon} ${statusBadge}`);
    console.log(`      描述: ${task.description}`);
    console.log(`      奖励: ${task.reward_amount} CS`);

    if (task.end_date) {
      console.log(`      截止: ${new Date(task.end_date).toLocaleDateString()}`);
    }

    if (task.current_participants && task.max_participants) {
      console.log(`      进度: ${task.current_participants}/${task.max_participants}`);
    }

    console.log(`      操作: ${actionButton}`);
  });

  console.log('\n🔗 API 调用示例:');
  console.log('=====================================');

  // 3. 模拟API调用
  console.log('\n1. 获取用户任务列表:');
  console.log('GET /api/v1/airdrop/tasks?user_id=0x1234567890123456789012345678901234567890');

  console.log('\n2. 领取任务:');
  console.log('POST /api/v1/airdrop/claim');
  console.log('Body: {');
  console.log('  "user_id": "0x1234567890123456789012345678901234567890",');
  console.log('  "task_id": 1,');
  console.log('  "address": "0x1234567890123456789012345678901234567890"');
  console.log('}');

  console.log('\n3. 领取奖励:');
  console.log('POST /api/v1/airdrop/claimReward');
  console.log('Body: {');
  console.log('  "user_id": "0x1234567890123456789012345678901234567890",');
  console.log('  "task_id": 1,');
  console.log('  "address": "0x1234567890123456789012345678901234567890"');
  console.log('}');

  console.log('\n4. 开启空投 (管理员):');
  console.log('POST /api/v1/airdrop/task/start?address=0x4aD10F9F9D655B287C7402d3Ebb643bc4b2bE2BF');

  console.log('\n✨ 功能特点:');
  console.log('=====================================');
  console.log('✅ 基于真实后端API的集成');
  console.log('✅ 完整的错误处理机制');
  console.log('✅ 实时状态更新');
  console.log('✅ 用户友好的界面设计');
  console.log('✅ 响应式布局支持');
  console.log('✅ TypeScript 类型安全');
  console.log('✅ 钱包连接集成');
  console.log('✅ 管理员功能支持');

  console.log('\n🚀 下一步开发:');
  console.log('=====================================');
  console.log('1. 添加 Toast 通知系统');
  console.log('2. 集成实时价格数据');
  console.log('3. 添加任务历史记录');
  console.log('4. 实现批量操作功能');
  console.log('5. 添加任务分享功能');
  console.log('6. 优化移动端体验');
  console.log('7. 添加更多统计分析');
}

// 辅助函数
function getStatusIcon(status?: string | null): string {
  switch (status) {
    case "claimed":
      return "🕐"; // Clock
    case "completed":
      return "✅"; // CheckCircle
    case "rewarded":
      return "🏆"; // Trophy
    default:
      return "⚪"; // AlertCircle
  }
}

function getStatusBadge(status?: string | null): string {
  switch (status) {
    case "claimed":
      return "[已领取]";
    case "completed":
      return "[已完成]";
    case "rewarded":
      return "[已奖励]";
    default:
      return "[未参与]";
  }
}

function getActionButton(task: any): string {
  switch (task.user_status) {
    case "claimed":
    case "completed":
      return "领取奖励";
    case "rewarded":
      return "已领取奖励";
    default:
      return task.status === "active" ? "参与任务" : "任务已结束";
  }
}

// 如果直接运行此文件
if (typeof require !== 'undefined' && require.main === module) {
  demoAirdropFunctionality();
}