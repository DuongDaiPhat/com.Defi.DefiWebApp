import { useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, ArrowLeftRight, Landmark, Server,
  ChevronLeft, ChevronRight 
} from 'lucide-react';
import { cn } from '../../lib/utils';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/swap', label: 'Swap (AMM)', icon: ArrowLeftRight },
  { path: '/vault', label: 'Vault (dvSKT)', icon: Server },
  { path: '/stake', label: 'Strategy Direct', icon: Landmark },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path.includes('#')) {
      return location.pathname + location.hash === path;
    }
    return location.pathname === path;
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] bg-[#0c0f1a] border-r border-white/5 z-40 flex flex-col justify-between transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )}
    >
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-light)] border-l-[3px] border-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('w-5 h-5 shrink-0', active && 'text-[var(--color-primary-light)]')} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full py-2 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/5 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="ml-2 text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
