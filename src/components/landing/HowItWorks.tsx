'use client';

import { Bot, CheckCircle2, Mail, RefreshCw, Zap } from 'lucide-react';
import { Stagger, StaggerItem } from './animations';

const steps = [
  {
    icon: Mail,
    title: 'Connect',
    copy: 'Authorize Gmail securely with OAuth 2.0. No password sharing, no brittle forwarding rules.',
  },
  {
    icon: RefreshCw,
    title: 'Sync',
    copy: 'Important threads and labels are indexed so the assistant can reason across your mailbox quickly.',
  },
  {
    icon: Bot,
    title: 'Let AI work',
    copy: 'Summaries, categories, chat answers, and drafts are generated from the conversation context.',
  },
  {
    icon: Zap,
    title: 'Save hours',
    copy: 'Triage the right threads first, respond faster, and leave fewer decisions buried in email.',
  },
];

export function HowItWorks() {
  return (
    <section id="workflow" className="border-y-2 border-[var(--border-color)] bg-[var(--muted)] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="neo-kicker">How it works</p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal text-[var(--foreground)] sm:text-5xl">
            From connection to clarity in minutes.
          </h2>
          <p className="mt-5 text-lg font-medium leading-8 text-[var(--muted-foreground)]">
            The setup is intentionally simple: connect Gmail once, then let the assistant keep the repetitive work moving.
          </p>
        </div>

        <Stagger className="relative mt-14 grid gap-5 lg:grid-cols-4">
          <div className="absolute left-0 right-0 top-14 hidden h-1 bg-[var(--border-color)] lg:block" aria-hidden="true" />
          {steps.map((step, index) => (
            <StaggerItem key={step.title} className="relative">
              <article className="neo-card neo-lift h-full p-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex h-14 w-14 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[4px_4px_0_var(--border-color)]">
                    <step.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <span className="inline-flex h-8 w-8 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--secondary)] font-mono text-sm font-bold text-black shadow-[2px_2px_0_var(--border-color)]">
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[var(--card-foreground)]">{step.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-[var(--muted-foreground)]">{step.copy}</p>
                {index === steps.length - 1 && (
                  <div className="mt-5 inline-flex items-center gap-2 border-2 border-[var(--border-color)] bg-[#00cc00] px-3 py-1.5 font-mono text-xs font-bold text-black shadow-[2px_2px_0_var(--border-color)]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Inbox under control
                  </div>
                )}
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
