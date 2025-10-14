/**
 * 防止重放攻击的安全模块
 *
 * 本模块实现了多层防护机制来防止 DApp 中的重放攻击：
 * 1. Nonce 管理 - 确保每个交易只被处理一次
 * 2. 交易有效期验证 - 防止过期交易被重放
 * 3. 会话机制 - 使用一次性令牌
 * 4. 链下验证 - 在交易上链前进行验证
 * 5. 业务逻辑防护 - 特定场景的额外保护
 */

import { Address, Hash } from 'viem';
import { keccak256, toHex } from 'viem/utils';

// ==================== 类型定义 ====================

/**
 * 交易元数据接口
 */
export interface TransactionMetadata {
  /** 交易哈希 */
  hash: Hash;
  /** 用户地址 */
  userAddress: Address;
  /** Nonce 值 */
  nonce: bigint;
  /** 交易创建时间戳 */
  timestamp: number;
  /** 交易过期时间戳 */
  expirationTime: number;
  /** 会话 ID */
  sessionId: string;
  /** 交易类型 */
  transactionType: string;
  /** 相关合约地址 */
  contractAddress: Address;
  /** 交易金额 */
  amount: bigint;
  /** 额外的业务上下文数据 */
  businessContext: Record<string, any>;
}

/**
 * Nonce 记录接口
 */
export interface NonceRecord {
  /** 用户地址 */
  userAddress: Address;
  /** 当前 nonce 值 */
  currentNonce: bigint;
  /** 已使用的 nonce 集合 */
  usedNonces: Set<bigint>;
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 会话信息接口
 */
export interface SessionInfo {
  /** 会话 ID */
  sessionId: string;
  /** 用户地址 */
  userAddress: Address;
  /** 会话创建时间 */
  createdAt: number;
  /** 会话过期时间 */
  expiresAt: number;
  /** 已使用的令牌集合 */
  usedTokens: Set<string>;
  /** 会话状态 */
  isActive: boolean;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否验证通过 */
  isValid: boolean;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: string;
  /** 建议操作 */
  suggestion?: string;
}

// ==================== 配置常量 ====================

/**
 * 安全配置常量
 */
export const SECURITY_CONFIG = {
  /** 交易有效期（5分钟） */
  TRANSACTION_EXPIRY_TIME: 5 * 60 * 1000, // 5 minutes in milliseconds

  /** Nonce 缓存清理时间（1小时） */
  NONCE_CACHE_CLEANUP_TIME: 60 * 60 * 1000, // 1 hour

  /** 会话超时时间（30分钟） */
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes

  /** 最大重试次数 */
  MAX_RETRY_ATTEMPTS: 3,

  /** 速率限制窗口（1分钟） */
  RATE_LIMIT_WINDOW: 60 * 1000, // 1 minute

  /** 最大交易次数（每分钟） */
  MAX_TRANSACTIONS_PER_WINDOW: 10,

  /** 紧急暂停阈值 */
  EMERGENCY_PAUSE_THRESHOLD: 50, // 异常交易次数阈值
} as const;

// ==================== Nonce 管理器 ====================

/**
 * Nonce 管理器类
 * 负责管理和跟踪用户交易的非重放序列号
 */
export class NonceManager {
  private nonceRecords = new Map<Address, NonceRecord>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 定期清理过期的 nonce 记录
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRecords();
    }, SECURITY_CONFIG.NONCE_CACHE_CLEANUP_TIME);
  }

  /**
   * 获取用户的下一个可用 nonce
   */
  public getNextNonce(userAddress: Address): bigint {
    const record = this.nonceRecords.get(userAddress);
    if (!record) {
      const initialNonce = this.generateSecureNonce();
      this.nonceRecords.set(userAddress, {
        userAddress,
        currentNonce: initialNonce,
        usedNonces: new Set(),
        lastUpdated: Date.now(),
      });
      return initialNonce;
    }

    // 递增 nonce
    const nextNonce = record.currentNonce + 1n;
    record.currentNonce = nextNonce;
    record.lastUpdated = Date.now();

    return nextNonce;
  }

  /**
   * 验证并使用 nonce
   */
  public validateAndUseNonce(userAddress: Address, nonce: bigint): ValidationResult {
    const record = this.nonceRecords.get(userAddress);

    if (!record) {
      return {
        isValid: false,
        errorCode: 'NONCE_RECORD_NOT_FOUND',
        error: '用户 nonce 记录不存在',
        suggestion: '请刷新页面重新开始交易',
      };
    }

    // 检查 nonce 是否已被使用
    if (record.usedNonces.has(nonce)) {
      return {
        isValid: false,
        errorCode: 'NONCE_ALREADY_USED',
        error: '该 nonce 已被使用，可能存在重放攻击',
        suggestion: '请检查交易安全，如有疑问请联系客服',
      };
    }

    // 检查 nonce 是否在合理范围内
    if (nonce > record.currentNonce + 10n) {
      return {
        isValid: false,
        errorCode: 'NONCE_TOO_HIGH',
        error: 'Nonce 值超出合理范围',
        suggestion: '请使用正确的 nonce 值',
      };
    }

    // 标记 nonce 为已使用
    record.usedNonces.add(nonce);
    record.lastUpdated = Date.now();

    return {
      isValid: true,
    };
  }

  /**
   * 生成安全的随机 nonce
   */
  private generateSecureNonce(): bigint {
    // 使用当前时间戳和随机数生成安全的 nonce
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    return BigInt(timestamp * 1000000 + random);
  }

  /**
   * 清理过期的记录
   */
  private cleanupExpiredRecords(): void {
    const now = Date.now();
    const expireTime = SECURITY_CONFIG.NONCE_CACHE_CLEANUP_TIME;

    for (const [address, record] of this.nonceRecords.entries()) {
      if (now - record.lastUpdated > expireTime) {
        this.nonceRecords.delete(address);
        console.log(`🧹 清理过期的 nonce 记录: ${address}`);
      }
    }
  }

  /**
   * 销毁管理器，清理资源
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.nonceRecords.clear();
  }
}

// ==================== 交易有效期验证器 ====================

/**
 * 交易有效期验证器
 * 确保交易在有效期内执行，防止过期交易被重放
 */
export class TransactionExpiryValidator {
  /**
   * 验证交易是否在有效期内
   */
  public validateTransactionExpiry(
    creationTime: number,
    currentTime: number = Date.now()
  ): ValidationResult {
    const timeDiff = currentTime - creationTime;

    if (timeDiff > SECURITY_CONFIG.TRANSACTION_EXPIRY_TIME) {
      return {
        isValid: false,
        errorCode: 'TRANSACTION_EXPIRED',
        error: `交易已过期（超过 ${SECURITY_CONFIG.TRANSACTION_EXPIRY_TIME / 1000} 秒）`,
        suggestion: '请重新创建并提交交易',
      };
    }

    // 检查交易时间戳是否异常（未来时间）
    if (creationTime > currentTime + 5000) { // 允许5秒的时钟偏差
      return {
        isValid: false,
        errorCode: 'INVALID_TIMESTAMP',
        error: '交易时间戳异常，可能存在安全问题',
        suggestion: '请检查系统时间并重试',
      };
    }

    return {
      isValid: true,
    };
  }

  /**
   * 生成交易过期时间
   */
  public generateExpirationTime(): number {
    return Date.now() + SECURITY_CONFIG.TRANSACTION_EXPIRY_TIME;
  }

  /**
   * 检查交易是否即将过期
   */
  public isTransactionExpiringSoon(expirationTime: number): boolean {
    const timeRemaining = expirationTime - Date.now();
    return timeRemaining < 30000; // 30秒内即将过期
  }
}

// ==================== 会话管理器 ====================

/**
 * 会话管理器
 * 管理用户会话和一次性令牌，提供额外的安全层
 */
export class SessionManager {
  private sessions = new Map<string, SessionInfo>();
  private userSessions = new Map<Address, Set<string>>(); // 用户地址到会话ID的映射

  /**
   * 创建新会话
   */
  public createSession(userAddress: Address): string {
    const sessionId = this.generateSecureSessionId();
    const now = Date.now();

    const session: SessionInfo = {
      sessionId,
      userAddress,
      createdAt: now,
      expiresAt: now + SECURITY_CONFIG.SESSION_TIMEOUT,
      usedTokens: new Set(),
      isActive: true,
    };

    this.sessions.set(sessionId, session);

    // 更新用户会话映射
    if (!this.userSessions.has(userAddress)) {
      this.userSessions.set(userAddress, new Set());
    }
    this.userSessions.get(userAddress)!.add(sessionId);

    console.log(`🔐 创建新会话: ${sessionId} for user: ${userAddress}`);
    return sessionId;
  }

  /**
   * 生成一次性令牌
   */
  public generateOneTimeToken(sessionId: string, context?: string): string {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      throw new Error('无效的会话');
    }

    const tokenData = {
      sessionId,
      timestamp: Date.now(),
      random: Math.random().toString(36),
      context: context || '',
    };

    const token = keccak256(toHex(JSON.stringify(tokenData)));

    // 记录令牌（在实际应用中应该使用更安全的方式）
    session.usedTokens.add(token);

    return token;
  }

  /**
   * 验证令牌
   */
  public validateToken(
    token: string,
    sessionId: string,
    userAddress: Address
  ): ValidationResult {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        isValid: false,
        errorCode: 'SESSION_NOT_FOUND',
        error: '会话不存在或已过期',
        suggestion: '请重新登录并重试',
      };
    }

    if (session.userAddress !== userAddress) {
      return {
        isValid: false,
        errorCode: 'SESSION_MISMATCH',
        error: '会话与用户不匹配',
        suggestion: '请检查登录状态',
      };
    }

    if (!session.isActive) {
      return {
        isValid: false,
        errorCode: 'SESSION_INACTIVE',
        error: '会话已被禁用',
        suggestion: '请重新登录',
      };
    }

    if (Date.now() > session.expiresAt) {
      this.deactivateSession(sessionId);
      return {
        isValid: false,
        errorCode: 'SESSION_EXPIRED',
        error: '会话已过期',
        suggestion: '请重新登录',
      };
    }

    // 在实际应用中，这里应该验证令牌的签名
    // 为了演示，我们简单检查令牌格式
    if (!token.startsWith('0x') || token.length !== 66) {
      return {
        isValid: false,
        errorCode: 'INVALID_TOKEN_FORMAT',
        error: '令牌格式无效',
        suggestion: '请重新获取令牌',
      };
    }

    return {
      isValid: true,
    };
  }

  /**
   * 停用会话
   */
  public deactivateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;

      // 从用户会话映射中移除
      const userSessionSet = this.userSessions.get(session.userAddress);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
        if (userSessionSet.size === 0) {
          this.userSessions.delete(session.userAddress);
        }
      }
    }
  }

  /**
   * 清理过期会话
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.deactivateSession(sessionId);
        this.sessions.delete(sessionId);
        console.log(`🧹 清理过期会话: ${sessionId}`);
      }
    }
  }

  /**
   * 生成安全的会话ID
   */
  private generateSecureSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const data = `${timestamp}-${random}`;
    return keccak256(toHex(data)).substring(0, 20);
  }
}

// ==================== 链下验证器 ====================

/**
 * 链下验证器
 * 在交易上链前进行全面的验证
 */
export class OffChainValidator {
  private nonceManager: NonceManager;
  private expiryValidator: TransactionExpiryValidator;
  private sessionManager: SessionManager;
  private rateLimitMap = new Map<Address, number[]>(); // 用户地址到交易时间戳的映射

  constructor() {
    this.nonceManager = new NonceManager();
    this.expiryValidator = new TransactionExpiryValidator();
    this.sessionManager = new SessionManager();
  }

  /**
   * 全面验证交易
   */
  public async validateTransaction(
    metadata: TransactionMetadata,
    oneTimeToken?: string
  ): Promise<ValidationResult> {
    console.log(`🔍 开始链下验证交易: ${metadata.hash}`);

    // 1. 验证交易基本信息
    const basicValidation = this.validateBasicTransaction(metadata);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // 2. 验证 nonce
    const nonceValidation = this.nonceManager.validateAndUseNonce(
      metadata.userAddress,
      metadata.nonce
    );
    if (!nonceValidation.isValid) {
      return nonceValidation;
    }

    // 3. 验证交易有效期
    const expiryValidation = this.expiryValidator.validateTransactionExpiry(
      metadata.timestamp
    );
    if (!expiryValidation.isValid) {
      return expiryValidation;
    }

    // 4. 验证会话和令牌（如果提供）
    if (oneTimeToken) {
      const tokenValidation = this.sessionManager.validateToken(
        oneTimeToken,
        metadata.sessionId,
        metadata.userAddress
      );
      if (!tokenValidation.isValid) {
        return tokenValidation;
      }
    }

    // 5. 验证速率限制
    const rateLimitValidation = this.validateRateLimit(metadata.userAddress);
    if (!rateLimitValidation.isValid) {
      return rateLimitValidation;
    }

    // 6. 验证业务逻辑
    const businessValidation = this.validateBusinessLogic(metadata);
    if (!businessValidation.isValid) {
      return businessValidation;
    }

    console.log(`✅ 交易验证通过: ${metadata.hash}`);
    return {
      isValid: true,
    };
  }

  /**
   * 验证交易基本信息
   */
  private validateBasicTransaction(metadata: TransactionMetadata): ValidationResult {
    // 验证必要字段
    if (!metadata.userAddress || !metadata.hash || !metadata.contractAddress) {
      return {
        isValid: false,
        errorCode: 'MISSING_REQUIRED_FIELDS',
        error: '交易缺少必要字段',
        suggestion: '请检查交易信息完整性',
      };
    }

    // 验证地址格式
    if (!metadata.userAddress.startsWith('0x') || metadata.userAddress.length !== 42) {
      return {
        isValid: false,
        errorCode: 'INVALID_USER_ADDRESS',
        error: '用户地址格式无效',
        suggestion: '请检查钱包地址',
      };
    }

    // 验证交易哈希格式
    if (!metadata.hash.startsWith('0x') || metadata.hash.length !== 66) {
      return {
        isValid: false,
        errorCode: 'INVALID_TRANSACTION_HASH',
        error: '交易哈希格式无效',
        suggestion: '请检查交易信息',
      };
    }

    return {
      isValid: true,
    };
  }

  /**
   * 验证速率限制
   */
  private validateRateLimit(userAddress: Address): ValidationResult {
    const now = Date.now();
    const windowStart = now - SECURITY_CONFIG.RATE_LIMIT_WINDOW;

    // 获取用户最近的交易时间戳
    let userTransactions = this.rateLimitMap.get(userAddress) || [];

    // 清理超出窗口的交易记录
    userTransactions = userTransactions.filter(timestamp => timestamp > windowStart);

    // 检查是否超过限制
    if (userTransactions.length >= SECURITY_CONFIG.MAX_TRANSACTIONS_PER_WINDOW) {
      return {
        isValid: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        error: `交易频率过高，${SECURITY_CONFIG.RATE_LIMIT_WINDOW / 1000}秒内最多允许 ${SECURITY_CONFIG.MAX_TRANSACTIONS_PER_WINDOW} 次交易`,
        suggestion: '请稍后再试',
      };
    }

    // 添加当前交易时间戳
    userTransactions.push(now);
    this.rateLimitMap.set(userAddress, userTransactions);

    return {
      isValid: true,
    };
  }

  /**
   * 验证业务逻辑
   */
  private validateBusinessLogic(metadata: TransactionMetadata): ValidationResult {
    // 验证交易金额
    if (metadata.amount < 0) {
      return {
        isValid: false,
        errorCode: 'INVALID_AMOUNT',
        error: '交易金额无效',
        suggestion: '请检查交易金额',
      };
    }

    // 检查大额交易的特殊验证
    const isLargeAmount = metadata.amount > BigInt('1000000000000000000000'); // 1000 ETH equivalent
    if (isLargeAmount) {
      console.warn(`⚠️ 检测到大额交易: ${metadata.amount} for user: ${metadata.userAddress}`);
      // 在实际应用中，可能需要额外的验证步骤，如邮件确认、二次验证等
    }

    // 验证交易类型
    const allowedTransactionTypes = ['buy', 'sell', 'approve', 'transfer'];
    if (!allowedTransactionTypes.includes(metadata.transactionType.toLowerCase())) {
      return {
        isValid: false,
        errorCode: 'INVALID_TRANSACTION_TYPE',
        error: '不支持的交易类型',
        suggestion: '请使用支持的交易类型',
      };
    }

    return {
      isValid: true,
    };
  }

  /**
   * 创建新的用户会话
   */
  public createSession(userAddress: Address): string {
    return this.sessionManager.createSession(userAddress);
  }

  /**
   * 获取用户的下一个 nonce
   */
  public getNextNonce(userAddress: Address): bigint {
    return this.nonceManager.getNextNonce(userAddress);
  }

  /**
   * 生成一次性令牌
   */
  public generateOneTimeToken(sessionId: string, context?: string): string {
    return this.sessionManager.generateOneTimeToken(sessionId, context);
  }

  /**
   * 清理资源
   */
  public cleanup(): void {
    this.nonceManager.destroy();
    this.sessionManager.cleanupExpiredSessions();
    this.rateLimitMap.clear();
  }
}

// ==================== 导出实例 ====================

/**
 * 全局安全验证器实例
 */
export const securityValidator = new OffChainValidator();

/**
 * 便捷方法：创建交易元数据
 */
export function createTransactionMetadata(
  hash: Hash,
  userAddress: Address,
  contractAddress: Address,
  amount: bigint,
  transactionType: string,
  businessContext?: Record<string, any>
): TransactionMetadata {
  const now = Date.now();
  const expiryValidator = new TransactionExpiryValidator();

  return {
    hash,
    userAddress,
    nonce: securityValidator.getNextNonce(userAddress),
    timestamp: now,
    expirationTime: expiryValidator.generateExpirationTime(),
    sessionId: securityValidator.createSession(userAddress),
    transactionType,
    contractAddress,
    amount,
    businessContext: businessContext || {},
  };
}

/**
 * 便捷方法：验证交易
 */
export async function validateTransaction(
  metadata: TransactionMetadata,
  oneTimeToken?: string
): Promise<ValidationResult> {
  return await securityValidator.validateTransaction(metadata, oneTimeToken);
}

// ==================== 错误处理 ====================

/**
 * 安全相关错误类
 */
export class SecurityError extends Error {
  public errorCode: string;
  public suggestion?: string;

  constructor(errorCode: string, message: string, suggestion?: string) {
    super(message);
    this.name = 'SecurityError';
    this.errorCode = errorCode;
    this.suggestion = suggestion;
  }
}

/**
 * 常用安全错误
 */
export const SECURITY_ERRORS = {
  NONCE_ALREADY_USED: (suggestion?: string) =>
    new SecurityError('NONCE_ALREADY_USED', '该 nonce 已被使用，可能存在重放攻击', suggestion),

  TRANSACTION_EXPIRED: (suggestion?: string) =>
    new SecurityError('TRANSACTION_EXPIRED', '交易已过期，可能存在重放攻击', suggestion),

  SESSION_INVALID: (suggestion?: string) =>
    new SecurityError('SESSION_INVALID', '会话无效或已过期', suggestion),

  RATE_LIMIT_EXCEEDED: (suggestion?: string) =>
    new SecurityError('RATE_LIMIT_EXCEEDED', '交易频率过高，可能存在攻击行为', suggestion),

  INVALID_SIGNATURE: (suggestion?: string) =>
    new SecurityError('INVALID_SIGNATURE', '签名验证失败', suggestion),
} as const;