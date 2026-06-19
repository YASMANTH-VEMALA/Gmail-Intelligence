'use client';

import { cn } from '@/lib/utils';

type IllustrationProps = {
  className?: string;
};

export function HeroHumanSvg({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 420 260"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Person organizing email with an AI assistant"
    >
      <rect x="18" y="32" width="250" height="170" fill="#fff" stroke="#000" strokeWidth="4" />
      <rect x="18" y="32" width="250" height="34" fill="#ff3333" stroke="#000" strokeWidth="4" />
      <circle cx="42" cy="49" r="6" fill="#ffff00" stroke="#000" strokeWidth="3" />
      <circle cx="64" cy="49" r="6" fill="#00cc00" stroke="#000" strokeWidth="3" />
      <circle cx="86" cy="49" r="6" fill="#0066ff" stroke="#000" strokeWidth="3" />

      <rect x="42" y="88" width="154" height="18" fill="#f0f0f0" stroke="#000" strokeWidth="3" />
      <rect x="42" y="120" width="190" height="18" fill="#f0f0f0" stroke="#000" strokeWidth="3" />
      <rect x="42" y="152" width="132" height="18" fill="#f0f0f0" stroke="#000" strokeWidth="3" />
      <path d="M208 88h32v32h-32z" fill="#ffff00" stroke="#000" strokeWidth="3" />
      <path d="m214 96 10 10 10-10" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      <path d="M282 115c26-4 54 6 72 27 21 25 19 61-4 77-28 19-77 4-101-30-20-29 1-68 33-74z" fill="#99e9ff" stroke="#000" strokeWidth="4" />
      <path d="M294 91c11-13 33-8 39 8 6 17-7 34-24 33-21-2-28-26-15-41z" fill="#ffcab0" stroke="#000" strokeWidth="4" />
      <path d="M292 94c10-20 42-17 49 4-17 3-30 0-43-9l-6 5z" fill="#000" />
      <path d="M326 131c20 9 37 28 41 50l-74 19c-6-26 6-58 33-69z" fill="#ff3333" stroke="#000" strokeWidth="4" />
      <path d="M270 174c-23 2-45-9-58-28" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <path d="M211 145l-11-8" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <path d="M352 177l35 13" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <rect x="250" y="196" width="96" height="16" fill="#000" />
      <path d="M270 214h38l-16 28h-52l30-28z" fill="#0066ff" stroke="#000" strokeWidth="4" />
      <path d="M318 214h38l30 28h-52l-16-28z" fill="#00cc00" stroke="#000" strokeWidth="4" />

      <rect x="288" y="28" width="98" height="58" fill="#fff" stroke="#000" strokeWidth="4" />
      <path d="M301 44h72M301 60h46" stroke="#000" strokeWidth="4" strokeLinecap="round" />
      <path d="M374 75l18 20-28-9" fill="#ffff00" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

export function ComposeHumanSvg({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 360 240"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Person writing an AI-assisted email"
    >
      <rect x="18" y="30" width="220" height="150" fill="#fff" stroke="#000" strokeWidth="4" />
      <rect x="18" y="30" width="220" height="30" fill="#0066ff" stroke="#000" strokeWidth="4" />
      <path d="M44 84h122M44 110h160M44 136h92" stroke="#000" strokeWidth="6" strokeLinecap="round" />
      <path d="m248 76 47-28 31 51-47 28z" fill="#ffff00" stroke="#000" strokeWidth="4" />
      <path d="m259 81 31 7 25-20" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M246 141c17-26 55-22 68 7 16 36-20 76-58 58-27-13-27-41-10-65z" fill="#ffcab0" stroke="#000" strokeWidth="4" />
      <path d="M242 143c4-22 28-36 49-26 13 6 21 18 24 32-27 0-44-10-58-24-3 8-8 14-15 18z" fill="#000" />
      <path d="M245 181c21 23 54 27 82 12l15 31H214l31-43z" fill="#ff3333" stroke="#000" strokeWidth="4" />
      <path d="M224 184l-53 24" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <path d="M172 208l-25-7" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <path d="M309 189l24-25" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <circle cx="337" cy="158" r="10" fill="#00cc00" stroke="#000" strokeWidth="4" />
    </svg>
  );
}

export function ChatHumanSvg({ className }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 360 240"
      className={cn('h-auto w-full', className)}
      role="img"
      aria-label="Person chatting with their mailbox"
    >
      <rect x="34" y="26" width="128" height="70" fill="#fff" stroke="#000" strokeWidth="4" />
      <path d="M56 52h84M56 72h54" stroke="#000" strokeWidth="5" strokeLinecap="round" />
      <path d="M150 86l24 26-36-16" fill="#fff" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
      <rect x="190" y="54" width="130" height="82" fill="#ff3333" stroke="#000" strokeWidth="4" />
      <path d="M212 82h76M212 104h48" stroke="#000" strokeWidth="5" strokeLinecap="round" />
      <path d="M204 125l-26 28 39-17" fill="#ff3333" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="138" cy="144" r="31" fill="#ffcab0" stroke="#000" strokeWidth="4" />
      <path d="M112 143c2-28 31-45 56-30 9 6 16 14 20 25-25 4-49-2-68-19-1 10-3 18-8 24z" fill="#000" />
      <path d="M112 174c24 20 61 18 83-4l25 54H78l34-50z" fill="#0066ff" stroke="#000" strokeWidth="4" />
      <path d="M92 198l-39-34" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <path d="M206 197l48-22" stroke="#000" strokeWidth="8" strokeLinecap="round" />
      <rect x="244" y="162" width="58" height="40" fill="#ffff00" stroke="#000" strokeWidth="4" />
      <path d="m252 172 21 15 21-15" fill="none" stroke="#000" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
