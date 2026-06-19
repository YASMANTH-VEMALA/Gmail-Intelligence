'use client';

import { Quote, Star } from 'lucide-react';
import { Stagger, StaggerItem } from './animations';

const testimonials = [
  {
    name: 'Mira Shah',
    role: 'Founder, Atlas Works',
    initials: 'MS',
    quote: 'The summary view changed my mornings. I can see every thread that needs judgment before I open Gmail.',
  },
  {
    name: 'Evan Brooks',
    role: 'Recruiting Lead',
    initials: 'EB',
    quote: 'Candidate follow-ups stopped slipping. I ask the mailbox what changed this week and get a focused answer.',
  },
  {
    name: 'Lena Ortiz',
    role: 'Operations Manager',
    initials: 'LO',
    quote: 'The compose flow gets the boring first draft out of the way, but still keeps our voice human.',
  },
];

export function Testimonials() {
  return (
    <section className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="neo-kicker">Teams already feel the difference</p>
          <h2 className="mt-4 text-4xl font-bold tracking-normal text-[var(--foreground)] sm:text-5xl">
            Less inbox drag. More decisive work.
          </h2>
        </div>

        <Stagger className="mt-12 grid gap-5 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <StaggerItem key={testimonial.name}>
              <figure className="neo-card neo-lift h-full p-6">
                <div className="mb-6 flex items-center justify-between">
                  <Quote className="h-6 w-6 text-[var(--primary)]" aria-hidden="true" />
                  <div className="flex gap-1 text-[#ffff00]" aria-label="Five star rating">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" aria-hidden="true" />
                    ))}
                  </div>
                </div>
                <blockquote className="text-lg font-bold leading-8 text-[var(--card-foreground)]">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-8 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center border-2 border-[var(--border-color)] bg-[var(--accent-color)] font-mono text-sm font-bold text-[var(--accent-foreground)] shadow-[3px_3px_0_var(--border-color)]">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--card-foreground)]">{testimonial.name}</p>
                    <p className="text-sm font-medium text-[var(--muted-foreground)]">{testimonial.role}</p>
                  </div>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
