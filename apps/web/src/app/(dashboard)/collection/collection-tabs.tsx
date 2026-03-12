'use client';

// Collection tab bar — horizontal scroll on mobile, 4 tabs
// Active tab is driven by the `activeTab` prop from the parent

export type CollectionTab = 'collection' | 'wantlist' | 'tradelist' | 'stats';

interface CollectionTabsProps {
  activeTab: CollectionTab;
  onTabChange: (tab: CollectionTab) => void;
  labels: Record<CollectionTab, string>;
}

export function CollectionTabs({ activeTab, onTabChange, labels }: CollectionTabsProps) {
  const tabs: CollectionTab[] = ['collection', 'wantlist', 'tradelist', 'stats'];

  return (
    <div className="border-b border-surface-border overflow-x-auto scrollbar-hide -mx-4 px-4">
      <nav className="flex gap-1 min-w-max" role="tablist" aria-label="Collection sections">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => onTabChange(tab)}
            className={activeTab === tab ? 'lg-tab-active' : 'lg-tab-inactive'}
          >
            {labels[tab]}
          </button>
        ))}
      </nav>
    </div>
  );
}
