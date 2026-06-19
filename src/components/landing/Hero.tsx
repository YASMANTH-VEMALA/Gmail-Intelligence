'use client';

import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, LockKeyhole, Sparkles } from 'lucide-react';
import { FadeIn } from './animations';
import { LandingButton } from './Button';
import { HeroHumanSvg } from './HumanIllustrations';
import { LandingLottie } from './LandingLottie';
import { HeroDashboardMockup } from './Mockups';
import type { LandingAction } from './types';
import flappyBird from '../../../public/animations/flappy_bird.json';
import animSparkles from '../../../public/animations/anim_sparkles.json';

export function Hero({ onConnect }: LandingAction) {
  return (
    <section id="top" className="relative overflow-hidden px-4 pb-24 pt-20 sm:px-6 lg:px-8 lg:pb-32 lg:pt-24">
      <div className="landing-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="landing-ambient pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto mb-8 grid max-w-3xl items-center gap-4 sm:grid-cols-[140px_1fr_120px]"
          >
            <div className="neo-card hidden h-32 items-center justify-center bg-white sm:flex">
              <LandingLottie animationData={flappyBird} className="h-28 w-28" label="Mail carrier animation" />
            </div>
            <div className="neo-card-lg bg-white p-3">
              <HeroHumanSvg />
            </div>
            <div className="neo-panel-yellow hidden h-28 items-center justify-center sm:flex">
              <LandingLottie animationData={animSparkles} className="h-24 w-24" label="AI sparkle animation" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="neo-kicker mb-6"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI that understands every thread in context
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="neo-title-shadow text-balance text-5xl font-bold tracking-normal text-[var(--foreground)] sm:text-6xl lg:text-7xl"
          >
            Turn Gmail into your fastest executive assistant.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
            className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-[var(--muted-foreground)] sm:text-xl"
          >
            Summarize long threads, write crisp replies, organize your inbox, and chat with years of mail in seconds.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <LandingButton onClick={onConnect} showMail showArrow id="connect-gmail-btn">
              Connect with Gmail
            </LandingButton>
            <a
              href="#features"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-none border-2 border-[var(--border-color)] bg-[var(--card)] px-5 py-3 text-sm font-bold text-[var(--card-foreground)] shadow-[4px_4px_0_var(--border-color)] transition hover:bg-[var(--secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black"
            >
              See how it works
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </motion.div>

          <FadeIn delay={0.25} className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-[var(--foreground)]">
            {[
              { icon: BadgeCheck, label: 'OAuth 2.0 sign-in' },
              { icon: LockKeyhole, label: 'Encrypted transport' },
              { icon: Sparkles, label: 'Gemini-powered workflows' },
            ].map((item) => (
              <span key={item.label} className="inline-flex items-center gap-2 border-2 border-[var(--border-color)] bg-[var(--card)] px-3 py-1.5 shadow-[3px_3px_0_var(--border-color)]">
                <item.icon className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                {item.label}
              </span>
            ))}
          </FadeIn>
        </div>

        <div className="mt-16">
          <HeroDashboardMockup />
        </div>
      </div>
    </section>
  );
}
