'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { CARD_CONDITIONS, CARD_VARIANTS } from '@la-grieta/shared';
import { ScanConfirmation } from './scan-confirmation';
import type { ScanMatch, ConfirmationState } from './scan-confirmation';
import { type CooldownSeconds, DEFAULT_COOLDOWN, loadCooldown } from './scanner-settings';

// ── Types ────────────────────────────────────────────────────────────────────

type CardCondition = (typeof CARD_CONDITIONS)[number];
type CardVariant = (typeof CARD_VARIANTS)[number];

export interface ScannedEntry {
  card: ScanMatch;
  variant: CardVariant;
  condition: CardCondition;
  quantity: number;
  addedAt: Date;
}

type ScanState = 'loading' | 'scanning' | 'confirming' | 'cooldown';

// ── Constants ─────────────────────────────────────────────────────────────────

const CONSECUTIVE_HITS_REQUIRED = 3;
const SCAN_INTERVAL_MS = 1200;
const FRAME_QUALITY = 0.75;

// ── Component ─────────────────────────────────────────────────────────────────

export interface CardScannerProps {
  session: ScannedEntry[];
  onSessionUpdate: (entries: ScannedEntry[]) => void;
  cooldown: CooldownSeconds;
  onEndSession: () => void;
}

export function CardScanner({ session, onSessionUpdate, cooldown, onEndSession }: CardScannerProps) {
  const t = useTranslations('scanner');

  // ── State machine ──────────────────────────────────────────────────────────
  const [scanState, setScanState] = useState<ScanState>('loading');
  const [statusMessage, setStatusMessage] = useState(t('scanning'));

  // ── Confirmation overlay state ─────────────────────────────────────────────
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);

  // ── Scanner service status ─────────────────────────────────────────────────
  const { data: scannerStatus } = trpc.scanner.status.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.ready ? false : 2000),
    staleTime: 5000,
  });

  const identifyMutation = trpc.scanner.identify.useMutation();

  // ── tRPC utils + bulk add mutation ────────────────────────────────────────
  const utils = trpc.useUtils();

  const addBulkMutation = trpc.collection.addBulk.useMutation({
    onSuccess(_data, _variables) {
      if (!confirmation) return;
      const { match, quantity, variant, condition } = confirmation;

      void utils.collection.stats.invalidate();
      void utils.collection.list.invalidate();

      const entry: ScannedEntry = {
        card: match,
        variant,
        condition,
        quantity,
        addedAt: new Date(),
      };
      onSessionUpdate([...session, entry]);
      toast.success(t('addedWithName', { name: match.name }));

      setConfirmation(null);
      setScanState('cooldown');
      setStatusMessage(t('resuming'));

      setTimeout(() => {
        setScanState('scanning');
        setStatusMessage(t('detectingCard'));
      }, cooldown * 1000);
    },
    onError(err) {
      toast.error(err.message ?? 'Failed to add card');
      setScanState('confirming');
    },
  });

  // ── Camera controls ────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not available on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setCameraError(null);
    } catch {
      setCameraError('Camera access denied. Use the file upload below as a fallback.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    void startCamera();
    return () => { stopCamera(); };
  }, [startCamera, stopCamera]);

  // ── Loading → scanning transition ──────────────────────────────────────────
  useEffect(() => {
    const cameraReady = cameraActive || cameraError !== null;
    const serverReady = scannerStatus?.ready === true;
    if (scanState === 'loading' && cameraReady && serverReady) {
      setScanState('scanning');
      setStatusMessage(t('detectingCard'));
    }
  }, [scanState, cameraActive, cameraError, scannerStatus?.ready, t]);

  // ── Viewfinder crop ────────────────────────────────────────────────────────

  function getViewfinderCrop(): { x: number; y: number; w: number; h: number } | null {
    const video = videoRef.current;
    const vf = viewfinderRef.current;
    if (!video || !vf) return null;

    const containerRect = video.getBoundingClientRect();
    const vfRect = vf.getBoundingClientRect();

    const cW = containerRect.width;
    const cH = containerRect.height;
    const vW = video.videoWidth;
    const vH = video.videoHeight;

    if (cW === 0 || cH === 0 || vW === 0 || vH === 0) return null;

    const containerAspect = cW / cH;
    const videoAspect = vW / vH;

    let displayedW: number, displayedH: number, offsetX: number, offsetY: number;
    if (videoAspect > containerAspect) {
      displayedH = cH;
      displayedW = cH * videoAspect;
      offsetX = (displayedW - cW) / 2;
      offsetY = 0;
    } else {
      displayedW = cW;
      displayedH = cW / videoAspect;
      offsetX = 0;
      offsetY = (displayedH - cH) / 2;
    }

    const scaleX = vW / displayedW;
    const scaleY = vH / displayedH;

    const x = Math.round(((vfRect.left - containerRect.left) + offsetX) * scaleX);
    const y = Math.round(((vfRect.top - containerRect.top) + offsetY) * scaleY);
    const w = Math.round(vfRect.width * scaleX);
    const h = Math.round(vfRect.height * scaleY);

    const cx = Math.max(0, x);
    const cy = Math.max(0, y);
    const cw = Math.min(w, vW - cx);
    const ch = Math.min(h, vH - cy);

    if (cw <= 0 || ch <= 0) return null;
    return { x: cx, y: cy, w: cw, h: ch };
  }

  function captureFrame(): string | null {
    const video = videoRef.current;
    if (!video) return null;

    const crop = getViewfinderCrop();
    if (!crop) return null;

    const canvas = document.createElement('canvas');
    canvas.width = crop.w;
    canvas.height = crop.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
    const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY);
    return dataUrl.split(',')[1] ?? null;
  }

  // ── Auto-scan loop ─────────────────────────────────────────────────────────

  const scanningRef = useRef(false);
  const scanStateRef = useRef<ScanState>(scanState);
  scanStateRef.current = scanState;

  const consecutiveWinnerRef = useRef<{ id: string; count: number } | null>(null);

  const runScan = useCallback(async () => {
    if (scanningRef.current) return;
    if (scanStateRef.current !== 'scanning') return;

    const frame = captureFrame();
    if (!frame) return;

    scanningRef.current = true;

    try {
      const result = await identifyMutation.mutateAsync({ frame });

      if (scanStateRef.current !== 'scanning') {
        scanningRef.current = false;
        return;
      }

      const topMatch = result.matches[0];

      if (result.matches.length > 0 && topMatch) {
        const winnerId = topMatch.cardId;
        const prev = consecutiveWinnerRef.current;

        if (prev && prev.id === winnerId) {
          prev.count++;
        } else {
          consecutiveWinnerRef.current = { id: winnerId, count: 1 };
        }

        const hits = consecutiveWinnerRef.current!.count;

        if (hits >= CONSECUTIVE_HITS_REQUIRED) {
          consecutiveWinnerRef.current = null;
          setScanState('confirming');
          setConfirmation({
            match: topMatch,
            quantity: 1,
            variant: 'normal',
            condition: 'near_mint',
          });
          setStatusMessage(`Match confirmed (${hits} scans)`);
        } else {
          setStatusMessage(`${t('lockingOn')} ${hits}/${CONSECUTIVE_HITS_REQUIRED}`);
        }
      } else {
        consecutiveWinnerRef.current = null;
        setStatusMessage(t('detectingCard'));
      }
    } catch {
      // Silently ignore scan errors — just continue the loop
    }

    scanningRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    if (!cameraActive) return;
    if (scanState !== 'scanning') return;

    const interval = setInterval(() => {
      if (scanStateRef.current === 'scanning' && !scanningRef.current) {
        void runScan();
      }
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [cameraActive, scanState, runScan]);

  // ── File upload fallback ───────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setScanState('scanning');
      setStatusMessage('Reading card image...');

      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        );

        const result = await identifyMutation.mutateAsync({ frame: base64 });

        if (result.matches.length === 0) {
          setStatusMessage('No matches found. Try a clearer image.');
          setScanState('scanning');
        } else {
          const top = result.matches[0]!;
          setScanState('confirming');
          setConfirmation({
            match: top,
            quantity: 1,
            variant: 'normal',
            condition: 'near_mint',
          });
          setStatusMessage(`Match found: "${top.name}"`);
        }
      } catch {
        setStatusMessage('Failed to process image. Please try again.');
        setScanState('scanning');
      }

      e.target.value = '';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Confirmation handlers ──────────────────────────────────────────────────

  function handleAdd() {
    if (!confirmation) return;
    const { match, quantity, variant, condition } = confirmation;

    // Build quantity copies as separate entries for addBulk
    const entries = Array.from({ length: quantity }, () => ({
      cardId: match.cardId,
      variant,
      condition,
    }));

    addBulkMutation.mutate({ entries });
  }

  function handleSkip() {
    setConfirmation(null);
    consecutiveWinnerRef.current = null;
    setScanState('scanning');
    setStatusMessage(t('detectingCard'));
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const isLoading = scanState === 'loading';

  function loadingSubtext(): string {
    if (!cameraActive && !cameraError) return 'Starting camera...';
    if (!scannerStatus) return 'Connecting to scanner service...';
    if (!scannerStatus.ready) {
      const pct = scannerStatus.total > 0
        ? Math.round((scannerStatus.loaded / scannerStatus.total) * 100)
        : 0;
      return `Loading fingerprints... ${scannerStatus.loaded}/${scannerStatus.total} (${pct}%)`;
    }
    return 'Almost ready...';
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-lg mx-auto">

      {/* Camera + viewfinder */}
      <div className="lg-card overflow-hidden">
        {cameraActive ? (
          <div className="relative bg-black" style={{ aspectRatio: '4/3' }}>
            {/* Live video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              aria-label="Camera preview — hold your card up to scan"
            />

            {/* Darkened vignette with card-shaped cutout */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute inset-x-0 top-0 bg-black/55" style={{ bottom: 'calc(50% + 49%)' }} />
              <div className="absolute inset-x-0 bottom-0 bg-black/55" style={{ top: 'calc(50% + 49%)' }} />
              <div className="absolute inset-y-0 left-0 bg-black/55" style={{ right: 'calc(50% + 35%)' }} />
              <div className="absolute inset-y-0 right-0 bg-black/55" style={{ left: 'calc(50% + 35%)' }} />
            </div>

            {/* Viewfinder frame — 5:7 card ratio */}
            <div
              ref={viewfinderRef}
              className="absolute"
              style={{ left: '15%', width: '70%', top: '50%', transform: 'translateY(-50%)', aspectRatio: '5/7' }}
              aria-hidden="true"
            >
              <div
                className="absolute inset-0 rounded-xl border-2 border-rift-400/80"
                style={{ animation: 'rift-pulse 2s ease-in-out infinite' }}
              />
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-rift-300 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-rift-300 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-rift-300 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-rift-300 rounded-br-xl" />

              {/* Scanline animation */}
              {scanState === 'scanning' && (
                <div
                  className="absolute inset-x-0 h-px bg-rift-400/70"
                  style={{ animation: 'scanline 2s linear infinite', top: '50%' }}
                />
              )}
            </div>

            {/* Status hint */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none" aria-hidden="true">
              <span className="text-xs text-white/70 bg-black/50 rounded-full px-3 py-1 backdrop-blur-sm">
                {scanState === 'cooldown' ? t('resuming') : t('holdCard')}
              </span>
            </div>

            {/* Close camera button */}
            <button
              onClick={stopCamera}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-zinc-400 hover:text-white transition-colors"
              aria-label="Close camera"
            >
              <IconX className="w-4 h-4" />
            </button>

            {/* Session counter badge */}
            {session.length > 0 && (
              <div className="absolute top-2 left-2 pointer-events-none">
                <span className="lg-badge bg-rift-950/90 text-rift-300 border border-rift-800/60 text-xs px-2.5 py-1">
                  {t('sessionCounter', { count: session.reduce((n, e) => n + e.quantity, 0) })}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-surface-elevated flex flex-col items-center justify-center py-10 gap-3 px-4">
            {cameraError ? (
              <>
                <IconCameraOff className="w-10 h-10 text-zinc-600" />
                <p className="lg-text-secondary text-center text-sm">{cameraError}</p>
                <button
                  onClick={() => void startCamera()}
                  className="lg-btn-ghost text-xs"
                >
                  Try camera again
                </button>
              </>
            ) : (
              <>
                <div className="lg-spinner" role="status">
                  <span className="sr-only">Starting camera...</span>
                </div>
                <p className="lg-text-secondary text-sm">Starting camera...</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="lg-card px-4 py-3 flex items-center gap-3"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isLoading ? (
          <div className="lg-spinner-sm flex-shrink-0" aria-hidden="true" />
        ) : scanState === 'cooldown' ? (
          <IconCheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        ) : (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              backgroundColor: scanState === 'scanning' ? '#818cf8' : '#6b7280',
              animation: scanState === 'scanning' ? 'rift-pulse 1.5s ease-in-out infinite' : 'none',
            }}
            aria-hidden="true"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-300 truncate">{statusMessage}</p>
          {isLoading && (
            <p className="lg-text-muted">{loadingSubtext()}</p>
          )}
          {!isLoading && scannerStatus?.ready && (
            <p className="lg-text-muted">{scannerStatus.loaded} cards indexed</p>
          )}
        </div>
      </div>

      {/* File upload fallback (camera error) */}
      {cameraError && (
        <div className="lg-field">
          <label htmlFor="card-image-upload" className="lg-label">
            Upload card photo
          </label>
          <label
            htmlFor="card-image-upload"
            className="lg-btn-secondary w-full flex items-center justify-center gap-2 cursor-pointer text-center"
          >
            <IconUpload className="w-4 h-4" />
            Choose photo from gallery
            <input
              id="card-image-upload"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => void handleFileUpload(e)}
              className="sr-only"
              disabled={isLoading}
            />
          </label>
        </div>
      )}

      {/* Scanning idle tip */}
      {scanState === 'scanning' && session.length === 0 && (
        <div className="text-center py-2">
          <p className="lg-text-secondary text-sm">
            {cameraActive
              ? t('holdCard')
              : cameraError
              ? 'Enable the camera or upload a photo'
              : 'Starting camera...'}
          </p>
        </div>
      )}

      {/* Confirmation overlay */}
      {scanState === 'confirming' && confirmation && (
        <ScanConfirmation
          state={confirmation}
          isPending={addBulkMutation.isPending}
          onQuantityChange={(qty) => setConfirmation((prev) => prev ? { ...prev, quantity: qty } : prev)}
          onVariantChange={(v) => setConfirmation((prev) => prev ? { ...prev, variant: v } : prev)}
          onConditionChange={(c) => setConfirmation((prev) => prev ? { ...prev, condition: c } : prev)}
          onAdd={handleAdd}
          onSkip={handleSkip}
        />
      )}
    </div>
  );
}

/* ── Scanline / animation keyframes ────────────────────────────────────── */
const ScanlineStyle = () => (
  <style>{`
    @keyframes scanline {
      0%   { top: 10%; opacity: 0; }
      10%  { opacity: 1; }
      90%  { opacity: 1; }
      100% { top: 90%; opacity: 0; }
    }
    @keyframes animate-fade-in-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up {
      animation: slide-up 0.22s ease-out forwards;
    }
  `}</style>
);

export { ScanlineStyle };

/* ── Icons ──────────────────────────────────────────────────────────────── */

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function IconCameraOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h3a2 2 0 0 1 2 2v9.34" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function IconCheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

/* re-export the cooldown loader so page.tsx can use it at mount */
export { loadCooldown };
