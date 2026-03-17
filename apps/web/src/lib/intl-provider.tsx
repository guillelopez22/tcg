'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useEffect, useState } from 'react';

function getLocaleFromCookie(): string {
  if (typeof document === 'undefined') return 'en';
  const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
  return match?.[1] ?? 'en';
}

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const loc = getLocaleFromCookie();
    setLocale(loc);

    import(`../../messages/${loc}.json`)
      .then((mod) => setMessages(mod.default))
      .catch(() => {
        // Fallback to English
        import('../../messages/en.json').then((mod) => setMessages(mod.default));
      });
  }, []);

  if (!messages) {
    return <>{children}</>;
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
