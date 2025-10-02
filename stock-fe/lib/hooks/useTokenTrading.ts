import { useState, useCallback, useEffect } from 'react';
import { Address, formatUnits, parseUnits, maxUint256, formatEther } from 'viem';
import { usePublicClient, useWalletClient } from '@/hooks/usePublicClient';
import { useWallet } from 'ycdirectory-ui';
import { useToast } from '@/hooks/use-toast';
import USDT_TOKEN_ABI from '@/lib/abi/MockERC20.json';
import STOCK_TOKEN_ABI from '@/lib/abi/StockToken.json';
import ORACLE_AGGREGATOR_ABI from '@/lib/abi/OracleAggregator.json';
import BUY_PARAMS from '@/lib/abi/buy.json';
// import { fetchStockPrice } from '@/lib/hermes';
import { usePythStore } from '@/lib/stores/pythStore';
import { getNetworkConfig } from '@/lib/contracts';
import getPythUpdateData from "@/lib/utils/getPythUpdateData";
import getPriceInfo from "@/lib/utils/getPythUpdateData";
export interface TokenInfo {
  symbol: string;
  name: string;
  address: Address;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  totalSupply: number;
  userBalance: number;
  userValue: number;
}

export interface TradingState {
  buyAmount: string;
  slippage: number;
  customSlippage: string;
  showCustomSlippage: boolean;
  showDropdown: boolean;
  usdtBalance: bigint;
  allowance: bigint;
  needsApproval: boolean;
  transactionStatus: 'idle' | 'approving' | 'buying' | 'success' | 'error';
  transactionHash: `0x${string}` | null;
  priceData: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
    formatted: {
      price: string;
      conf: string;
      confidence: string;
    };
  } | null;
  updateData: `0x${string}`[] | null;
  updateFee: bigint;
}

export interface TradingResult {
  success: boolean;
  hash?: `0x${string}`;
  error?: string;
}

/**
 * Token Trading Hook
 *
 * 这个 Hook 封装了代币购买和销售的所有逻辑，
 * 包括授权、余额查询、价格获取等。
 */
export const useTokenTrading = (token: TokenInfo, usdtAddress: Address, oracleAddress: Address) => {
  console.log("token",token,"usdtAddress",usdtAddress)
  const { toast } = useToast();
  const { publicClient, chain } = usePublicClient();
  const { walletClient, getWalletClient } = useWalletClient();
  const { isConnected, address } = useWallet();

  // Get the StockToken implementation contract address
  const networkConfig = getNetworkConfig(chain?.id || 11155111);
  const stockTokenImplAddress = networkConfig.contracts.stockTokenImplementation as Address;

console.log("🔍 useTokenTrading 初始化:", { isConnected, address, stockTokenImplAddress });
  // 状态管理
  const [tradingState, setTradingState] = useState<TradingState>({
    buyAmount: "100",
    slippage: 5,
    customSlippage: "",
    showCustomSlippage: false,
    showDropdown: false,
    usdtBalance: 0n,
    allowance: 0n,
    needsApproval: true,
    transactionStatus: 'idle',
    transactionHash: null,
    priceData: null,
    updateData: null,
    updateFee: 0n,
  });

  // 更新状态的辅助函数
  const updateState = useCallback((updates: Partial<TradingState>) => {
    setTradingState(prev => ({ ...prev, ...updates }));
  }, []);

  // 获取预言机更新数据和费用
  const fetchUpdateDataAndFee = useCallback(async (symbols: string[]) => {
    console.log("🔍 fetchUpdateDataAndFee 调用:", { symbols, publicClient: !!publicClient, chain: chain?.name });
    if (!publicClient || !chain) {
      throw new Error("客户端或链信息未初始化");
    }

    try {
      // 获取当前网络的 oracleAggregator 地址
      const networkConfig = getNetworkConfig(chain.id);
      const oracleAggregatorAddress = networkConfig.contracts.oracleAggregator as Address;
      console.log("🐛 网络配置:", {
        chainId: chain.id,
        chainName: chain.name,
        oracleAggregatorAddress
      });

      console.log("🔍 获取预言机更新数据:", { symbols, oracleAggregatorAddress });

      // 1. 获取 Pyth 更新数据
      const updateData = await getPythUpdateData(symbols);

      console.log("🐛 Pyth 更新数据:", {
        hasData: !!updateData,
        dataLength: updateData?.length || 0,
        rawData: updateData
      });

      if (!updateData || updateData.length === 0) {
        throw new Error("无法获取价格更新数据");
      }

      console.log("✅ 获取到 Pyth 更新数据:", {
        dataLength: updateData.length,
        updateData: updateData.map((data, index) => ({
          index,
          size: data.length,
          preview: data.slice(0, 20) + "..."
        }))
      });

      // 2. 获取更新费用
      console.log("💰 计算预言机更新费用...");

      const updateFee = await publicClient.readContract({
        address: oracleAggregatorAddress,
        abi: ORACLE_AGGREGATOR_ABI,
        functionName: "getUpdateFee",
        args: [updateData]
      }) as bigint;

      let feeBigInt = BigInt(updateFee);

      console.log("🐛 预言机费用详情:", {
        rawFee: updateFee,
        feeBigInt: feeBigInt.toString(),
        feeEth: formatEther(feeBigInt),
        feeUsd: parseFloat(formatEther(feeBigInt)) * 2000,
        isZero: feeBigInt === 0n
      });

     

      // 添加额外的缓冲费用 (0.001 ETH) 以应对 Gas 费用波动
      const totalFee = feeBigInt;


      console.log("💰 预言机更新费用:", {
        rawUpdateFee: feeBigInt.toString(),
        updateFeeEth: formatEther(feeBigInt),
        totalFee: totalFee.toString(),
        totalFeeEth: formatEther(totalFee),
        totalFeeUsd: parseFloat(formatEther(totalFee)) * 2000 // 假设 ETH 价格为 $2000
      });

      return {
        updateData,
        updateFee: feeBigInt, // 返回原始预言机费用（不包括缓冲）
        totalFee: totalFee    // 返回总费用（包括缓冲）
      };
    } catch (error) {
      console.error("❌ 获取预言机数据失败:", error);
      throw new Error(`获取预言机数据失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  }, [publicClient, chain]);

  // 获取用户信息（余额和授权额度）
  const fetchUserInfo = useCallback(async () => {
    if (!isConnected || !address || !publicClient) {
      return;
    }

    try {
      // 获取USDT余额
      const balance = await publicClient.readContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "balanceOf",
        args: [address],
      }) as bigint;

      const balanceBigInt = BigInt(balance);
      setTradingState(prev => ({ ...prev, usdtBalance: balanceBigInt }));

      // 获取授权额度 - 授权给当前选择的代币合约
      const approval = await publicClient.readContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "allowance",
        args: [address, token.address],
      }) as bigint;

      const approvalBigInt = BigInt(approval);
      setTradingState(prev => ({ ...prev, allowance: approvalBigInt }));

      // 检查是否需要授权
      const buyAmountWei = parseUnits(tradingState.buyAmount || "0", 6);
      const needsApproval = approvalBigInt < buyAmountWei;
      setTradingState(prev => ({ ...prev, needsApproval }));
    } catch (error) {
      console.error("获取用户信息失败:", error);
    }
  }, [isConnected, address, publicClient, usdtAddress, stockTokenImplAddress, tradingState.buyAmount]);

  // 获取价格数据
  const fetchPriceData = useCallback(async () => {
    try {
      console.log(`🔄 开始获取 ${token.symbol} 价格数据...`);
      const priceDataArray = await getPriceInfo([token.symbol]);
      console.log(`📊 ${token.symbol} 价格数据获取结果:`, priceDataArray);

      const priceData = priceDataArray[0];
      if (priceData) {
        setTradingState(prev => ({ ...prev, priceData }));
        console.log(`✅ ${token.symbol} 价格数据已设置`);
      } else {
        console.warn(`⚠️ ${token.symbol} 价格数据为空，使用默认价格`);
        // 设置默认价格数据
        const defaultPriceData = {
          price: '100',
          conf: '1',
          expo: -2,
          publish_time: Date.now(),
          formatted: {
            price: '1.00',
            conf: '0.01',
            confidence: '1.00%'
          }
        };
        setTradingState(prev => ({ ...prev, priceData: defaultPriceData }));
      }
    } catch (error) {
      console.error(`❌ 获取 ${token.symbol} 价格失败:`, error);
      // 设置默认价格数据作为 fallback
      const defaultPriceData = {
        price: '100',
        conf: '1',
        expo: -2,
        publish_time: Date.now(),
        formatted: {
          price: '1.00',
          conf: '0.01',
          confidence: '1.00%'
        }
      };
      setTradingState(prev => ({ ...prev, priceData: defaultPriceData }));
    }
  }, [token.symbol]);

  // 获取 Pyth 价格更新数据 (使用缓存)
  const fetchPythData = useCallback(async () => {
    const { getCachedData, setPythData, setLoading, setError, isDataExpired } = usePythStore.getState();

    try {
      console.log(`🔄 检查 ${token.symbol} 的 Pyth 数据缓存...`);

      // 首先检查缓存
      const cachedData = getCachedData(token.symbol);
      if (cachedData) {
        console.log(`✅ 使用 ${token.symbol} 的缓存数据`);
        setTradingState(prev => ({
          ...prev,
          updateData: cachedData,
          updateFee: 0n
        }));
        return;
      }

      console.log(`⚠️ ${token.symbol} 缓存过期或不存在，重新获取...`);
      setLoading(token.symbol, true);

      const updateData = await fetchPythUpdateData([token.symbol]);

      if (updateData && updateData.length > 0) {
        console.log(`✅ 成功获取 ${updateData.length} 条更新数据，已缓存`);
        setPythData(token.symbol, updateData, 0n);
        setTradingState(prev => ({
          ...prev,
          updateData: updateData,
          updateFee: 0n
        }));
      } else {
        console.warn("⚠️ 未获取到有效的价格更新数据");
        setError(token.symbol, "未获取到有效的价格更新数据");
      }
    } catch (error) {
      console.error("❌ 获取 Pyth 数据失败:", error);
      setError(token.symbol, error instanceof Error ? error.message : "未知错误");
    } finally {
      setLoading(token.symbol, false);
    }
  }, [token.symbol]);

  // 计算最小代币数量（使用合约预估函数）
  const calculateMinTokenAmount = useCallback(async () => {
    if (!publicClient || !stockTokenImplAddress) return 0n;

    const buyAmount = parseFloat(tradingState.buyAmount) || 0;
    if (buyAmount <= 0) return 0n;

    try {
      const buyAmountWei = parseUnits(tradingState.buyAmount, 6);
      console.log("🔍 调用合约 getBuyEstimate:", {
        buyAmountWei: buyAmountWei.toString(),
        buyAmount: tradingState.buyAmount,
        slippage: tradingState.slippage
      });

      let estimatedTokens: bigint;
      let estimatedFee: bigint = 0n;

      try {
        // 首先尝试调用合约的 getBuyEstimate 函数
        console.log("🔍 尝试调用合约 getBuyEstimate...");
        const result = await publicClient.readContract({
          // address: stockTokenImplAddress,
          address:token.address,
          abi: STOCK_TOKEN_ABI,
          functionName: "getBuyEstimate",
          args: [buyAmountWei]
        }) as [bigint, bigint];

        estimatedTokens = result[0];
        estimatedFee = result[1];

        console.log("📊 合约预估结果:", {
          estimatedTokens: estimatedTokens.toString(),
          estimatedTokensFormatted: formatEther(estimatedTokens),
          estimatedFee: estimatedFee.toString(),
          estimatedFeeFormatted: formatEther(estimatedFee)
        });
      } catch (contractError) {
        console.warn("⚠️ 合约 getBuyEstimate 调用失败，使用价格估算:", contractError);

        // 回退到基于价格的估算
        let pricePerShare = 0;

        if (tradingState.priceData && tradingState.priceData.price) {
          pricePerShare = parseFloat(tradingState.priceData.price);
          console.log("📊 使用状态中的价格数据:", pricePerShare);
        } else {
          // 如果没有价格数据，使用默认价格（假设 $100 per share）
          pricePerShare = 100;
          console.warn("⚠️ 没有价格数据，使用默认价格 $100 进行估算");
        }

        if (pricePerShare <= 0) {
          // 如果解析出的价格无效，使用默认价格
          pricePerShare = 100;
          console.warn("⚠️ 价格数据无效，使用默认价格 $100 进行估算");
        }

        const buyAmount = parseFloat(tradingState.buyAmount) || 0;
        if (buyAmount <= 0) {
          throw new Error("购买金额必须大于 0");
        }

        const shares = buyAmount / pricePerShare;
        estimatedTokens = parseUnits(shares.toFixed(6), 18);
        estimatedFee = 0n;

        console.log("📊 价格估算结果:", {
          pricePerShare,
          buyAmount,
          estimatedShares: shares,
          estimatedTokens: estimatedTokens.toString(),
          estimatedTokensFormatted: formatEther(estimatedTokens),
          note: tradingState.priceData ? "使用获取的价格数据" : "使用默认价格数据"
        });
      }

      // 应用滑点保护 - 修复计算逻辑
      const slippageFactor = (100 - tradingState.slippage) / 100;
      const minTokenAmount = estimatedTokens * BigInt(Math.floor(slippageFactor * 10000)) / 10000n;

      console.log("🛡️ 应用滑点保护:", {
        original: formatEther(estimatedTokens),
        slippagePercent: tradingState.slippage,
        slippageFactor: slippageFactor,
        minAmount: formatEther(minTokenAmount),
        calculation: `${estimatedTokens} * ${slippageFactor} = ${minTokenAmount}`,
        reduction: `${((1 - slippageFactor) * 100).toFixed(2)}%`
      });

      return { estimatedTokens, minTokenAmount };
    } catch (error) {
      console.error("❌ 计算最小代币数量完全失败:", error);

      // 给出详细的错误信息
      let errorMessage = "无法计算预期获得的代币数量";
      if (error instanceof Error) {
        if (error.message.includes("无法获取价格数据进行估算")) {
          errorMessage = "价格数据获取失败，请重试或联系客服";
        } else if (error.message.includes("购买金额必须大于 0")) {
          errorMessage = "请输入有效的购买金额";
        } else {
          errorMessage = `计算失败: ${error.message}`;
        }
      }

      throw new Error(errorMessage);
    }
  }, [publicClient, stockTokenImplAddress, tradingState.buyAmount, tradingState.slippage, tradingState.priceData]);

  // 授权USDT
  const approveUSDT = useCallback(async (): Promise<TradingResult> => {
    if (!isConnected || !address) {
      return {
        success: false,
        error: "钱包未连接"
      };
    }

    updateState({ transactionStatus: 'approving' });

    try {
      const client = getWalletClient();
      const maxApprovalAmount = maxUint256;

      const hash = await client.writeContract({
        address: usdtAddress,
        abi: USDT_TOKEN_ABI,
        functionName: "approve",
        args: [token.address, maxApprovalAmount],
        account: address,
        chain,
      });

      updateState({ transactionHash: hash });

      // 等待交易确认
      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
      });

      if (receipt?.status === 'success') {
        // 重新获取授权额度
        await fetchUserInfo();
        updateState({ transactionStatus: 'idle' });

        return {
          success: true,
          hash
        };
      } else {
        throw new Error('交易失败');
      }
    } catch (error: unknown) {
      updateState({ transactionStatus: 'error' });
      console.error("授权失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "授权失败"
      };
    }
  }, [isConnected, address, getWalletClient, usdtAddress, stockTokenImplAddress, chain, publicClient, fetchUserInfo, updateState]);

  // 执行买入
  const buyTokens = useCallback(async (): Promise<TradingResult> => {
    console.log("🐛 buyTokens 调用:", {
      isConnected,
      address,
      buyAmount: tradingState.buyAmount,
      usdtBalance: formatUnits(tradingState.usdtBalance, 6),
      needsApproval: tradingState.needsApproval
    });

    if (!isConnected || !address) {
      return {
        success: false,
        error: "钱包未连接"
      };
    }

    if (!tradingState.buyAmount || parseFloat(tradingState.buyAmount) <= 0) {
      return {
        success: false,
        error: "金额错误"
      };
    }

    const buyAmountWei = parseUnits(tradingState.buyAmount, 6);

    console.log("🐛 余额检查:", {
      buyAmount: tradingState.buyAmount,
      buyAmountWei: buyAmountWei.toString(),
      usdtBalance: tradingState.usdtBalance.toString(),
      hasEnoughBalance: tradingState.usdtBalance >= buyAmountWei
    });

    if (tradingState.usdtBalance < buyAmountWei) {
      return {
        success: false,
        error: "USDT余额不足"
      };
    }

    updateState({ transactionStatus: 'buying' });

    try {
      console.log("🔄 开始购买流程，获取最新价格数据...");

      // 1. 首先确保有价格数据
      console.log(`🔍 确保 ${token.symbol} 的价格数据已获取...`);
      if (!tradingState.priceData) {
        console.log("⚠️ 价格数据为空，重新获取...");
        await fetchPriceData();
      }

      // 再次检查价格数据
      if (!tradingState.priceData) {
        throw new Error("无法获取价格数据，请重试");
      }

      console.log("✅ 价格数据已确认:", tradingState.priceData);

      // 2. 使用 oracleAggregator 获取更新数据和费用
      console.log(`🔍 使用 oracleAggregator 获取 ${token.symbol} 的最新价格更新数据...`);

      const { updateData, updateFee, totalFee } = await fetchUpdateDataAndFee([token.symbol]);

      console.log("🐛 预言机数据获取完成:", {
        updateDataLength: updateData.length,
        updateFee: updateFee.toString(),
        updateFeeEth: formatEther(updateFee),
        totalFee: totalFee.toString(),
        totalFeeEth: formatEther(totalFee)
      });

      // 2. 更新状态中的数据
      setTradingState(prev => ({
        ...prev,
        updateData: updateData,
        updateFee: totalFee // 使用总费用（包括缓冲）
      }));

      // 直接使用获取到的数据，不依赖状态更新
      const currentUpdateData = updateData;
      const currentUpdateFee = totalFee;

      console.log("🐛 数据验证:", {
        updateDataFromFunction: !!updateData,
        updateDataLength: updateData?.length || 0,
        updateDataType: typeof updateData,
        updateDataArray: Array.isArray(updateData),
        currentUpdateFee: currentUpdateFee.toString(),
        currentUpdateFeeEth: formatEther(currentUpdateFee)
      });

      console.log("✅ 获取到最新的价格更新数据:", {
        dataLength: currentUpdateData.length,
        updateFee: currentUpdateFee.toString(),
        updateFeeEth: formatEther(currentUpdateFee),
        timestamp: new Date().toISOString()
      });

      // 动态计算购买参数
      console.log("🔄 动态模式：计算购买参数...");

      const buyAmountWei = parseUnits(tradingState.buyAmount, 6);
      const { minTokenAmount } = await calculateMinTokenAmount();

      console.log("🧪 动态计算参数详情:", {
        buyAmount: buyAmountWei.toString(),
        buyAmountFormatted: formatUnits(buyAmountWei, 6),
        minTokenAmount: minTokenAmount.toString(),
        minTokenAmountFormatted: formatEther(minTokenAmount),
        updateDataLength: currentUpdateData?.length || 0,
        updateFee: currentUpdateFee.toString(),
        updateFeeEth: formatEther(currentUpdateFee)
      });

      // 检查用户余额是否足够
      if (tradingState.usdtBalance < buyAmountWei) {
        throw new Error(`USDT余额不足! 需要: ${formatUnits(buyAmountWei, 6)}, 可用: ${formatUnits(tradingState.usdtBalance, 6)}`);
      }

      console.log("💰 准备执行买入交易:", {
        buyAmountWei: buyAmountWei.toString(),
        minTokenAmount: minTokenAmount.toString(),
        updateDataLength: currentUpdateData?.length || 0,
        updateFee: currentUpdateFee.toString()
      });

      const client = getWalletClient();

      // 检查用户 ETH 余额是否足够支付预言机费用
      try {
        const ethBalance = await publicClient.getBalance({ address });

        console.log("🐛 用户 ETH 余额检查:", {
          ethBalance: ethBalance.toString(),
          ethBalanceFormatted: formatEther(ethBalance),
          requiredFee: currentUpdateFee.toString(),
          requiredFeeFormatted: formatEther(currentUpdateFee),
          hasEnoughEth: ethBalance >= currentUpdateFee,
          shortfall: ethBalance < currentUpdateFee ?
            formatEther(currentUpdateFee - ethBalance) : "0"
        });

        if (ethBalance < currentUpdateFee) {
          throw new Error(`ETH余额不足! 需要: ${formatEther(currentUpdateFee)} ETH, 可用: ${formatEther(ethBalance)} ETH, 缺少: ${formatEther(currentUpdateFee - ethBalance)} ETH`);
        }
      } catch (balanceError) {
        console.warn("⚠️ 无法检查 ETH 余额:", balanceError);
        // 继续执行，但会在合约调用时失败
      }

      // 检查 USDT 授权 (仍然需要检查)
      console.log("🐛 USDT 授权检查:", {
        allowance: tradingState.allowance.toString(),
        allowanceFormatted: formatUnits(tradingState.allowance, 6),
        buyAmountWei: buyAmountWei.toString(),
        buyAmountFormatted: formatUnits(buyAmountWei, 6),
        hasEnoughAllowance: tradingState.allowance >= buyAmountWei
      });

      if (tradingState.allowance < buyAmountWei) {
        throw new Error(`USDT授权不足! 需要: ${formatUnits(buyAmountWei, 6)}, 可用: ${formatUnits(tradingState.allowance, 6)}`);
      }

      console.log("📝 准备执行合约调用:", [
          buyAmountWei,               // 参数1: USDT金额 (动态计算)
          minTokenAmount,             // 参数2: 最小代币数量 (动态计算)
          currentUpdateData || []     // 参数3: 价格更新数据 (动态获取)
      ]);

      console.log("🐛 合约调用参数 (动态模式):", {
        tokenAddress: token.address,
        functionName: "buy",
        args: [
          {
            name: "USDT金额",
            value: buyAmountWei.toString(),
            formatted: formatUnits(buyAmountWei, 6),
            source: "动态计算"
          },
          {
            name: "最小代币数量",
            value: minTokenAmount.toString(),
            formatted: formatEther(minTokenAmount),
            source: "动态计算"
          },
          {
            name: "价格更新数据",
            value: currentUpdateData,
            length: currentUpdateData?.length || 0,
            source: "动态获取"
          }
        ],
        msgValue: {
          value: currentUpdateFee.toString(),
          formatted: formatEther(currentUpdateFee),
          description: "预言机更新费用 (动态计算)"
        },
        account: address,
        chain: chain?.name
      });

      // 打印对比测试值和动态计算值
      console.log("🔍 参数对比:");
      console.log("测试值 USDT金额:", BigInt(BUY_PARAMS.usdtAmount).toString(), formatUnits(BigInt(BUY_PARAMS.usdtAmount), 6));
      console.log("动态计算 USDT金额:", buyAmountWei.toString(), formatUnits(buyAmountWei, 6));
      console.log("测试值 最小代币数量:", BigInt(BUY_PARAMS.minTokenAmount).toString(), formatEther(BigInt(BUY_PARAMS.minTokenAmount)));
      console.log("动态计算 最小代币数量:", minTokenAmount.toString(), formatEther(minTokenAmount));

      const hash = await client.writeContract({
        address: token.address,
        abi: STOCK_TOKEN_ABI,
        functionName: "buy",
        args: [
          buyAmountWei,           // 参数1: USDT金额 (测试值)
          minTokenAmount,            // 参数2: 最小代币数量 (测试值)
          currentUpdateData || []    // 参数3: 价格更新数据 (动态获取)
        ],
        account: address,
        chain,
        value: currentUpdateFee, // 使用动态计算的预言机费用
        // gas: 3000000n, // 增加gas限制到 3M
      });

      console.log("🐛 合约调用成功:", {
        transactionHash: hash,
        transactionHashShort: hash.slice(0, 10) + "..." + hash.slice(-8)
      });

      updateState({ transactionHash: hash });

      // 等待交易确认
      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
      });

      if (receipt?.status === 'success') {
        updateState({ transactionStatus: 'success' });

        return {
          success: true,
          hash
        };
      } else {
        throw new Error('交易失败');
      }
    } catch (error: unknown) {
      updateState({ transactionStatus: 'error' });
      console.error("❌ 买入交易失败:", error);

      // 详细的错误分析和用户友好提示
      let errorMessage = "买入失败";
      let userAction = "";

      const errorObj = error as Error & {
        code?: string;
        reason?: string;
        data?: unknown;
        transaction?: { hash?: string };
        stack?: string;
      };

      console.log("🐛 错误详情:", {
        name: errorObj.name,
        message: errorObj.message,
        code: errorObj.code,
        reason: errorObj.reason,
        data: errorObj.data,
        transactionHash: errorObj.transaction?.hash,
        stack: errorObj.stack ? errorObj.stack.split('\n').slice(0, 3) : 'No stack trace'
      });

      if (errorObj.message) {
        errorMessage = errorObj.message;

        // 分析错误类型并给出用户友好的提示
        if (errorObj.message.includes("insufficient funds")) {
          errorMessage = "账户ETH余额不足";
          userAction = "请为钱包充值足够的ETH来支付Gas费用";
        } else if (errorObj.message.includes("Insufficient fee")) {
          errorMessage = "预言机费用不足";
          userAction = "ETH余额不足以支付预言机更新费用。请充值ETH或联系管理员调整费用设置。";
        } else if (errorObj.message.includes("execution reverted")) {
          errorMessage = "合约执行失败";
          userAction = "请检查：1) 合约代币余额 2) 价格数据是否最新 3) 滑点设置是否合理 4) USDT授权是否足够";
        } else if (errorObj.message.includes("USDT授权不足")) {
          errorMessage = "USDT授权不足";
          userAction = "请先授权USDT代币给合约";
        } else if (errorObj.message.includes("合约代币余额不足")) {
          errorMessage = "合约代币余额不足";
          userAction = "合约中没有足够的代币可供购买";
        } else if (errorObj.message.includes("无法获取最新的价格更新数据")) {
          errorMessage = "价格数据获取失败";
          userAction = "请检查网络连接或重试";
        } else if (errorObj.message.includes("无法计算最小代币数量")) {
          errorMessage = "无法计算预期获得的代币数量";
          userAction = "请检查价格数据是否有效";
        } else if (errorObj.message.includes("call revert exception")) {
          errorMessage = "合约调用失败";
          userAction = "检查交易参数或合约状态";
        }
      }

      // 记录详细错误信息用于调试
      console.error("🔍 买入交易失败详细分析:", {
        errorType: errorObj.name || 'Unknown',
        errorMessage: errorMessage,
        errorCode: errorObj.code,
        errorReason: errorObj.reason,
        errorData: errorObj.data,
        transactionHash: errorObj.transaction?.hash,
        userAction,
        stack: errorObj.stack ? errorObj.stack.split('\n').slice(0, 5) : 'No stack trace'
      });

      // 显示用户友好的提示
      if (userAction) {
        console.log("💡 建议操作:", userAction);
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }, [isConnected, address, getWalletClient, stockTokenImplAddress, tradingState, calculateMinTokenAmount, chain, publicClient, fetchUpdateDataAndFee, fetchPriceData]);

  // 初始化数据
  const initializeData = useCallback(async () => {
    await Promise.all([
      fetchUserInfo(),
      fetchPriceData(),
      fetchPythData()
    ]);
  }, [fetchUserInfo, fetchPriceData, fetchPythData]);

  // 注意：数据初始化现在在打开购买弹窗时手动调用
  // 这样可以避免在不需要时频繁调用 API

  // 重置状态
  const resetState = useCallback(() => {
    setTradingState({
      buyAmount: "100",
      slippage: 5,
      customSlippage: "",
      showCustomSlippage: false,
      showDropdown: false,
      usdtBalance: 0n,
      allowance: 0n,
      needsApproval: true,
      transactionStatus: 'idle',
      transactionHash: null,
      priceData: null,
      updateData: null,
      updateFee: 0n,
    });
  }, []);

  return {
    // 状态
    tradingState,
    isConnected,
    address,

    // 操作方法
    initializeData,
    approveUSDT,
    buyTokens,
    resetState,

    // 更新方法
    updateState,
    fetchUserInfo,

    // 计算属性 (异步获取)
    minTokenAmount: 0n, // 这个值在购买时动态计算

    // 客户端
    publicClient,
    walletClient,
    chain,
  };
};

export default useTokenTrading;