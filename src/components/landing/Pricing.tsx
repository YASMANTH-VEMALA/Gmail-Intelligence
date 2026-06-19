'use client';

import { CheckCircle2 } from 'lucide-react';
import { LandingButton } from './Button';
import { FadeIn, Stagger, StaggerItem } from './animations';
import type { LandingAction } from './types';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'For trying the assistant on your everyday Gmail flow.',
    features: ['Connect one Gmail account', 'Thread summaries', 'Basic smart categories', 'Limited mailbox chat'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$12',
    description: 'For people and teams who live in email every day.',
    features: ['Unlimited AI summaries', 'Advanced mailbox chat', 'AI compose and reply', 'Priority sync', 'Security controls'],
    highlighted: true,
  },
];

export function Pricing({ onConnect }: LandingAction) {
  return (
    <section id="pricing" className="border-y-2 border-[var(--border-color)] bg-[var(--muted)] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <p className="neo-kicker">Pricing</p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal text-[var(--foreground)] sm:text-5xl">
            Start free. Upgrade when your inbox demands it.
          </h2>
          <p className="mt-5 text-lg font-medium leading-8 text-[var(--muted-foreground)]">
            Simple plans for individuals now, with team controls ready as your workflow grows.
          </p>
        </FadeIn>

        <Stagger className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-2">
          {plans.map((plan) => (
            <StaggerItem key={plan.name}>
              <article
                className={
                  plan.highlighted
                    ? 'relative h-full border-2 border-[var(--border-color)] bg-[var(--primary)] p-7 text-[var(--primary-foreground)] shadow-[8px_8px_0_var(--border-color)]'
                    : 'neo-card h-full p-7'
                }
              >
                {plan.highlighted && (
                  <div className="absolute right-5 top-5 border-2 border-black bg-[var(--secondary)] px-3 py-1 font-mono text-xs font-bold text-black shadow-[2px_2px_0_black]">
                    Recommended
                  </div>
                )}
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                <p className={plan.highlighted ? 'mt-3 font-medium text-black' : 'mt-3 font-medium text-[var(--muted-foreground)]'}>{plan.description}</p>
                <div className="mt-8 flex items-end gap-2">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="mb-2 text-sm font-bold">/ month</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm font-bold">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-[#00cc00]" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <LandingButton
                  onClick={onConnect}
                  variant={plan.highlighted ? 'primary' : 'secondary'}
                  showMail
                  className="mt-9 w-full"
                  id={`connect-gmail-btn-${plan.name.toLowerCase()}`}
                >
                  Connect with Gmail
                </LandingButton>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
