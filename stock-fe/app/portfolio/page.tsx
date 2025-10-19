"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Clock, Gift, Trophy, RefreshCw, AlertTriangle, Wallet, ExternalLink } from "lucide-react";
import { useAirdrop } from "@/hooks/useAirdrop";
import { useSimpleTokenBalance } from "@/hooks/useTokenBalance";
import { StartAirdropButton } from "@/components/StartAirdropButton";
import { AdminToggle } from "@/components/AdminToggle";
import { FormattedAddress } from "@/components/FormattedAddress";
import { isAdminAddress } from "@/lib/admin";
import { ERC20_TOKEN_ADDRESS, getTokenExplorerUrl, getTokenSymbol } from "@/lib/token";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();

  // 检查当前用户是否为管理员
  const isAdmin = isAdminAddress(address);

  // 获取代币余额
  const { balance: tokenBalance, symbol: tokenSymbol, isLoading: balanceLoading, error: balanceError } = useSimpleTokenBalance();
  const {
    tasks,
    error,
    claiming,
    fetching,
    claimTask,
    claimReward,
    startAirdrop,
    clearError,
    refresh
  } = useAirdrop({
    onSuccess: (message) => {
      // 可以在这里添加 toast 通知
      console.log('Success:', message);
    },
    onError: (error) => {
      console.error('Airdrop error:', error);
    }
  });

  const getStatusIcon = (status?: string | null) => {
    switch (status) {
      case "claimed":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "rewarded":
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case "claimed":
        return <Badge variant="secondary">已领取</Badge>;
      case "completed":
        return <Badge variant="default">已完成</Badge>;
      case "rewarded":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/20">已奖励</Badge>;
      default:
        return <Badge variant="outline">未参与</Badge>;
    }
  };

  const handleClaimTask = async (taskId: number) => {
    await claimTask(taskId);
  };

  const handleClaimReward = async (taskId: number) => {
    await claimReward(taskId);
  };

  const getActionButton = (task: any) => {
    if (!isConnected) {
      return <Button disabled>连接钱包</Button>;
    }

    if (!address) {
      return <Button disabled>连接钱包</Button>;
    }

    const isLoading = claiming === task.id;

    switch (task.user_status) {
      case "claimed":
      case "completed":
        return (
          <Button
            onClick={() => handleClaimReward(task.id)}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? "领取中..." : "领取奖励"}
          </Button>
        );
      case "rewarded":
        return <Button disabled>已领取奖励</Button>;
      default:
        return (
          <Button
            onClick={() => handleClaimTask(task.id)}
            disabled={isLoading || task.status !== "active"}
          >
            {isLoading ? "领取中..." : "参与任务"}
          </Button>
        );
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-20">
            <Gift className="w-16 h-16 mx-auto mb-6 text-gray-400" />
            <h1 className="text-3xl font-bold mb-4">空投奖励</h1>
            <p className="text-gray-400 mb-8">请连接您的钱包以查看和参与空投活动</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">投资组合</h1>
          <p className="text-gray-400">管理您的资产和空投奖励</p>
        </div>

        <Tabs defaultValue="airdrop" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="airdrop">空投奖励</TabsTrigger>
            <TabsTrigger value="admin">管理员</TabsTrigger>
            <TabsTrigger value="assets">资产</TabsTrigger>
            <TabsTrigger value="history">历史</TabsTrigger>
          </TabsList>

          <TabsContent value="airdrop" className="space-y-6">
            {/* Airdrop Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    可参与任务
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-400">
                    {tasks?.filter(t => t.status === "active" && !t.user_status).length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    待领取奖励
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    {tasks?.filter(t => t.user_status === "completed").length || 0}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    已获得奖励
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    {tasks?.filter(t => t.user_status === "rewarded").length || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert className="bg-red-900/50 border-red-800 text-red-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>{error}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearError}
                    className="text-red-200 hover:text-red-100 hover:bg-red-800/50"
                  >
                    关闭
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Airdrop Tasks List */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    空投任务
                  </div>
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <StartAirdropButton
                        onStartAirdrop={startAirdrop}
                        isStarting={claiming === -1}
                      />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refresh}
                      disabled={fetching}
                      className="text-gray-400 hover:text-white"
                    >
                      <RefreshCw className={`w-4 h-4 ${fetching ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fetching ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : !tasks || tasks.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    {fetching ? "加载中..." : "暂无空投任务"}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(task.user_status)}
                            <h3 className="font-semibold">{task.name}</h3>
                            {getStatusBadge(task.user_status)}
                            {task.status === "active" && (
                              <Badge variant="default" className="bg-green-500/20 text-green-500 border-green-500/20">
                                进行中
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{task.description}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-blue-400 font-medium">
                              奖励: {task.reward_amount} CS
                            </span>
                            {task.end_date && (
                              <span className="text-gray-500">
                                截止: {new Date(task.end_date).toLocaleDateString()}
                              </span>
                            )}
                            {task.current_participants && task.max_participants && (
                              <span className="text-gray-500">
                                进度: {task.current_participants}/{task.max_participants}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          {getActionButton(task)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            <AdminToggle />
          </TabsContent>

          <TabsContent value="overview">
            <div className="text-center py-20 text-gray-400">
              总览页面开发中...
            </div>
          </TabsContent>

          <TabsContent value="assets" className="space-y-6">
            {/* Token Balance Card */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  代币余额
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">{getTokenSymbol(ERC20_TOKEN_ADDRESS)} 代币余额</p>
                      <div className="flex items-center gap-3">
                        {balanceLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                            <span className="text-gray-400">加载中...</span>
                          </div>
                        ) : balanceError ? (
                          <div className="text-red-400">
                            <span className="text-sm">获取余额失败</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold text-blue-400">
                              {tokenBalance}
                            </span>
                            <span className="text-lg text-gray-300">{tokenSymbol}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(getTokenExplorerUrl(ERC20_TOKEN_ADDRESS), '_blank')}
                      className="text-blue-400 border-blue-400/30 hover:bg-blue-400/10 flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      查看代币
                    </Button>
                  </div>

                  <div className="pt-3 border-t border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">代币合约:</span>
                        <div className="mt-1">
                          <FormattedAddress
                            address={ERC20_TOKEN_ADDRESS}
                            startLength={6}
                            endLength={4}
                            className="text-gray-300"
                          />
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">钱包地址:</span>
                        <div className="mt-1">
                          <FormattedAddress
                            address={address || ''}
                            startLength={6}
                            endLength={4}
                            className="text-gray-300"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Additional Asset Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    空投奖励总计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">
                    {tasks?.filter(t => t.user_status === "rewarded").reduce((sum, task) => sum + (task.reward_amount || 0), 0).toFixed(2) || '0.00'}
                    <span className="text-lg text-gray-300 ml-2">{tokenSymbol}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">已获得的空投奖励总和</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-gray-400">
                    待领取奖励
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-400">
                    {tasks?.filter(t => t.user_status === "completed").reduce((sum, task) => sum + (task.reward_amount || 0), 0).toFixed(2) || '0.00'}
                    <span className="text-lg text-gray-300 ml-2">{tokenSymbol}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">完成任务待领取的奖励</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="text-center py-20 text-gray-400">
              历史页面开发中...
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}