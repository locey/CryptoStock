/**
 * 安全验证 Hook
 *
 * 这个 Hook 提供了安全验证功能，可以轻松集成到现有的交易流程中
 * 防止重放攻击，确保交易的安全性
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Address, Hash } from 'viem';
import { useToast } from '@/hooks/use-toast';
import {
  securityValidator,
  createTransactionMetadata,
  validateTransaction,
  TransactionMetadata,
  ValidationResult,
  SecurityError,
  SECURITY_ERRORS,
} from '@/lib/security/replay-attack-prevention';

// ==================== 类型定义 ====================

/**
 * 安全验证状态
 */
export interface SecurityValidationState {
  /** 是否正在验证 */
  isValidating: boolean;
  /** 验证结果 */
  validationResult: ValidationResult | null;
  /** 当前会话 ID */
  sessionId: string | null;
  /** 当前 nonce */
  currentNonce: bigint | null;
  /** 错误信息 */
  error: string | null;
}

/**
 * 交易安全参数
 */
export interface TransactionSecurityParams {
  /** 用户地址 */
  userAddress: Address;
  /** 合约地址 */
  contractAddress: Address;
  /** 交易金额 */
  amount: bigint;
  /** 交易类型 */
  transactionType: string;
  /** 业务上下文 */
  businessContext?: Record<string, any>;
}

/**
 * 安全验证返回值
 */
export interface UseSecurityValidationReturn {
  /** 状态 */
  state: SecurityValidationState;

  /** 操作方法 */
  /** 创建安全的交易元数据 */
  createSecureTransaction: (
    hash: Hash,
    params: TransactionSecurityParams
  ) => Promise<{ metadata: TransactionMetadata; oneTimeToken: string }>;

  /** 验证交易 */
  validateTransaction: (
    metadata: TransactionMetadata,
    oneTimeToken?: string
  ) => Promise<ValidationResult>;

  /** 获取一次性令牌 */
  getOneTimeToken: (context?: string) => Promise<string>;

  /** 重置状态 */
  resetState: () => void;

  /** 检查交易是否即将过期 */
  isTransactionExpiringSoon: (metadata: TransactionMetadata) => boolean;
}

// ==================== Hook 实现 ====================

/**
 * 安全验证 Hook
 */
export const useSecurityValidation = (): UseSecurityValidationReturn => {
  const { toast } = useToast();

  // 状态管理
  const [state, setState] = useState<SecurityValidationState>({
    isValidating: false,
    validationResult: null,
    sessionId: null,
    currentNonce: null,
    error: null,
  });

  // 清理定时器引用
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 创建安全的交易元数据
   */
  const createSecureTransaction = useCallback(async (
    hash: Hash,
    params: TransactionSecurityParams
  ): Promise<{ metadata: TransactionMetadata; oneTimeToken: string }> => {
    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
      console.log('🔐 创建安全交易元数据...', { hash, params });

      // 创建交易元数据
      const metadata = createTransactionMetadata(
        hash,
        params.userAddress,
        params.contractAddress,
        params.amount,
        params.transactionType,
        params.businessContext
      );

      // 生成一次性令牌
      const oneTimeToken = securityValidator.generateOneTimeToken(
        metadata.sessionId,
        params.transactionType
      );

      // 更新状态
      setState(prev => ({
        ...prev,
        isValidating: false,
        sessionId: metadata.sessionId,
        currentNonce: metadata.nonce,
        validationResult: { isValid: true },
        error: null,
      }));

      console.log('✅ 安全交易元数据创建成功', {
        sessionId: metadata.sessionId,
        nonce: metadata.nonce.toString(),
        expirationTime: new Date(metadata.expirationTime).toLocaleString(),
      });

      return { metadata, oneTimeToken };

    } catch (error) {
      console.error('❌ 创建安全交易元数据失败:', error);

      const errorMessage = error instanceof Error ? error.message : '未知错误';

      setState(prev => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
        validationResult: {
          isValid: false,
          error: errorMessage,
          errorCode: 'CREATE_METADATA_FAILED',
          suggestion: '请刷新页面重试',
        },
      }));

      toast({
        title: '安全验证失败',
        description: errorMessage,
        variant: 'destructive',
      });

      throw error;
    }
  }, [toast]);

  /**
   * 验证交易
   */
  const validateTransaction = useCallback(async (
    metadata: TransactionMetadata,
    oneTimeToken?: string
  ): Promise<ValidationResult> => {
    setState(prev => ({ ...prev, isValidating: true, error: null }));

    try {
        hash: metadata.hash,
        nonce: metadata.nonce.toString(),
        sessionId: metadata.sessionId,
      });

      // 执行验证
      const result = await validateTransaction(metadata, oneTimeToken);

      // 更新状态
      setState(prev => ({
        ...prev,
        isValidating: false,
        validationResult: result,
        error: result.isValid ? null : result.error || null,
      }));

      if (!result.isValid) {
        console.error('❌ 交易验证失败:', result);

        toast({
          title: '交易验证失败',
          description: result.error || '验证失败，请重试',
          variant: 'destructive',
        });

        // 根据错误类型提供不同的用户提示
        handleValidationError(result);
      } else {
        console.log('✅ 交易验证通过');

        toast({
          title: '验证成功',
          description: '交易安全验证通过，可以继续执行',
        });
      }

      return result;

    } catch (error) {
      console.error('❌ 交易验证异常:', error);

      const errorMessage = error instanceof Error ? error.message : '验证过程中发生异常';

      setState(prev => ({
        ...prev,
        isValidating: false,
        error: errorMessage,
        validationResult: {
          isValid: false,
          error: errorMessage,
          errorCode: 'VALIDATION_EXCEPTION',
          suggestion: '请稍后重试或联系客服',
        },
      }));

      toast({
        title: '验证异常',
        description: errorMessage,
        variant: 'destructive',
      });

      throw error;
    }
  }, [toast]);

  /**
   * 获取一次性令牌
   */
  const getOneTimeToken = useCallback(async (context?: string): Promise<string> => {
    if (!state.sessionId) {
      throw new Error('没有活跃的会话，请先创建交易');
    }

    try {
      const token = securityValidator.generateOneTimeToken(state.sessionId, context);
      console.log('🔑 生成一次性令牌成功', { context });
      return token;
    } catch (error) {
      console.error('❌ 生成一次性令牌失败:', error);
      throw error;
    }
  }, [state.sessionId]);

  /**
   * 重置状态
   */
  const resetState = useCallback(() => {
    setState({
      isValidating: false,
      validationResult: null,
      sessionId: null,
      currentNonce: null,
      error: null,
    });

    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
    }
  }, []);

  /**
   * 检查交易是否即将过期
   */
  const isTransactionExpiringSoon = useCallback((metadata: TransactionMetadata): boolean => {
    const timeRemaining = metadata.expirationTime - Date.now();
    return timeRemaining < 30000; // 30秒内即将过期
  }, []);

  /**
   * 处理验证错误
   */
  const handleValidationError = useCallback((result: ValidationResult) => {
    if (!result.errorCode) return;

    switch (result.errorCode) {
      case 'NONCE_ALREADY_USED':
        toast({
          title: '⚠️ 安全警告',
          description: '检测到可能的重复交易，已自动阻止',
          variant: 'destructive',
        });

        // 记录安全事件
        logSecurityEvent('REPLAY_ATTEMPT', {
          errorCode: result.errorCode,
          error: result.error,
          suggestion: result.suggestion,
        });
        break;

      case 'TRANSACTION_EXPIRED':
        toast({
          title: '⏰ 交易已过期',
          description: '请重新创建交易',
          variant: 'destructive',
        });
        break;

      case 'RATE_LIMIT_EXCEEDED':
        toast({
          title: '🚦 请求过于频繁',
          description: '请稍后再试',
          variant: 'destructive',
        });
        break;

      case 'SESSION_EXPIRED':
        toast({
          title: '🔐 会话已过期',
          description: '请重新登录',
          variant: 'destructive',
        });
        break;

      default:
        toast({
          title: '❌ 验证失败',
          description: result.error || '未知错误',
          variant: 'destructive',
        });
    }
  }, [toast]);

  /**
   * 记录安全事件
   */
  const logSecurityEvent = useCallback((eventType: string, details: any) => {
    console.warn(`🚨 安全事件: ${eventType}`, details);

    // 在实际应用中，这里应该发送到安全监控服务
    // await sendToSecurityMonitoring(eventType, details);
  }, []);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      if (cleanupTimerRef.current) {
        clearTimeout(cleanupTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    createSecureTransaction,
    validateTransaction,
    getOneTimeToken,
    resetState,
    isTransactionExpiringSoon,
  };
};

// ==================== 便捷函数 ====================

/**
 * 创建带有安全验证的交易函数
 */
export const createSecureTransactionFunction = <T extends any[]>(
  originalFunction: (...args: T) => Promise<any>,
  securityHook: UseSecurityValidationReturn
) => {
  return async (
    securityParams: TransactionSecurityParams,
    ...args: T
  ): Promise<any> => {
    try {
      // 1. 生成交易哈希（这里简化处理，实际应该从交易参数计算）
      const hash = generateTransactionHash(securityParams, args);

      // 2. 创建安全交易元数据
      const { metadata, oneTimeToken } = await securityHook.createSecureTransaction(
        hash,
        securityParams
      );

      // 3. 验证交易
      const validationResult = await securityHook.validateTransaction(metadata, oneTimeToken);

      if (!validationResult.isValid) {
        throw new SecurityError(
          validationResult.errorCode || 'VALIDATION_FAILED',
          validationResult.error || '交易验证失败',
          validationResult.suggestion
        );
      }

      // 4. 执行原始交易函数
      const result = await originalFunction(...args);

      // 5. 记录成功的安全事件
      console.log('✅ 安全交易执行成功', {
        hash,
        sessionId: metadata.sessionId,
        nonce: metadata.nonce.toString(),
      });

      return result;

    } catch (error) {
      console.error('❌ 安全交易执行失败:', error);
      throw error;
    }
  };
};

/**
 * 生成交易哈希（简化版本）
 */
const generateTransactionHash = (
  securityParams: TransactionSecurityParams,
  args: any[]
): Hash => {
  const data = {
    userAddress: securityParams.userAddress,
    contractAddress: securityParams.contractAddress,
    amount: securityParams.amount.toString(),
    transactionType: securityParams.transactionType,
    args: args.map(arg => String(arg)),
    timestamp: Date.now(),
  };

  // 在实际应用中，应该使用更安全的哈希算法
  const hashString = JSON.stringify(data);
  return `0x${hashString.slice(0, 64).padEnd(64, '0')}` as Hash;
};

// ==================== 导出 ====================

export default useSecurityValidation;