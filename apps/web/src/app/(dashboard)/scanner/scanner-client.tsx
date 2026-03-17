'use client';

import dynamic from 'next/dynamic';
import { ScanlineStyle } from './card-scanner';

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

export default function ScannerClient() {
  return (
    <>
      <ScanlineStyle />
      <ScannerOrchestrator />
    </>
  );
}
