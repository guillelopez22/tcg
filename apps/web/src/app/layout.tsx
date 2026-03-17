import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/lib/providers';
import { IntlProvider } from '@/lib/intl-provider';
import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'La Grieta — Riftbound TCG Companion',
    template: '%s | La Grieta',
  },
  description: 'The definitive companion app for Riftbound TCG. Browse cards, manage your collection, and build decks.',
  keywords: ['Riftbound', 'TCG', 'trading card game', 'La Grieta', 'card browser', 'deck builder'],
  authors: [{ name: 'La Grieta' }],
  creator: 'La Grieta',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f0f14',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-rift-600 focus:text-white focus:rounded-lg"
        >
          Skip to content
        </a>
        <IntlProvider>
          <Providers>{children}</Providers>
        </IntlProvider>
      </body>
    </html>
  );
}
