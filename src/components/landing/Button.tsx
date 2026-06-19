'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Mail } from 'lucide-react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type LandingButtonProps = HTMLMotionProps<'button'> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  showArrow?: boolean;
  showMail?: boolean;
};

export function LandingButton({
  children,
  className,
  variant = 'primary',
  showArrow = false,
  showMail = false,
  ...props
}: LandingButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.98 }}
      className={cn(
        'group inline-flex min-h-12 items-center justify-center gap-2 rounded-none border-2 border-[var(--border-color)] px-5 py-3 text-sm font-bold text-black shadow-[4px_4px_0_var(--border-color)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 dark:focus-visible:ring-offset-black',
        variant === 'primary' &&
          'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--secondary-foreground)]',
        variant === 'secondary' &&
          'bg-[var(--card)] text-[var(--card-foreground)] hover:bg-[var(--muted)]',
        variant === 'ghost' &&
          'border-transparent bg-transparent text-[var(--foreground)] shadow-none hover:border-[var(--border-color)] hover:bg-[var(--muted)] hover:shadow-[3px_3px_0_var(--border-color)]',
        className
      )}
      {...props}
    >
      {showMail && <Mail className="h-4 w-4" aria-hidden="true" />}
      <span>{children}</span>
      {showArrow && (
        <ArrowRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      )}
    </motion.button>
  );
}
