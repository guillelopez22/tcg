// Rendering: Client page — user's decks list, protected

import type { Metadata } from 'next';
import { DeckList } from './deck-list';

export const metadata: Metadata = {
  title: 'My Decks',
};

export default function DecksPage() {
  return <DeckList />;
}
