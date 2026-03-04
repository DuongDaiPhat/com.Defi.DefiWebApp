import { memo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../ui/Card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PortfolioProps {
  totalUSD: number;
  breakdown: { name: string; value: number; color: string }[];
  change24h: number;
}

export const PortfolioOverview = memo(function PortfolioOverview({ totalUSD, breakdown, change24h }: PortfolioProps) {
  const isPositive = change24h >= 0;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(null);
  };

  return (
    <Card className="bg-gradient-to-br from-[var(--color-bg-card)] to-slate-900/80 border-white/10 p-6 overflow-visible">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,1.2fr)_minmax(240px,1fr)_minmax(220px,1.3fr)] gap-8 items-center">
        {/* Total Value */}
        <div className="flex flex-col justify-center">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Total Portfolio Value</p>
          <h2 className="text-4xl font-display font-bold text-white mb-2">
            ${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h2>
          <div className={`flex items-center gap-1 text-sm font-semibold ${isPositive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {isPositive ? '+' : ''}{change24h.toFixed(2)}% (24h)
          </div>
        </div>

        {/* Pie Chart */}
        <div className="h-[230px] relative flex items-center justify-center overflow-visible">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 50, right: 50, bottom: 50, left: 50 }}>
              <Pie
                data={breakdown}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                animationDuration={300}
                animationBegin={0}
                label={(props: any) => {
                  const isActive = props.index === activeIndex;
                  if (!isActive) return null;

                  const RADIAN = Math.PI / 180;
                  const radius = 35 + props.outerRadius; // Push pill further out so it doesn't overlap chart
                  const x = props.cx + radius * Math.cos(-props.midAngle * RADIAN);
                  const y = props.cy + radius * Math.sin(-props.midAngle * RADIAN);
                  
                  return (
                    <motion.g
                      initial={{ opacity: 0, scale: 0.3, x: x - props.cx, y: y - props.cy }}
                      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                      transition={{ type: "spring", stiffness: 800, damping: 35 }} // Maximum speed
                    >
                      <rect
                        x={x - 55}
                        y={y - 16}
                        width={110}
                        height={32}
                        rx={16}
                        fill="var(--color-primary)"
                        className="shadow-[0_10px_30px_rgba(245,158,11,0.4)]"
                      />
                      <text
                        x={x}
                        y={y}
                        fill="#0f172a"
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[12px] font-extrabold"
                      >
                        {`$${props.value.toLocaleString('en-US', { maximumFractionDigits: 1 })}`}
                      </text>
                    </motion.g>
                  );
                }}
                labelLine={false}
              >
                {breakdown.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    style={{ 
                      outline: 'none',
                      opacity: activeIndex === null || activeIndex === index ? 1 : 0.4,
                      transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                      transformOrigin: 'center',
                      transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                    }}
                  />
                ))}
              </Pie>
              <Tooltip contentStyle={{ display: 'none' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-col justify-center gap-3">
          {breakdown.map((item, index) => (
            <div 
              key={item.name} 
              className={`flex items-center justify-between transition-all duration-300 transform cursor-pointer ${
                activeIndex === index 
                  ? 'opacity-100 -translate-x-4 scale-[1.03]' 
                  : 'opacity-50'
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-3">
                <div 
                  className={`w-3.5 h-3.5 rounded-full transition-shadow duration-300 ${activeIndex === index ? 'shadow-[0_0_12px_currentColor]' : ''}`} 
                  style={{ backgroundColor: item.color, color: item.color }} 
                />
                <span className={`text-[15px] transition-all duration-300 ${activeIndex === index ? 'text-white font-bold' : 'text-[var(--color-text-muted)] font-medium'}`}>
                  {item.name}
                </span>
              </div>
              <span className={`text-[15px] font-mono transition-all duration-300 ${activeIndex === index ? 'text-[var(--color-primary)] font-bold' : 'text-white/80'}`}>
                ${item.value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
});
