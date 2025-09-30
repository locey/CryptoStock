"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp, Coins, Shield } from "lucide-react";
import { TypingAnimation } from "@/components/TypingAnimation";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-pink-900/20"></div>

      {/* Animated background elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="space-y-8">
          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight font-chinese tracking-tight">
            投资未来，享受
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent block mt-4 gradient-shift font-black tracking-tight">
              DeFi与传统股市的双重收益！
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-gray-300 max-w-4xl mx-auto leading-relaxed font-chinese">
            <TypingAnimation
              text="结合去中心化金融和传统币股代币，开启你的多元化投资之旅"
              speed={50}
              className="text-xl text-gray-300"
            />
          </p>

          {/* Feature highlights */}
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
            <div className="flex flex-col items-center space-y-3 float-animation card-hover-3d">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center glow-effect pulse-glow">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold font-chinese">USDT 投资</h3>
              <p className="text-gray-400 text-sm font-chinese">使用USDT购买币股代币</p>
            </div>
            <div className="flex flex-col items-center space-y-3 float-animation card-hover-3d" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center glow-effect pulse-glow">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold font-chinese">知名股票</h3>
              <p className="text-gray-400 text-sm font-chinese">投资全球知名公司股票</p>
            </div>
            <div className="flex flex-col items-center space-y-3 float-animation card-hover-3d" style={{ animationDelay: '0.4s' }}>
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center glow-effect pulse-glow">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-white font-semibold font-chinese">DeFi 收益</h3>
              <p className="text-gray-400 text-sm font-chinese">额外DeFi池收益机会</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed font-chinese">
            通过我们的平台，用户可以使用USDT购买币股代币，投资知名公司股票，还可以将资金投入到DeFi池中获取额外收益。专业的交易界面，实时的市场数据，让投资变得更简单！
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-8 py-4 text-lg font-chinese">
              开始投资
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-900 hover:text-white font-semibold px-8 py-4 text-lg font-chinese">
              了解更多
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-16">
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">$2.5B+</div>
              <div className="text-gray-400 font-chinese">总交易量</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">50K+</div>
              <div className="text-gray-400 font-chinese">活跃交易者</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-2">100+</div>
              <div className="text-gray-400 font-chinese">股票代币</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-gray-600 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-gray-400 rounded-full mt-2"></div>
        </div>
      </div>
    </section>
  );
}