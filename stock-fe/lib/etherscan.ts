// Etherscan API 相关功能

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
const ETHERSCAN_BASE_URL = 'https://api-sepolia.etherscan.io';

// Etherscan API 响应类型
interface EtherscanTokenBalanceResponse {
  status: string;
  message: string;
  result: string;
}

// 获取代币余额
export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  try {
    const url = `${ETHERSCAN_BASE_URL}/api?module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${walletAddress}&tag=latest&apikey=${ETHERSCAN_API_KEY}`;

    const response = await fetch(url);
    const data: EtherscanTokenBalanceResponse = await response.json();

    if (data.status === '1') {
      return data.result;
    } else {
      throw new Error(data.message || 'Failed to fetch token balance');
    }
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return '0';
  }
}

// 获取多个地址的代币余额
export async function getMultipleTokenBalances(
  tokenAddress: string,
  walletAddresses: string[]
): Promise<{ [address: string]: string }> {
  try {
    const addresses = walletAddresses.join(',');
    const url = `${ETHERSCAN_BASE_URL}/api?module=account&action=tokendistro&contractaddress=${tokenAddress}&addresses=${addresses}&page=1&offset=1000&apikey=${ETHERSCAN_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      const balances: { [address: string]: string } = {};
      data.result.forEach((item: any) => {
        balances[item.account] = item.balance;
      });
      return balances;
    } else {
      throw new Error(data.message || 'Failed to fetch token balances');
    }
  } catch (error) {
    console.error('Error fetching multiple token balances:', error);
    return {};
  }
}

// 获取代币信息
export async function getTokenInfo(tokenAddress: string) {
  try {
    const url = `${ETHERSCAN_BASE_URL}/api?module=token&action=getTokeninfo&contractaddress=${tokenAddress}&apikey=${ETHERSCAN_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && data.result) {
      return {
        symbol: data.result.symbol,
        name: data.result.name,
        decimals: parseInt(data.result.divimals),
        totalSupply: data.result.totalSupply
      };
    } else {
      throw new Error(data.message || 'Failed to fetch token info');
    }
  } catch (error) {
    console.error('Error fetching token info:', error);
    return null;
  }
}