'use client';

import { Database, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { FadeIn, Stagger, StaggerItem } from './animations';
import { InboxFlowVisual } from './Mockups';

const securityItems: Array<{ icon: LucideIcon; title: string; copy: string }> = [
  {
    icon: KeyRound,
    title: 'OAuth 2.0 access',
    copy: 'Google authorization keeps account access explicit, scoped, and revocable from your Google settings.',
  },
  {
    icon: LockKeyhole,
    title: 'Encrypted transport',
    copy: 'Mailbox requests use encrypted connections and secure server-side API routes.',
  },
  {
    icon: EyeOff,
    title: 'No ad resale',
    copy: 'Your email data is never sold. The assistant exists to power your workflow, not advertising profiles.',
  },
  {
    icon: Database,
    title: 'Controlled sync',
    copy: 'Sync is visible, deliberate, and designed around the minimum access needed for the product experience.',
  },
];

export function Security() {
  return (
    <section id="security" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <FadeIn direction="right">
            <div className="mb-5 flex h-12 w-12 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[4px_4px_0_var(--border-color)]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="neo-kicker">Security and privacy</p>
            <h2 className="mt-4 text-4xl font-bold tracking-normal text-[var(--foreground)] sm:text-5xl">
              Built for trust before cleverness.
            </h2>
            <p className="mt-5 text-lg font-medium leading-8 text-[var(--muted-foreground)]">
              Email is private by default. Gmail Intelligence treats mailbox access as a responsibility, with clear authorization and controls.
            </p>
          </FadeIn>

          <FadeIn direction="left">
            <InboxFlowVisual />
          </FadeIn>
        </div>

        <Stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {securityItems.map((item) => (
            <StaggerItem key={item.title}>
              <article className="neo-card neo-lift h-full p-5">
                <item.icon className="h-6 w-6 text-[var(--primary)]" aria-hidden="true" />
                <h3 className="mt-5 text-base font-bold text-[var(--card-foreground)]">{item.title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-[var(--muted-foreground)]">{item.copy}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
