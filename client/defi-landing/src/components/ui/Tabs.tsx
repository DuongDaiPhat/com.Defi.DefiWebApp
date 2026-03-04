import { cn } from '../../lib/utils';

interface TabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={cn('flex bg-[var(--color-bg)]/60 rounded-xl p-1 gap-1', className)}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onTabChange(tab)}
          className={cn(
            'flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200',
            activeTab === tab
              ? 'bg-[var(--color-primary)] text-slate-950 shadow-[var(--glow-gold)]'
              : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5'
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
