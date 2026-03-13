'use client';

import { useState } from 'react';
import QRCode from 'react-qr-code';
import { toast } from 'sonner';

interface MatchQRCodeProps {
  code: string;
}

export function MatchQRCode({ code }: MatchQRCodeProps) {
  const [copied, setCopied] = useState(false);

  const joinUrl =
    typeof window !== 'undefined'
      ? `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/match/${code}`
      : `https://lagrieta.gg/match/${code}`;

  function handleCopy() {
    void navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      toast.success('Join link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* QR code */}
      <div className="rounded-xl overflow-hidden border border-surface-border bg-white p-4">
        <QRCode value={joinUrl} size={200} />
      </div>

      {/* Match code */}
      <div className="text-center space-y-1">
        <p className="text-zinc-400 text-sm">Match code</p>
        <p className="font-mono text-2xl tracking-wider text-white font-bold">{code}</p>
        <p className="text-zinc-500 text-xs">or visit: lagrieta.gg/match/{code}</p>
      </div>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="lg-btn-secondary flex items-center gap-2 text-sm"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy join link
          </>
        )}
      </button>
    </div>
  );
}
