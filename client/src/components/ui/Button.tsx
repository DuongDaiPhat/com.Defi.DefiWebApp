import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-light)] disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      primary: "bg-[var(--color-primary)] text-slate-950 hover:bg-[var(--color-primary-light)] hover:shadow-[var(--glow-gold)] active:scale-95",
      secondary: "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-light)] hover:shadow-[var(--glow-purple)] active:scale-95",
      outline: "border border-[var(--color-border)] bg-transparent hover:bg-white/5 active:scale-95",
      ghost: "hover:bg-white/10 active:scale-95 text-[var(--color-text)]",
      danger: "bg-[var(--color-error)] text-white hover:bg-red-600",
    };

    const sizes = {
      sm: "h-9 px-3 text-sm",
      md: "h-11 px-6 px-4 text-base",
      lg: "h-12 px-8 text-lg",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
