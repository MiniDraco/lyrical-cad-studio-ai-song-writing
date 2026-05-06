import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LyricalCAD Studio',
  description: 'Professional-grade lyric workstation with rhythmic CAD features',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-studio-bg overflow-hidden">{children}</body>
    </html>
  );
}
