import type { Metadata } from 'next';
import { SmartNav } from '@/components/smart-nav';
import { CardDetail } from './card-detail';

export const metadata: Metadata = { title: 'Card Detail' };

interface CardPageProps {
  params: Promise<{ id: string }>;
}

export default async function CardPage({ params }: CardPageProps) {
  const { id } = await params;
  return (
    <div className="min-h-screen bg-surface">
      <SmartNav />
      <main id="main-content">
        <CardDetail cardId={id} />
      </main>
    </div>
  );
}
