"use client";

interface StatItemProps {
  label: string;
  value: string;
  change?: string;
  isPositive?: boolean;
}

function StatItem({ label, value, change, isPositive }: StatItemProps) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-white mb-2">{value}</div>
      <div className="text-gray-400 mb-1 font-chinese">{label}</div>
      {change && (
        <div className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
          {isPositive ? '+' : ''}{change}
        </div>
      )}
    </div>
  );
}

export function StatsSection() {
  return (
    <section className="py-16 bg-gray-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatItem
            label="24小时交易量"
            value="$156.8M"
            change="+12.5%"
            isPositive={true}
          />
          <StatItem
            label="总用户数"
            value="89,432"
            change="+2.1%"
            isPositive={true}
          />
          <StatItem
            label="活跃市场"
            value="147"
            change="+5"
            isPositive={true}
          />
          <StatItem
            label="总锁仓量"
            value="$2.4B"
            change="-0.8%"
            isPositive={false}
          />
        </div>
      </div>
    </section>
  );
}