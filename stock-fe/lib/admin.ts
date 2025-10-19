/**
 * 管理员工具函数
 */

// 从环境变量获取管理员地址列表
export const getAdminAddresses = (): string[] => {
  const envAddresses = process.env.NEXT_PUBLIC_ADMIN_ADDRESSES;

  if (envAddresses) {
    return envAddresses
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0 && addr.startsWith('0x'));
  }

  // 默认管理员地址
  return ["0xb975c82caff9fd068326b0df0ed0ea0d839f24b4"];
};

// 检查地址是否为管理员
export const isAdminAddress = (address?: string): boolean => {
  if (!address) return false;

  const adminAddresses = getAdminAddresses();
  return adminAddresses.some(
    adminAddr => adminAddr.toLowerCase() === address.toLowerCase()
  );
};

// 获取管理员设置信息
export const getAdminSettings = () => {
  return {
    addresses: getAdminAddresses(),
    count: getAdminAddresses().length,
    hasMultipleAdmins: getAdminAddresses().length > 1,
  };
};

// 管理员密码（生产环境中应该使用更安全的方式）
export const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";

// 检查是否为开发环境
export const isDevelopment = () => {
  return process.env.NODE_ENV === 'development';
};

// 管理员操作日志记录
export const logAdminAction = (action: string, address?: string, details?: any) => {
  if (isDevelopment()) {
    console.log(`[ADMIN ACTION] ${action}`, {
      address,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  // 在生产环境中，这里应该发送到日志服务
  // await sendToLogService({ action, address, details, timestamp: new Date().toISOString() });
};

// 验证管理员权限
export const validateAdminPermission = (userAddress?: string): boolean => {
  if (!userAddress) {
    logAdminAction('ADMIN_ACCESS_DENIED', userAddress, { reason: 'No address provided' });
    return false;
  }

  const hasPermission = isAdminAddress(userAddress);

  if (hasPermission) {
    logAdminAction('ADMIN_ACCESS_GRANTED', userAddress);
  } else {
    logAdminAction('ADMIN_ACCESS_DENIED', userAddress, { reason: 'Address not in admin list' });
  }

  return hasPermission;
};