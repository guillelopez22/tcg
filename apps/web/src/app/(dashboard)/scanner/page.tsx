// Rendering: Client page — requires camera access, user input, and collection mutation

import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { ScanlineStyle } from './card-scanner';

export const metadata: Metadata = {
  title: 'Card Scanner',
};

// Lazy-load scanner orchestrator. ssr: false because it uses camera APIs.
const ScannerOrchestrator = dynamic(
  () => import('./scanner-orchestrator').then((m) => ({ default: m.ScannerOrchestrator })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="lg-spinner" role="status">
          <span className="sr-only">Loading scanner...</span>
        </div>
      </div>
    ),
  },
);

export default function ScannerPage() {
  return (
    <>
      <ScanlineStyle />
      <ScannerOrchestrator />
    </>
  );
}
