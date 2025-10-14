/**
 * Uniswap V3 合约接口定义
 */

import { Address, Abi } from 'viem';
import { UNISWAP_CONFIG, OperationType } from '../config/loadContracts';

// 导入 ABI
import UniswapV3AdapterAbi from '../abi/UniswapV3Adapter.json';
import DefiAggregatorAbi from '../abi/DefiAggregator.json';
import MockERC20Abi from '../abi/MockERC20.json';

// 操作参数类型
export interface OperationParams {
  tokens: Address[];
  amounts: bigint[];
  recipient: Address;
  deadline: bigint;
  tokenId: bigint;
  extraData: `0x${string}`;
}

// 操作结果类型
export interface OperationResult {
  success: boolean;
  outputAmounts: bigint[];
  returnData: `0x${string}`;
  message: string;
}

// 位置信息类型
export interface PositionInfo {
  tokenId: bigint;
  nonce: bigint;
  operator: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  token0ValueUSD?: number;
  token1ValueUSD?: number;
}

// 代币信息类型
export interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance?: bigint;
  allowance?: bigint;
  usdPrice?: number;
}

// 流动性操作参数
export interface AddLiquidityParams {
  token0: Address;
  token1: Address;
  amount0: string;
  amount1: string;
  amount0Min: string;
  amount1Min: string;
  tickLower?: number;
  tickUpper?: number;
  recipient: Address;
  deadline?: number;
}

export interface RemoveLiquidityParams {
  tokenId: bigint;
  amount0Min?: string;
  amount1Min?: string;
  recipient: Address;
  deadline?: number;
}

export interface CollectFeesParams {
  tokenId: bigint;
  recipient: Address;
  deadline?: number;
}

// 交易状态类型
export interface TransactionState {
  hash?: `0x${string}`;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error?: string;
  gasEstimate?: bigint;
}

// 授权状态类型
export interface ApprovalState {
  token0Approved: boolean;
  token1Approved: boolean;
  nftApproved: boolean;
  isLoading: boolean;
  error?: string;
}

// 合约地址配置
export const CONTRACT_ADDRESSES = {
  defiAggregator: UNISWAP_CONFIG.contracts.DefiAggregator as Address,
  uniswapV3Adapter: UNISWAP_CONFIG.contracts.UniswapV3Adapter as Address,
  positionManager: UNISWAP_CONFIG.contracts.MockPositionManager as Address,
  usdtToken: UNISWAP_CONFIG.tokens.USDT.address as Address,
  wethToken: UNISWAP_CONFIG.tokens.WETH.address as Address,
};

// ABI 定义
export const CONTRACT_ABIS = {
  uniswapV3Adapter: UniswapV3AdapterAbi as Abi,
  defiAggregator: DefiAggregatorAbi as Abi,
  mockERC20: MockERC20Abi as Abi,
  // 注意: MockPositionManager 的 ABI 需要从对应文件导入
  mockPositionManager: [] as Abi, // 占位符，需要实际的 ABI
};

// 错误类型
export enum UniswapError {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',
  INVALID_TOKEN_PAIR = 'INVALID_TOKEN_PAIR',
  INVALID_POSITION = 'INVALID_POSITION',
  SLIPPAGE_EXCEEDED = 'SLIPPAGE_EXCEEDED',
  DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

// 事件类型
export interface OperationExecutedEvent {
  user: Address;
  operationType: OperationType;
  tokens: Address[];
  amounts: bigint[];
  returnData: `0x${string}`;
}

export interface FeesCollectedEvent {
  user: Address;
  tokenId: bigint;
  amount0: bigint;
  amount1: bigint;
}

// 工具函数
export const parseTokenAmount = (amount: string, decimals: number): bigint => {
  try {
    return BigInt(Math.floor(parseFloat(amount) * Math.pow(10, decimals)).toString());
  } catch (error) {
    throw new Error(`Invalid token amount: ${amount}`);
  }
};

export const formatTokenAmount = (amount: bigint, decimals: number): string => {
  const divisor = BigInt(Math.pow(10, decimals));
  const whole = amount / divisor;
  const fractional = amount % divisor;

  return `${whole.toString()}.${fractional.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
};

export const encodePriceRange = (tickLower: number, tickUpper: number): `0x${string}` => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setInt32(0, tickLower, true);
  view.setInt32(4, tickUpper, true);
  return `0x${Buffer.from(buffer).toString('hex')}`;
};

export const decodePriceRange = (data: `0x${string}`): { tickLower: number; tickUpper: number } => {
  const buffer = Buffer.from(data.slice(2), 'hex');
  const view = new DataView(buffer.buffer);
  return {
    tickLower: view.getInt32(0, true),
    tickUpper: view.getInt32(4, true),
  };
};