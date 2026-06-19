'use client';

import { Stagger, StaggerItem } from './animations';
import { LandingLottie } from './LandingLottie';
import animSparkles from '../../../public/animations/anim_sparkles.json';
import animSearch from '../../../public/animations/anim_search.json';
import sayHi from '../../../public/animations/say_hi.json';
import animZap from '../../../public/animations/anim_zap.json';
import shield from '../../../public/animations/shield.json';
import animMail from '../../../public/animations/anim_mail.json';

const features = [
  {
    animationData: animSparkles,
    title: 'AI Summaries',
    description: 'Collapse long threads into decisions, blockers, owners, and next steps without reading every reply.',
  },
  {
    animationData: animSearch,
    title: 'Smart Chat',
    description: 'Ask natural-language questions across your mailbox and get grounded answers with thread context.',
  },
  {
    animationData: sayHi,
    title: 'Auto Categorize',
    description: 'Label finance, recruiting, newsletters, work, and personal email automatically as mail arrives.',
  },
  {
    animationData: animZap,
    title: 'Quick Compose',
    description: 'Turn rough prompts into polished replies that match the thread, recipient, and intended tone.',
  },
  {
    animationData: shield,
    title: 'Secure OAuth 2.0',
    description: 'Connect through Google authorization so you can grant access cleanly and revoke it anytime.',
  },
  {
    animationData: animMail,
    title: 'Thread Aware',
    description: 'Every draft and summary understands the full conversation, not just the latest message.',
  },
];

export function Features() {
  return (
    <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="neo-kicker">Features</p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal text-[var(--foreground)] sm:text-5xl">
            Everything your inbox needs after the first coffee.
          </h2>
          <p className="mt-5 text-lg font-medium leading-8 text-[var(--muted-foreground)]">
            Gmail Intelligence handles the work around email so you can focus on the actual decision, customer, candidate, or deal.
          </p>
        </div>

        <Stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <article className="neo-card neo-lift group h-full bg-[var(--card)] p-6">
                <div className="mb-6 flex h-16 w-16 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--secondary)] shadow-[3px_3px_0_var(--border-color)]">
                  <LandingLottie animationData={feature.animationData} className="h-14 w-14" label={`${feature.title} animation`} />
                </div>
                <h3 className="text-xl font-bold text-[var(--card-foreground)]">{feature.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-[var(--muted-foreground)]">{feature.description}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
