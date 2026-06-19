'use client';

import { Globe2, Mail, MessageSquare, ShieldCheck } from 'lucide-react';

const footerLinks = [
  { href: '#features', label: 'Features' },
  { href: '#workflow', label: 'Workflow' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
];

const socialLinks = [
  { href: '#top', label: 'Product updates', icon: Globe2 },
  { href: '#security', label: 'Security', icon: ShieldCheck },
  { href: '#faq', label: 'Contact', icon: MessageSquare },
];

export function Footer() {
  return (
    <footer className="border-t-2 border-[var(--border-color)] bg-[var(--background)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <a href="#top" className="inline-flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EA4335] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950">
            <span className="flex h-9 w-9 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[3px_3px_0_var(--border-color)]">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="font-mono text-sm font-bold text-[var(--foreground)]">Gmail Intelligence</span>
          </a>
          <p className="mt-3 max-w-md text-sm font-medium leading-6 text-[var(--muted-foreground)]">
            AI-powered email assistance for summaries, drafting, categories, and mailbox chat.
          </p>
        </div>

        <div className="flex flex-col gap-5 md:items-end">
          <div className="flex flex-wrap gap-4">
            {footerLinks.map((link) => (
              <a key={link.href} href={link.href} className="font-mono text-sm font-bold text-[var(--foreground)] transition hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                aria-label={link.label}
                className="inline-flex h-9 w-9 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--card)] text-[var(--foreground)] shadow-[3px_3px_0_var(--border-color)] transition hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <link.icon className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="font-mono text-sm font-bold text-[var(--muted-foreground)]">
            Copyright 2026 Gmail Intelligence. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
