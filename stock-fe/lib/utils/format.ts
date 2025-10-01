/**
 * 数字格式化工具
 */

// 格式化数字
export const formatNumber = (num: number, decimals: number = 2): string => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(decimals)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(decimals)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(decimals)}K`;
  return `$${num.toFixed(decimals)}`;
};

// 格式化价格
export const formatPrice = (price: number, decimals: number = 2): string => {
  return `$${price.toFixed(decimals)}`;
};

// 格式化百分比
export const formatPercent = (percent: number, decimals: number = 2): string => {
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(decimals)}%`;
};

// 格式化代币数量
export const formatTokenAmount = (amount: number, decimals: number = 4): string => {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(decimals)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(decimals)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(decimals)}K`;
  return amount.toFixed(decimals);
};

// 格式化时间戳
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString('zh-CN');
};

// 格式化地址
export const formatAddress = (address: string, length: number = 6): string => {
  if (!address) return '';
  return `${address.slice(0, length)}...${address.slice(-length)}`;
};

// 数字缩写
export const abbreviateNumber = (num: number, decimals: number = 1): string => {
  if (num >= 1e12) return `${(num / 1e12).toFixed(decimals)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(decimals)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(decimals)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(decimals)}K`;
  return num.toFixed(decimals);
};

// 科学计数法转换
export const fromScientificNotation = (num: string): number => {
  return parseFloat(num);
};

// 精确计算（避免浮点数精度问题）
export const preciseAdd = (a: number, b: number): number => {
  return parseFloat((a + b).toFixed(10));
};

export const preciseSubtract = (a: number, b: number): number => {
  return parseFloat((a - b).toFixed(10));
};

export const preciseMultiply = (a: number, b: number): number => {
  return parseFloat((a * b).toFixed(10));
};

export const preciseDivide = (a: number, b: number): number => {
  return parseFloat((a / b).toFixed(10));
};

// 计算百分比变化
export const calculatePercentChange = (oldValue: number, newValue: number): number => {
  if (oldValue === 0) return 0;
  return ((newValue - oldValue) / oldValue) * 100;
};

// 格式化大数字（用于显示）
export const formatLargeNumber = (num: number): string => {
  if (num >= 1e15) return `${(num / 1e15).toFixed(1)}Q`;
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toFixed(0);
};

// 格式化市值（专门用于极大数字）
export const formatMarketCap = (num: number): string => {
  if (num >= 1e15) return `$${(num / 1e15).toFixed(1)}Q`;
  if (num >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

// 价格颜色类名
export const getPriceColorClass = (change: number): string => {
  if (change > 0) return 'text-green-400';
  if (change < 0) return 'text-red-400';
  return 'text-gray-400';
};

// 格式化文件大小
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 格式化哈希
export const formatHash = (hash: string, length: number = 10): string => {
  if (!hash) return '';
  return `${hash.slice(0, length)}...${hash.slice(-length)}`;
};

// 计算时间差
export const getTimeDifference = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp * 1000;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  return '刚刚';
};

// 安全的数字解析
export const safeParseNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
};