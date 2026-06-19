'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import { Clock3, Inbox, Sparkles, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Stagger, StaggerItem } from './animations';

const stats: Array<{ icon: LucideIcon; value: number; suffix: string; label: string; copy: string }> = [
  { icon: Clock3, value: 8, suffix: '+', label: 'hours saved weekly', copy: 'Less triage, rewriting, and thread archaeology.' },
  { icon: Inbox, value: 1200, suffix: '+', label: 'emails processed', copy: 'A realistic weekly load for busy operators.' },
  { icon: Sparkles, value: 94, suffix: '%', label: 'threads summarized', copy: 'Long conversations distilled into next steps.' },
  { icon: Zap, value: 3, suffix: 'x', label: 'faster replies', copy: 'Drafts start with context already included.' },
];

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || reduceMotion) return;

    let frame = 0;
    const totalFrames = 46;
    const timer = window.setInterval(() => {
      frame += 1;
      const progress = Math.min(frame / totalFrames, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress === 1) window.clearInterval(timer);
    }, 24);

    return () => window.clearInterval(timer);
  }, [inView, reduceMotion, value]);

  return (
    <span ref={ref}>
      {(reduceMotion ? value : display).toLocaleString()}
      {suffix}
    </span>
  );
}

export function Stats() {
  return (
    <section className="border-y-2 border-[var(--border-color)] bg-black px-4 py-24 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.5fr] lg:items-end">
          <div>
            <p className="neo-kicker">Impact</p>
            <h2 className="mt-4 text-4xl font-bold tracking-normal text-white sm:text-5xl">
              Email feels lighter when the busywork is handled.
            </h2>
          </div>
          <p className="text-lg font-medium leading-8 text-zinc-200">
            These sample benchmarks show the kind of leverage Gmail Intelligence is built for: faster triage, more consistent replies, and fewer missed follow-ups.
          </p>
        </div>

        <Stagger className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StaggerItem key={stat.label}>
              <article className="h-full border-2 border-white bg-[#333333] p-6 shadow-[6px_6px_0_#ffffff]">
                <stat.icon className="h-6 w-6 text-[#ff3333]" aria-hidden="true" />
                <div className="mt-8 text-4xl font-bold tracking-normal">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </div>
                <h3 className="mt-2 text-base font-bold text-white">{stat.label}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-zinc-300">{stat.copy}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
