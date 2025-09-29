"use client";

import { BarChart3, Shield, Zap, Globe, TrendingUp, Users } from "lucide-react";

type IconName = 'bar-chart' | 'shield' | 'zap' | 'globe' | 'trending-up' | 'users';

interface FeatureCardProps {
  iconName: IconName;
  title: string;
  description: string;
  gradient?: string;
}

const iconMap = {
  'bar-chart': BarChart3,
  'shield': Shield,
  'zap': Zap,
  'globe': Globe,
  'trending-up': TrendingUp,
  'users': Users,
};

export function FeatureCard({ iconName, title, description, gradient = "from-blue-500 to-purple-600" }: FeatureCardProps) {
  const Icon = iconMap[iconName];

  return (
    <div className="group relative bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 hover:border-gray-700 transition-all duration-500 card-hover-3d glow-effect">
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-500`}></div>

      {/* Animated border */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>

      {/* Icon */}
      <div className={`w-14 h-14 bg-gradient-to-br ${gradient} rounded-xl flex items-center justify-center mb-6 pulse-glow transform transition-transform duration-500 group-hover:scale-110`}>
        <Icon className="w-7 h-7 text-white transform transition-transform duration-500 group-hover:rotate-12" />
      </div>

      {/* Content */}
      <h3 className="text-xl font-semibold text-white mb-4 transform transition-transform duration-500 group-hover:translate-y-1">{title}</h3>
      <p className="text-gray-400 leading-relaxed transform transition-all duration-500 group-hover:text-gray-300">{description}</p>
    </div>
  );
}