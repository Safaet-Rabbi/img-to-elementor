import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Design-to-Elementor | Antigravity',
  description: 'Convert webpage designs and screenshots directly to native Elementor JSON structures',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

