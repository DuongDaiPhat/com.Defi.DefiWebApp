import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        'p-1.5 rounded-lg transition-all duration-200',
        copied ? 'text-[var(--color-success)] bg-[var(--color-success)]/10' : 'text-[var(--color-text-muted)] hover:text-white hover:bg-white/10',
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}
