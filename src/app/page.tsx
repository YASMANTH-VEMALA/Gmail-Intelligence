'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CTA } from '@/components/landing/CTA';
import { FAQ } from '@/components/landing/FAQ';
import { Features } from '@/components/landing/Features';
import { Footer } from '@/components/landing/Footer';
import { Hero } from '@/components/landing/Hero';
import { Highlights } from '@/components/landing/Highlights';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Navbar } from '@/components/landing/Navbar';
import { Pricing } from '@/components/landing/Pricing';
import { Security } from '@/components/landing/Security';
import { Stats } from '@/components/landing/Stats';
import { Testimonials } from '@/components/landing/Testimonials';
import { TrustBar } from '@/components/landing/TrustBar';

export default function LandingPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const storedUserId = localStorage.getItem('repeatless_user_id');
    if (storedUserId) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleConnect = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/gmail');
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Failed to get auth URL:', err);
    }
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className={cn(isDark && 'dark')}>
        <div className="landing-page min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased transition-colors duration-300">
          <Navbar onConnect={handleConnect} isDark={isDark} onToggleTheme={() => setIsDark((value) => !value)} />
          <main>
            <Hero onConnect={handleConnect} />
            <TrustBar />
            <Features />
            <HowItWorks />
            <Highlights />
            <Stats />
            <Testimonials />
            <Pricing onConnect={handleConnect} />
            <Security />
            <FAQ />
            <CTA onConnect={handleConnect} />
          </main>
          <Footer />
        </div>
      </div>
    </MotionConfig>
  );
}
