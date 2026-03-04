import { useState, memo } from 'react';
import { Card } from '../ui/Card';
import { Tabs } from '../ui/Tabs';
import { Badge } from '../ui/Badge';
import { CopyButton } from '../ui/CopyButton';
import { CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import type { Transaction } from '../../hooks/useDashboardMock';

const TX_TYPES = ['All', 'Swap', 'Stake', 'Unstake', 'Claim'];

interface TransactionMonitorProps {
  transactions: Transaction[];
}

const StatusIcon = memo(function StatusIcon({ status }: { status: Transaction['status'] }) {
  switch (status) {
    case 'Success': return <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />;
    case 'Failed': return <XCircle className="w-4 h-4 text-[var(--color-error)]" />;
    case 'Pending': return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
  }
});

function formatHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

function formatTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export const TransactionMonitor = memo(function TransactionMonitor({ transactions }: TransactionMonitorProps) {
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = activeFilter === 'All'
    ? transactions
    : transactions.filter(tx => tx.type === activeFilter);

  return (
    <Card id="transactions" className="border-white/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-xl font-display font-bold text-white">Transaction Monitor</h3>
        <Tabs tabs={TX_TYPES} activeTab={activeFilter} onTabChange={setActiveFilter} className="max-w-md" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[var(--color-text-muted)]">
              <th className="text-left py-3 px-2 font-medium">Status</th>
              <th className="text-left py-3 px-2 font-medium">Type</th>
              <th className="text-left py-3 px-2 font-medium">Tx Hash</th>
              <th className="text-left py-3 px-2 font-medium">Amount</th>
              <th className="text-left py-3 px-2 font-medium">Gas</th>
              <th className="text-left py-3 px-2 font-medium">Blocks</th>
              <th className="text-left py-3 px-2 font-medium">Time</th>
              <th className="text-left py-3 px-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((tx) => (
              <tr key={tx.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-2"><StatusIcon status={tx.status} /></td>
                <td className="py-3 px-2">
                  <Badge variant={tx.type === 'Swap' ? 'default' : tx.type === 'Claim' ? 'success' : 'outline'}>
                    {tx.type}
                  </Badge>
                </td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-1">
                    <code className="text-xs text-[var(--color-text-muted)]">{formatHash(tx.hash)}</code>
                    <CopyButton text={tx.hash} />
                  </div>
                </td>
                <td className="py-3 px-2 font-medium text-white">{tx.amount}</td>
                <td className="py-3 px-2 text-[var(--color-text-muted)]">{tx.gasPrice}</td>
                <td className="py-3 px-2 text-[var(--color-text-muted)]">{tx.blockConfirmations}</td>
                <td className="py-3 px-2 text-[var(--color-text-muted)]">{formatTime(tx.timestamp)}</td>
                <td className="py-3 px-2">
                  <a
                    href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-primary-light)] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-[var(--color-text-muted)] py-8">No transactions found.</p>
      )}
    </Card>
  );
});
