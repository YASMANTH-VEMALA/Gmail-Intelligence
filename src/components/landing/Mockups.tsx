'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  FileText,
  Inbox,
  Mail,
  MessageSquare,
  PenLine,
  Search,
  Send,
  Sparkles,
  Tags,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const emails = [
  {
    sender: 'Avery from Northstar',
    subject: 'Q3 launch timeline and open approvals',
    tag: 'Work',
    active: true,
  },
  {
    sender: 'Stripe',
    subject: 'Payout reconciliation ready',
    tag: 'Finance',
  },
  {
    sender: 'Maya Patel',
    subject: 'Re: investor update draft',
    tag: 'Priority',
  },
];

export function HeroDashboardMockup() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28, scale: 0.98 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      className="relative mx-auto w-full max-w-6xl"
      aria-label="Gmail Intelligence dashboard preview"
    >
      <div className="relative overflow-hidden neo-card-lg">
        <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--primary)] px-4 py-3 text-[var(--primary-foreground)]">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 border-2 border-black bg-[#ff3333]" />
            <span className="h-3 w-3 border-2 border-black bg-[#ffff00]" />
            <span className="h-3 w-3 border-2 border-black bg-[#00cc00]" />
          </div>
          <div className="hidden items-center gap-2 border-2 border-black bg-white px-3 py-1.5 font-mono text-xs font-bold text-black sm:flex">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Ask anything across your inbox
          </div>
          <div className="flex items-center gap-2 border-2 border-black bg-[#00cc00] px-3 py-1 font-mono text-xs font-bold text-black">
            <span className="h-1.5 w-1.5 bg-black" />
            Synced
          </div>
        </div>

        <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[280px_1fr_340px]">
          <aside className="hidden border-r-2 border-[var(--border-color)] bg-[var(--muted)] p-4 lg:block">
            <div className="mb-5 flex items-center gap-2 font-mono text-sm font-bold text-[var(--foreground)]">
              <Mail className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
              Gmail Intelligence
            </div>
            <div className="space-y-2">
              {['Priority inbox', 'Needs reply', 'Finance', 'Newsletters', 'Hiring'].map((item, index) => (
                <div
                  key={item}
                  className={cn(
                    'flex items-center justify-between border-2 border-transparent px-3 py-2 text-sm font-bold text-[var(--foreground)]',
                    index === 0 && 'border-[var(--border-color)] bg-[var(--secondary)] shadow-[3px_3px_0_var(--border-color)]'
                  )}
                >
                  <span>{item}</span>
                  <span className="font-mono text-xs">{[18, 7, 4, 39, 6][index]}</span>
                </div>
              ))}
            </div>
          </aside>

          <div className="border-r-2 border-[var(--border-color)] bg-[var(--card)] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-normal text-[var(--primary)]">Today</p>
                <h3 className="mt-1 text-xl font-bold text-[var(--foreground)]">Priority inbox</h3>
              </div>
              <button
                className="border-2 border-[var(--border-color)] bg-[var(--secondary)] p-2 text-black shadow-[3px_3px_0_var(--border-color)] transition hover:bg-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label="Compose email"
              >
                <PenLine className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3">
              {emails.map((email) => (
                <div
                  key={email.subject}
                  className={cn(
                    'border-2 p-4 transition',
                    email.active
                      ? 'border-[var(--border-color)] bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[4px_4px_0_var(--border-color)]'
                      : 'border-[var(--border-color)] bg-[var(--card)] shadow-[3px_3px_0_var(--border-color)]'
                  )}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-sm font-bold">{email.sender}</p>
                    <span className="border-2 border-[var(--border-color)] bg-[var(--secondary)] px-2 py-1 font-mono text-[11px] font-bold text-black">
                      {email.tag}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{email.subject}</p>
                  {email.active && (
                    <div className="mt-4 border-2 border-black bg-white p-3 text-sm font-medium text-black shadow-[3px_3px_0_black]">
                      <div className="mb-2 flex items-center gap-2 font-bold text-black">
                        <Sparkles className="h-4 w-4 text-[#ff3333]" aria-hidden="true" />
                        AI summary
                      </div>
                      Launch is on track. Legal approval is the only blocker. Send a concise status reply before 3 PM.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <aside className="hidden bg-black p-4 text-white lg:block">
            <div className="mb-4 flex items-center gap-2 font-mono text-sm font-bold">
              <Bot className="h-4 w-4 text-[#ff3333]" aria-hidden="true" />
              Mailbox chat
            </div>
            <div className="space-y-3">
              <div className="border-2 border-white bg-[#333333] p-3 text-sm font-medium text-white">
                Which launch emails still need action?
              </div>
              <div className="border-2 border-white bg-white p-3 text-sm font-medium text-black">
                Three threads need replies. The highest priority is the Northstar approval thread because legal feedback is due today.
              </div>
              <div className="flex flex-wrap gap-2">
                {['Northstar thread', 'Legal approval', 'Q3 launch'].map((source) => (
                  <span key={source} className="border-2 border-white bg-[#0066ff] px-2.5 py-1 font-mono text-xs font-bold text-white">
                    {source}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <motion.div
        aria-hidden="true"
        animate={reduceMotion ? undefined : { y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="neo-panel-yellow absolute -bottom-8 left-4 hidden max-w-xs p-4 md:block"
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Draft ready
        </div>
        <p className="text-sm font-medium leading-6 text-black">
          Polished reply generated with thread context and the right next step.
        </p>
      </motion.div>
    </motion.div>
  );
}

function MockupFrame({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'neo-card-lg overflow-hidden',
        className
      )}
      aria-label={label}
    >
      <div className="flex items-center justify-between border-b-2 border-[var(--border-color)] bg-[var(--accent-color)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 border-2 border-black bg-[#ff3333]" />
          <span className="h-2.5 w-2.5 border-2 border-black bg-[#ffff00]" />
          <span className="h-2.5 w-2.5 border-2 border-black bg-[#00cc00]" />
        </div>
        <span className="font-mono text-xs font-bold text-white">Gmail Intelligence</span>
      </div>
      {children}
    </div>
  );
}

export function SummaryMockup({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [24, -24]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      <MockupFrame label="Thread summary mockup">
        <div className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#EA4335]">Thread summary</p>
              <h3 className="mt-1 text-lg font-bold text-[var(--card-foreground)]">Vendor renewal</h3>
            </div>
            <FileText className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
          </div>
          <div className="space-y-3">
            {[
              'Pricing increased 8 percent, but annual prepay waives onboarding.',
              'Security review is complete. Procurement still needs final PO.',
              'Recommended reply: ask for SOC 2 appendix and confirm Friday deadline.',
            ].map((item) => (
              <div key={item} className="flex gap-3 border-2 border-[var(--border-color)] bg-[var(--muted)] p-3 shadow-[3px_3px_0_var(--border-color)]">
                <Sparkles className="mt-0.5 h-4 w-4 flex-none text-[#EA4335]" aria-hidden="true" />
                <p className="text-sm font-medium leading-6 text-[var(--muted-foreground)]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </MockupFrame>
    </motion.div>
  );
}

export function ComposeMockup({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [18, -18]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      <MockupFrame label="AI compose mockup">
        <div className="p-5">
          <div className="mb-4 border-2 border-[var(--border-color)] bg-[var(--muted)] p-4 shadow-[3px_3px_0_var(--border-color)]">
            <p className="mb-2 font-mono text-xs font-bold uppercase tracking-normal text-[var(--primary)]">Prompt</p>
            <p className="text-sm font-medium leading-6 text-[var(--muted-foreground)]">
              Write a warm follow-up to Priya. Mention the revised scope, attach the timeline, and ask for sign-off by Thursday.
            </p>
          </div>
          <div className="border-2 border-[var(--border-color)] bg-black p-4 text-white shadow-[4px_4px_0_var(--border-color)]">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <PenLine className="h-4 w-4 text-[#EA4335]" aria-hidden="true" />
              Draft
            </div>
            <p className="text-sm font-medium leading-6 text-zinc-200">
              Hi Priya, thanks again for the thoughtful notes. I updated the scope and attached the revised timeline so your team can review the changes in context...
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-zinc-300">Tone: polished and concise</span>
              <Send className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            </div>
          </div>
        </div>
      </MockupFrame>
    </motion.div>
  );
}

export function ChatMockup({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [22, -22]);

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      <MockupFrame label="Mailbox chat mockup">
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#EA4335]" aria-hidden="true" />
            <h3 className="text-lg font-bold text-[var(--card-foreground)]">Ask your mailbox</h3>
          </div>
          <div className="space-y-3">
            <div className="ml-auto max-w-[82%] border-2 border-[var(--border-color)] bg-[var(--primary)] px-4 py-3 text-sm font-bold leading-6 text-[var(--primary-foreground)] shadow-[3px_3px_0_var(--border-color)]">
              Which candidates sent updated portfolios this week?
            </div>
            <div className="max-w-[88%] border-2 border-[var(--border-color)] bg-[var(--muted)] px-4 py-3 text-sm font-medium leading-6 text-[var(--muted-foreground)] shadow-[3px_3px_0_var(--border-color)]">
              Four candidates sent portfolio updates. Two include product design case studies and one added a React prototype.
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {['Hiring', 'Portfolio', 'This week'].map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 border-2 border-[var(--border-color)] bg-[var(--secondary)] px-2.5 py-1 font-mono text-xs font-bold text-black shadow-[2px_2px_0_var(--border-color)]">
                  <Tags className="h-3 w-3" aria-hidden="true" />
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </MockupFrame>
    </motion.div>
  );
}

export function InboxFlowVisual() {
  return (
    <div className="grid gap-4 sm:grid-cols-3" aria-label="Inbox automation flow">
      {[
        { icon: Inbox, title: 'Incoming', copy: 'Every new thread is read with context.' },
        { icon: Sparkles, title: 'Reasoned', copy: 'The assistant extracts intent and urgency.' },
        { icon: CheckCircle2, title: 'Actioned', copy: 'Drafts, labels, and summaries are ready.' },
      ].map((item) => (
        <div key={item.title} className="neo-card neo-lift p-5">
          <item.icon className="mb-4 h-6 w-6 text-[var(--primary)]" aria-hidden="true" />
          <h3 className="text-base font-bold text-[var(--card-foreground)]">{item.title}</h3>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted-foreground)]">{item.copy}</p>
        </div>
      ))}
    </div>
  );
}
