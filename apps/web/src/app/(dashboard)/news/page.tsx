'use client';

import { useState } from 'react';
import { NewsFeed } from '../news-feed';
import { TournamentDecks } from './tournament-decks';

type Tab = 'news' | 'decks';

export default function NewsPage() {
  const [tab, setTab] = useState<Tab>('news');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="lg-page-title">News</h1>
        <p className="lg-text-secondary">Latest from the Riftbound community</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-surface-border">
        <button
          onClick={() => setTab('news')}
          className={tab === 'news' ? 'lg-tab-active' : 'lg-tab-inactive'}
        >
          Articles
        </button>
        <button
          onClick={() => setTab('decks')}
          className={tab === 'decks' ? 'lg-tab-active' : 'lg-tab-inactive'}
        >
          Top Events
        </button>
      </div>

      {/* Content */}
      {tab === 'news' && <NewsFeed />}
      {tab === 'decks' && <TournamentDecks />}
    </div>
  );
}
