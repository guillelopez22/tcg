import type { Metadata } from 'next';
import { NewsFeed } from './news-feed';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default function DashboardHomePage() {
  return (
    <div className="space-y-6">
      <NewsFeed />
    </div>
  );
}
