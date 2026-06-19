'use client';

import { Building2, CheckCircle2, Globe2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Stagger, StaggerItem } from './animations';
import { LandingLottie } from './LandingLottie';
import shieldAnimation from '../../../public/animations/shield.json';
import mailAnimation from '../../../public/animations/anim_mail.json';

const badges = [
  { icon: Mail, label: 'Works with Gmail' },
  { icon: ShieldCheck, label: 'Google OAuth 2.0' },
  { icon: LockKeyhole, label: 'Secure by default' },
  { icon: Globe2, label: 'Built for remote teams' },
];

export function TrustBar() {
  return (
    <section className="border-y-2 border-[var(--border-color)] bg-[var(--muted)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <div className="neo-kicker">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Trusted workflows for high-volume inboxes
            </div>
            <p className="mt-4 max-w-xl text-lg font-bold leading-7 text-[var(--foreground)]">
              Designed for founders, operators, recruiters, and support teams who cannot afford to miss the important thread.
            </p>
            <div className="mt-5 flex gap-3">
              <div className="neo-card flex h-20 w-20 items-center justify-center bg-white">
                <LandingLottie animationData={mailAnimation} className="h-16 w-16" label="Mail animation" />
              </div>
              <div className="neo-card flex h-20 w-20 items-center justify-center bg-white">
                <LandingLottie animationData={shieldAnimation} className="h-16 w-16" label="Security animation" />
              </div>
            </div>
          </div>

          <Stagger className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {badges.map((badge) => (
              <StaggerItem key={badge.label}>
                <div className="neo-card neo-lift flex min-h-28 flex-col justify-between p-4">
                  <badge.icon className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
                  <div className="mt-5 flex items-center gap-2 text-sm font-bold text-[var(--card-foreground)]">
                    <CheckCircle2 className="h-4 w-4 text-[#00cc00]" aria-hidden="true" />
                    {badge.label}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
