import type { Metadata } from 'next';
import { SmartNav } from '@/components/smart-nav';
import { CardBrowser } from './card-browser';

export const metadata: Metadata = {
  title: 'Card Browser',
  description: 'Browse all Riftbound TCG cards across all sets.',
};

export default function CardsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <SmartNav />
      <main id="main-content" className="lg-container py-6 lg-page-padding">
        <h1 className="lg-page-title mb-6">Card Browser</h1>
        <CardBrowser />
      </main>
    </div>
  );
}
