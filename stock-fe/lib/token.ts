// ERC20 代币合约地址配置

export const ERC20_TOKEN_ADDRESS = "0x5Bdc7B53532c548d3bBa70268E38410Eb8332b80" as const;
export const AIRDROP_CONTRACT_ADDRESS = "0x4aD10F9F9D655B287C7402d3Ebb643bc4b2bE2BF" as const;

// 网络配置
export const NETWORK_CONFIG = {
  sepolia: {
    name: "Sepolia Testnet",
    chainId: 11155111,
    rpcUrl: "https://rpc.ankr.com/eth_sepolia",
    explorerUrl: "https://sepolia.etherscan.io",
  }
};

// 获取代币浏览器链接
export function getTokenExplorerUrl(address: string): string {
  return `${NETWORK_CONFIG.sepolia.explorerUrl}/token/${address}`;
}

// 获取交易浏览器链接
export function getTransactionExplorerUrl(txHash: string): string {
  return `${NETWORK_CONFIG.sepolia.explorerUrl}/tx/${txHash}`;
}

// 获取地址浏览器链接
export function getAddressExplorerUrl(address: string): string {
  return `${NETWORK_CONFIG.sepolia.explorerUrl}/address/${address}`;
}

// 代币信息接口
export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply?: string;
}

// 获取代币缩写名称
export function getTokenSymbol(address: string): string {
  // 根据地址返回已知的代币符号
  if (address.toLowerCase() === ERC20_TOKEN_ADDRESS.toLowerCase()) {
    return "CS"; // CryptoStock Token
  }
  return "UNKNOWN";
}

// 格式化代币余额
export function formatTokenBalance(balance: string, decimals: number = 18): string {
  const balanceBig = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const wholePart = balanceBig / divisor;
  const fractionalPart = balanceBig % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  return `${wholePart}.${fractionalPart.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}