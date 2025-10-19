import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 格式化地址显示，只显示前几位和后几位，中间用省略号
 * @param address 钱包地址或合约地址
 * @param startLength 前面显示的字符数量，默认4
 * @param endLength 后面显示的字符数量，默认4
 * @returns 格式化后的地址，例如: 0x1234...5678
 */
export function formatAddress(address: string, startLength: number = 4, endLength: number = 4): string {
  if (!address) return '';

  // 确保地址长度足够
  if (address.length <= startLength + endLength) {
    return address;
  }

  const start = address.slice(0, startLength);
  const end = address.slice(-endLength);

  return `${start}...${end}`;
}

/**
 * 格式化地址显示，包含"0x"前缀
 * @param address 钱包地址或合约地址
 * @param startLength 前面显示的字符数量（不包含0x），默认4
 * @param endLength 后面显示的字符数量，默认4
 * @returns 格式化后的地址，例如: 0x1234...5678
 */
export function formatAddressWithPrefix(address: string, startLength: number = 4, endLength: number = 4): string {
  if (!address) return '';

  // 如果地址以0x开头，保留0x
  const hasPrefix = address.startsWith('0x');
  const cleanAddress = hasPrefix ? address : `0x${address}`;

  return formatAddress(cleanAddress, startLength + 2, endLength);
}