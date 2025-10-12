import { Hero } from "@/components/Hero";
import { FeatureCard } from "@/components/FeatureCard";
import { StockCard } from "@/components/StockCard";
import { StatsSection } from "@/components/StatsSection";
import { FloatingParticles } from "@/components/FloatingParticles";
import { DigitalRain } from "@/components/DigitalRain";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <DigitalRain />
      <FloatingParticles />
      <Hero />

      {/* Stats Section */}
      <StatsSection />

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4 font-chinese">
              为什么选择币股交易？
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto font-chinese">
              体验下一代去中心化交易，使用我们的尖端平台
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              iconName="bar-chart"
              title="实时价格"
              description="由 Pyth Network 预言机驱动，提供准确、实时的股票价格信息，延迟极低"
              gradient="from-blue-500 to-cyan-600"
            />
            <FeatureCard
              iconName="shield"
              title="无需 KYC"
              description="匿名交易，无需身份验证程序。您的隐私是我们的首要任务"
              gradient="from-purple-500 to-pink-600"
            />
            <FeatureCard
              iconName="zap"
              title="闪电般快速"
              description="通过优化的智能合约和 Layer 2 解决方案在几秒钟内执行交易"
              gradient="from-green-500 to-emerald-600"
            />
            <FeatureCard
              iconName="globe"
              title="全球访问"
              description="在世界任何地方进行交易。没有地域限制或约束"
              gradient="from-orange-500 to-red-600"
            />
            <FeatureCard
              iconName="trending-up"
              title="高级交易"
              description="为经验丰富的交易者提供专业交易工具、图表和分析"
              gradient="from-indigo-500 to-purple-600"
            />
            <FeatureCard
              iconName="users"
              title="社区驱动"
              description="加入 DeFi 领域充满活力的交易者和投资者社区"
              gradient="from-pink-500 to-rose-600"
            />
          </div>
        </div>
      </section>

      {/* Trending Stocks Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-900/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4 font-chinese">
              热门股票代币
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto font-chinese">
              发现最受欢迎的可交易股票代币
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StockCard
              symbol="AAPL"
              name="苹果公司"
              price="$175.43"
              change="+2.34%"
              isPositive={true}
              volume="$45.2M"
            />
            <StockCard
              symbol="TSLA"
              name="特斯拉公司"
              price="$248.50"
              change="-1.23%"
              isPositive={false}
              volume="$38.7M"
            />
            <StockCard
              symbol="GOOGL"
              name="谷歌母公司"
              price="$138.21"
              change="+0.87%"
              isPositive={true}
              volume="$32.1M"
            />
            <StockCard
              symbol="MSFT"
              name="微软公司"
              price="$378.91"
              change="+1.45%"
              isPositive={true}
              volume="$52.8M"
            />
            <StockCard
              symbol="AMZN"
              name="亚马逊公司"
              price="$127.74"
              change="-0.92%"
              isPositive={false}
              volume="$28.4M"
            />
            <StockCard
              symbol="NVDA"
              name="英伟达公司"
              price="$459.89"
              change="+3.21%"
              isPositive={true}
              volume="$67.3M"
            />
          </div>

          <div className="text-center mt-12">
            <Link href="/pool" className="inline-block bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium px-8 py-3 rounded-lg transition-all duration-300 font-chinese">
              查看币股池
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6 font-chinese">
            准备开始交易了吗？
          </h2>
          <p className="text-xl text-gray-400 mb-8 font-chinese">
            加入数千名已经使用币股交易进行去中心化股票交易的交易者
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-300 font-chinese">
              连接钱包
            </button>
            <button className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 text-gray-300 hover:bg-gray-800 hover:text-white font-semibold px-8 py-4 rounded-lg transition-all duration-300 font-chinese">
              了解更多
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}