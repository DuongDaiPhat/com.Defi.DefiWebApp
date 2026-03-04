import { cn } from '../../lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  color?: 'gold' | 'purple' | 'green';
}

export function ProgressBar({ value, className, color = 'gold' }: ProgressBarProps) {
  const colors = {
    gold: 'bg-[var(--color-primary)]',
    purple: 'bg-[var(--color-accent)]',
    green: 'bg-[var(--color-success)]',
  };

  return (
    <div className={cn('w-full h-2 bg-white/10 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-700 ease-out', colors[color])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
