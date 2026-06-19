'use client';

import { CheckCircle2 } from 'lucide-react';
import { FadeIn } from './animations';
import { ChatHumanSvg, ComposeHumanSvg, HeroHumanSvg } from './HumanIllustrations';
import { ChatMockup, ComposeMockup, SummaryMockup } from './Mockups';

const highlights = [
  {
    eyebrow: 'Summaries',
    title: 'Know the point of a thread before opening every reply.',
    copy: 'Gmail Intelligence extracts decisions, deadlines, owners, sentiment, and recommended next steps from messy chains.',
    bullets: ['Decision-first summaries', 'Blockers and owners called out', 'Reply recommendations included'],
    visual: SummaryMockup,
    human: HeroHumanSvg,
  },
  {
    eyebrow: 'Compose',
    title: 'Draft emails that already understand the relationship.',
    copy: 'Write from a prompt or ask the assistant to answer a thread. It keeps tone, history, and open questions in view.',
    bullets: ['Tone-aware drafting', 'Thread-aware context', 'Clear action-oriented replies'],
    visual: ComposeMockup,
    human: ComposeHumanSvg,
  },
  {
    eyebrow: 'Chat',
    title: 'Ask your mailbox the way you would ask a teammate.',
    copy: 'Find commitments, candidate updates, invoices, customer context, and hidden follow-ups with conversational search.',
    bullets: ['Natural-language questions', 'Source-backed answers', 'Cross-thread retrieval'],
    visual: ChatMockup,
    human: ChatHumanSvg,
  },
];

export function Highlights() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="neo-kicker">Deep dive</p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal text-[var(--foreground)] sm:text-5xl">
            Built for the parts of email that steal your day.
          </h2>
        </div>

        <div className="mt-16 space-y-24">
          {highlights.map((highlight, index) => {
            const Visual = highlight.visual;
            const Human = highlight.human;
            const reverse = index % 2 === 1;

            return (
              <div
                key={highlight.title}
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <FadeIn direction={reverse ? 'left' : 'right'} className={reverse ? 'lg:order-2' : undefined}>
                  <p className="neo-kicker">{highlight.eyebrow}</p>
                  <h3 className="mt-4 text-3xl font-bold tracking-normal text-[var(--foreground)] sm:text-4xl">
                    {highlight.title}
                  </h3>
                  <p className="mt-5 text-lg font-medium leading-8 text-[var(--muted-foreground)]">{highlight.copy}</p>
                  <ul className="mt-7 space-y-3">
                    {highlight.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-3 text-sm font-bold text-[var(--foreground)]">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-[#00cc00]" aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                  <div className="neo-card mt-8 max-w-md bg-white p-3">
                    <Human />
                  </div>
                </FadeIn>
                <FadeIn direction={reverse ? 'right' : 'left'} className={reverse ? 'lg:order-1' : undefined}>
                  <Visual />
                </FadeIn>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
