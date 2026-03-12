'use client';

// Collection page — four-tab layout: Collection | Wantlist | Tradelist | Stats
// Tab state lives in React state (no URL search params needed for MVP).
// Stats tab is a placeholder — built in Plan 05.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CollectionTabs, type CollectionTab } from './collection-tabs';
import { CollectionGrid } from './collection-grid';
import { WantlistTab } from './wantlist-tab';
import { TradelistTab } from './tradelist-tab';

export default function CollectionPage() {
  const t = useTranslations('nav');
  const tStats = useTranslations('stats');
  const [activeTab, setActiveTab] = useState<CollectionTab>('collection');

  const tabLabels: Record<CollectionTab, string> = {
    collection: t('collection'),
    wantlist: t('wantlist'),
    tradelist: t('tradelist'),
    stats: tStats('title'),
  };

  return (
    <div className="space-y-4 lg-page-padding">
      <CollectionTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        labels={tabLabels}
      />

      {activeTab === 'collection' && <CollectionGrid />}
      {activeTab === 'wantlist' && <WantlistTab />}
      {activeTab === 'tradelist' && <TradelistTab />}
      {activeTab === 'stats' && (
        <div className="text-center py-16">
          <p className="lg-text-secondary">{tStats('title')} — Coming in Plan 05</p>
        </div>
      )}
    </div>
  );
}
