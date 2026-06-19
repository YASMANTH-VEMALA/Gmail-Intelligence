'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FadeIn } from './animations';

const faqs = [
  {
    question: 'Does this replace Gmail?',
    answer: 'No. Gmail Intelligence connects to Gmail and adds AI workflows on top of your existing mailbox. You can still use Gmail normally.',
  },
  {
    question: 'How does the Gmail connection work?',
    answer: 'The app requests authorization through Google OAuth 2.0 and uses API access to sync and analyze mailbox content for the features you choose.',
  },
  {
    question: 'Can I revoke access?',
    answer: 'Yes. You can disconnect by removing access from your Google account permissions, and the app is designed around explicit authorization.',
  },
  {
    question: 'What can I ask mailbox chat?',
    answer: 'Ask for follow-ups, recent decisions, specific sender context, invoice status, recruiting updates, or anything else that depends on your email history.',
  },
  {
    question: 'Is there a team plan?',
    answer: 'The current landing focuses on individual plans. Team controls can be layered in for shared workflows, admins, and audit needs.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="border-y-2 border-[var(--border-color)] bg-[var(--muted)] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <FadeIn className="text-center">
          <p className="neo-kicker">FAQ</p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal text-[var(--foreground)] sm:text-5xl">
            Questions before you connect.
          </h2>
        </FadeIn>

        <div className="neo-card-lg mt-12 divide-y-2 divide-[var(--border-color)] overflow-hidden">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className="flex w-full items-center justify-between gap-4 bg-[var(--card)] px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] sm:px-6"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-bold text-[var(--card-foreground)]">{faq.question}</span>
                  <ChevronDown
                    className={cn('h-5 w-5 flex-none text-[var(--primary)] transition-transform', isOpen && 'rotate-180')}
                    aria-hidden="true"
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="overflow-hidden"
                    >
                      <p className="bg-[var(--card)] px-5 pb-5 text-sm font-medium leading-7 text-[var(--muted-foreground)] sm:px-6">
                        {faq.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
