'use client';

import { Mail, Sparkles } from 'lucide-react';
import { FadeIn } from './animations';
import { LandingButton } from './Button';
import type { LandingAction } from './types';

export function CTA({ onConnect }: LandingAction) {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <FadeIn className="neo-panel-red mx-auto max-w-7xl overflow-hidden px-6 py-16 text-center sm:px-10 lg:px-16">
        <div className="mx-auto flex h-14 w-14 items-center justify-center border-2 border-black bg-[var(--secondary)] text-black shadow-[4px_4px_0_black]">
          <Mail className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="mx-auto mt-8 inline-flex border-2 border-black bg-[var(--secondary)] px-3 py-1.5 font-mono text-sm font-bold uppercase tracking-normal text-black shadow-[3px_3px_0_black]">
          Ready when your inbox is
        </p>
        <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-normal text-black sm:text-5xl">
          Give every email the context it deserves.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg font-bold leading-8 text-black">
          Connect Gmail and turn summaries, drafting, categorization, and mailbox chat into one calm workflow.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <LandingButton onClick={onConnect} showMail showArrow variant="secondary" id="connect-gmail-btn-final">
            Connect with Gmail
          </LandingButton>
          <span className="inline-flex items-center gap-2 font-mono text-sm font-bold text-black">
            <Sparkles className="h-4 w-4 text-black" aria-hidden="true" />
            Secure OAuth sign-in
          </span>
        </div>
      </FadeIn>
    </section>
  );
}
