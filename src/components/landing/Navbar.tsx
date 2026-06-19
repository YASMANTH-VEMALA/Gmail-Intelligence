'use client';

import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, X, Mail } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LandingButton } from './Button';
import type { LandingAction, ThemeToggleProps } from './types';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar({ onConnect, isDark, onToggleTheme }: LandingAction & ThemeToggleProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 14);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b-2 border-[var(--border-color)] transition duration-300',
        scrolled
          ? 'bg-[var(--background)] shadow-[0_4px_0_var(--border-color)]'
          : 'bg-[var(--background)]'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Primary navigation">
        <a href="#top" className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA4335] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950">
          <span className="flex h-9 w-9 items-center justify-center rounded-none border-2 border-[var(--border-color)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[3px_3px_0_var(--border-color)]">
            <Mail className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="font-mono text-sm font-bold tracking-normal text-[var(--foreground)]">Gmail Intelligence</span>
        </a>

        <div className="hidden items-center gap-1 border-2 border-[var(--border-color)] bg-[var(--card)] p-1 shadow-[3px_3px_0_var(--border-color)] md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-none px-3 py-1.5 font-mono text-sm font-bold text-[var(--foreground)] transition hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-none border-2 border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-[3px_3px_0_var(--border-color)] transition hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>
          <LandingButton onClick={onConnect} showMail className="min-h-10 px-4 py-2" id="connect-gmail-btn-nav">
            Connect with Gmail
          </LandingButton>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-none border-2 border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-[3px_3px_0_var(--border-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:hidden"
          onClick={() => setMobileOpen((value) => !value)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t-2 border-[var(--border-color)] bg-[var(--background)] px-4 py-4 shadow-[0_4px_0_var(--border-color)] md:hidden"
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-none px-3 py-2 font-mono text-sm font-bold text-[var(--foreground)] hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-none border-2 border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-[3px_3px_0_var(--border-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
                </button>
                <LandingButton onClick={onConnect} showMail id="connect-gmail-btn-mobile">
                  Connect with Gmail
                </LandingButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
