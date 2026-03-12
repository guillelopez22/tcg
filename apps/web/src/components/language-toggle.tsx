'use client';

// Language toggle — switches between EN and ES locale using a cookie.
// On toggle, sets the 'locale' cookie and reloads the page so next-intl picks it up.

import { useTranslations, useLocale } from 'next-intl';

export function LanguageToggle() {
  const t = useTranslations('nav');
  const locale = useLocale();

  function switchLocale() {
    const next = locale === 'en' ? 'es' : 'en';
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }

  return (
    <button
      onClick={switchLocale}
      className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg hover:bg-surface-elevated"
      title={t('language')}
      aria-label={t('language')}
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
      </svg>
      <span className="font-medium text-xs uppercase tracking-wide">
        {locale === 'en' ? 'ES' : 'EN'}
      </span>
    </button>
  );
}
