// Rendering: Client page — deck detail fetched by ID via tRPC, protected

import type { Metadata } from 'next';
import { DeckDetail } from './deck-detail';

export const metadata: Metadata = {
  title: 'Deck | La Grieta',
};

interface DeckPageProps {
  params: Promise<{ id: string }>;
}

export default async function DeckPage({ params }: DeckPageProps) {
  const { id } = await params;
  return <DeckDetail id={id} />;
}
