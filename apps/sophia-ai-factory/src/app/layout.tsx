import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sophia AI Factory — AI Video Generation Platform',
  description:
    'Generate AI-powered videos for faceless YouTube channels and affiliate marketing empires.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" dir="ltr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
