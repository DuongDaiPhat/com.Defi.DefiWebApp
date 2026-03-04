import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glowOnHover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, glowOnHover = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass rounded-2xl p-6 transition-all duration-300",
          glowOnHover && "hover:-translate-y-1 hover:border-white/20 hover:shadow-[var(--glow-gold)]",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export { Card };
