import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gmail Intelligence Platform — AI-Powered Email Assistant",
  description: "Connect your Gmail, summarize threads, compose AI-drafted emails, and chat with your inbox using cutting-edge AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
