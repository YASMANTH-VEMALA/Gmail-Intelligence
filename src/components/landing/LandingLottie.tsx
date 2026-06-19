'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

type LandingLottieProps = {
  animationData: unknown;
  className?: string;
  loop?: boolean;
  label?: string;
};

export function LandingLottie({
  animationData,
  className,
  loop = true,
  label = 'Animated Gmail Intelligence illustration',
}: LandingLottieProps) {
  return (
    <div className={cn('flex items-center justify-center', className)} role="img" aria-label={label}>
      <Lottie animationData={animationData} loop={loop} />
    </div>
  );
}
