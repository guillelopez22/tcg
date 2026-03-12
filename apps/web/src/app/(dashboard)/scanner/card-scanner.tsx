'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { trpc } from '@/lib/trpc';
import { CARD_CONDITIONS } from '@la-grieta/shared';
import { RARITY_COLORS } from '@/lib/design-tokens';
import { toast } from 'sonner';

// ── Types ────────────────────────────────────────────────────────────────────

type CardCondition = (typeof CARD_CONDITIONS)[number];
type ScanState = 'loading' | 'scanning' | 'detected' | 'confirming' | 'added';

interface ScannerMatch {
  cardId: string;
  name: string;
  number: string | null;
  setName: string;
  imageSmall: string | null;
  score: number;
}

const CONDITION_LABELS: Record<CardCondition, string> = {
  near_mint: 'NM',
  lightly_played: 'LP',
  moderately_played: 'MP',
  heavily_played: 'HP',
  damaged: 'DMG',
};

const FALLBACK_RARITY = {
  text: 'text-zinc-400',
  bg: 'bg-zinc-800/50',
  border: 'border-zinc-700',
  glow: '',
};

// ── Constants ──────────────────────────────────────────────────────────────

const CONSECUTIVE_HITS_REQUIRED = 3;
const SCAN_INTERVAL_MS = 1200; // server round-trip needs more time than local
const FRAME_QUALITY = 0.75; // JPEG quality for captured frames

// ── Component ────────────────────────────────────────────────────────────────

export function CardScanner() {
  // ── State machine ─────────────────────────────────────────────────────────
  const [scanState, setScanState] = useState<ScanState>('loading');
  const [statusMessage, setStatusMessage] = useState('Loading...');
  const [candidates, setCandidates] = useState<ScannerMatch[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<ScannerMatch | null>(null);
  const [condition, setCondition] = useState<CardCondition>('near_mint');
  const [sessionCount, setSessionCount] = useState(0);

  // ── Camera ────────────────────────────────────────────────────────────────
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const viewfinderRef = useRef<HTMLDivElement>(null);

  // ── Scanner status ────────────────────────────────────────────────────────
  const { data: scannerStatus } = trpc.scanner.status.useQuery(undefined, {
    refetchInterval: (query) => (query.state.data?.ready ? false : 2000),
    staleTime: 5000,
  });

  const identifyMutation = trpc.scanner.identify.useMutation();

  // ── Debug state ──────────────────────────────────────────────────────────
  const [debugText, setDebugText] = useState('waiting...');

  // ── tRPC utils + add mutation ─────────────────────────────────────────────
  const utils = trpc.useUtils();

  const addMutation = trpc.collection.add.useMutation({
    onSuccess(_data, variables) {
      void utils.collection.stats.invalidate();
      void utils.collection.list.invalidate();
      const addedName = selectedMatch?.name ?? 'card';
      setSessionCount((c) => c + 1);
      toast.success(`Added ${addedName} to collection`);
      setScanState('added');
      setTimeout(() => {
        setScanState('scanning');
        setSelectedMatch(null);
        setCandidates([]);
        setCondition('near_mint');
        setStatusMessage('Detecting...');
      }, 1500);
    },
    onError(err) {
      toast.error(err.message ?? 'Failed to add card');
      setScanState('confirming');
    },
  });

  // ── Camera controls ───────────────────────────────────────────────────────

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

  // Start camera on mount, clean up on unmount
  useEffect(() => {
    void startCamera();
    return () => { stopCamera(); };
  }, [startCamera, stopCamera]);

  // ── Transition from loading -> scanning ───────────────────────────────────
  useEffect(() => {
    const cameraReady = cameraActive || cameraError !== null;
    const serverReady = scannerStatus?.ready === true;

    if (scanState === 'loading' && cameraReady && serverReady) {
      setScanState('scanning');
      setStatusMessage('Detecting...');
    }
  }, [scanState, cameraActive, cameraError, scannerStatus?.ready]);

  // ── Viewfinder crop ───────────────────────────────────────────────────────

  /**
   * Calculate the crop rectangle in video-pixel space for the viewfinder area.
   * Correctly handles CSS `object-cover` which crops the video to fill its container.
   */
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

    // object-cover: video is scaled to fill the container, then cropped
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

  /**
   * Capture the viewfinder region as a base64 JPEG string (no data: prefix).
   */
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

    // Convert to base64 JPEG (strip the data:image/jpeg;base64, prefix)
    const dataUrl = canvas.toDataURL('image/jpeg', FRAME_QUALITY);
    return dataUrl.split(',')[1] ?? null;
  }

  // ── Auto-scan loop ────────────────────────────────────────────────────────

  const scanningRef = useRef(false);
  const scanStateRef = useRef<ScanState>(scanState);
  scanStateRef.current = scanState;

  // Temporal consistency: track consecutive wins by the same card
  const consecutiveWinnerRef = useRef<{ id: string; count: number } | null>(null);

  const runScan = useCallback(async () => {
    if (scanningRef.current) return;
    if (scanStateRef.current !== 'scanning') return;

    const frame = captureFrame();
    if (!frame) {
      setDebugText('BLOCKED: could not capture frame');
      return;
    }

    scanningRef.current = true;

    try {
      const result = await identifyMutation.mutateAsync({ frame });

      // Re-check state after async call
      if (scanStateRef.current !== 'scanning') {
        scanningRef.current = false;
        return;
      }

      const topMatch = result.matches[0];
      const debugLine = topMatch
        ? `#1 ${topMatch.name.slice(0, 25)} (${topMatch.score.toFixed(3)}) | ${result.matches.length} matches`
        : 'No match above threshold';
      setDebugText(debugLine);

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
          setCandidates(result.matches);
          setScanState('detected');
          setStatusMessage(`Match confirmed (${hits} scans)`);
          consecutiveWinnerRef.current = null;
        } else {
          setStatusMessage(
            `Locking on... ${hits}/${CONSECUTIVE_HITS_REQUIRED} (${topMatch.name.slice(0, 25)})`,
          );
        }
      } else {
        consecutiveWinnerRef.current = null;
        setStatusMessage('Detecting...');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setDebugText(`Error: ${msg.slice(0, 60)}`);
    }

    scanningRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    if (scanState === 'loading' || scanState === 'confirming' || scanState === 'added') return;

    const interval = setInterval(() => {
      if (scanStateRef.current === 'scanning' && !scanningRef.current) {
        void runScan();
      }
    }, SCAN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [cameraActive, scanState, runScan]);

  // ── File upload fallback ──────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setScanState('scanning');
      setStatusMessage('Reading card image...');

      try {
        // Convert file to base64
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        );

        const result = await identifyMutation.mutateAsync({ frame: base64 });

        if (result.matches.length === 0) {
          setStatusMessage('No matches found. Try a clearer image.');
          setScanState('scanning');
        } else {
          setCandidates(result.matches);
          setScanState('detected');
          const top = result.matches[0]!;
          setStatusMessage(
            `${result.matches.length} match${result.matches.length > 1 ? 'es' : ''} found — "${top.name}"`,
          );
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

  // ── Candidate selection ───────────────────────────────────────────────────

  function handleSelectCandidate(match: ScannerMatch) {
    setSelectedMatch(match);
    setScanState('confirming');
    setStatusMessage(`Selected: ${match.name}`);
  }

  function handleClearSelection() {
    setSelectedMatch(null);
    if (candidates.length > 0) {
      setScanState('detected');
      setStatusMessage('Tap the correct card');
    } else {
      setScanState('scanning');
      setStatusMessage('Detecting...');
    }
  }

  function handleAdd() {
    if (!selectedMatch) return;
    addMutation.mutate({ cardId: selectedMatch.cardId, condition });
  }

  function handleRescan() {
    setCandidates([]);
    setSelectedMatch(null);
    consecutiveWinnerRef.current = null;
    setScanState('scanning');
    setStatusMessage('Detecting...');
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const showCandidates = scanState === 'detected' || scanState === 'confirming';
  const showConfirm = scanState === 'confirming' && selectedMatch !== null;
  const showAdded = scanState === 'added';
  const isLoading = scanState === 'loading';
  const selectedRarity = selectedMatch
    ? (RARITY_COLORS[selectedMatch.setName as keyof typeof RARITY_COLORS] ?? FALLBACK_RARITY)
    : FALLBACK_RARITY;

  function loadingSubtext(): string {
    if (!cameraActive && !cameraError) return 'Starting camera...';
    if (!scannerStatus) return 'Connecting to scanner service...';
    if (!scannerStatus.ready) {
      const pct = scannerStatus.total > 0
        ? Math.round((scannerStatus.loaded / scannerStatus.total) * 100)
        : 0;
      return `Loading card fingerprints... ${scannerStatus.loaded}/${scannerStatus.total} (${pct}%)`;
    }
    return 'Almost ready...';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-lg mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="lg-page-title">Card Scanner</h1>
        {sessionCount > 0 && (
          <span className="lg-badge bg-rift-950/80 text-rift-400 border border-rift-800/50">
            {sessionCount} added
          </span>
        )}
      </div>

      {/* ── Camera + viewfinder ─────────────────────────────────────────────── */}
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

            {/* Darkened overlay with card-shaped cutout */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute inset-x-0 top-0 bg-black/55"
                style={{ bottom: 'calc(50% + 49%)' }} />
              <div className="absolute inset-x-0 bottom-0 bg-black/55"
                style={{ top: 'calc(50% + 49%)' }} />
              <div className="absolute inset-y-0 left-0 bg-black/55"
                style={{ right: 'calc(50% + 35%)' }} />
              <div className="absolute inset-y-0 right-0 bg-black/55"
                style={{ left: 'calc(50% + 35%)' }} />
            </div>

            {/* Viewfinder border — 5:7 card ratio */}
            <div
              ref={viewfinderRef}
              className="absolute"
              style={{
                left: '15%',
                width: '70%',
                top: '50%',
                transform: 'translateY(-50%)',
                aspectRatio: '5/7',
              }}
              aria-hidden="true"
            >
              <div
                className="absolute inset-0 rounded-xl border-2 border-rift-400/80"
                style={{ animation: 'rift-pulse 2s ease-in-out infinite' }}
              />
              <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-rift-300 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-rift-300 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-rift-300 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-rift-300 rounded-br-xl" />

              {scanState === 'scanning' && (
                <div
                  className="absolute inset-x-0 h-px bg-rift-400/70"
                  style={{ animation: 'scanline 2s linear infinite', top: '50%' }}
                />
              )}
            </div>

            {/* Hint text */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center pointer-events-none" aria-hidden="true">
              <span className="text-xs text-white/70 bg-black/50 rounded-full px-3 py-1 backdrop-blur-sm">
                {scanState === 'detected' ? 'Match found' : 'Hold card within frame'}
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

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div
        className="lg-card px-4 py-3 flex items-center gap-3"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isLoading ? (
          <div className="lg-spinner-sm flex-shrink-0" aria-hidden="true" />
        ) : showAdded ? (
          <IconCheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
        ) : scanState === 'detected' ? (
          <IconTarget className="w-5 h-5 text-rift-400 flex-shrink-0" />
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
        {(scanState === 'detected') && (
          <button
            onClick={handleRescan}
            className="flex-shrink-0 lg-btn-ghost text-xs py-1 px-2"
            aria-label="Scan again"
          >
            Rescan
          </button>
        )}
      </div>

      {/* ── Debug panel ──────────────────────────────────────────────────────── */}
      <div className="lg-card px-3 py-2 bg-zinc-900/80 border border-zinc-800">
        <p className="text-[10px] font-mono text-zinc-500 break-all leading-relaxed">
          {debugText}
        </p>
      </div>

      {/* ── File upload fallback ─────────────────────────────────────────────── */}
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
              disabled={scanState === 'loading'}
            />
          </label>
        </div>
      )}

      {/* ── Match candidates ─────────────────────────────────────────────────── */}
      {showCandidates && candidates.length > 0 && (
        <section aria-label="Match candidates">
          <p className="lg-section-title mb-2">
            {scanState === 'confirming' ? 'Candidates' : 'Select the correct card'}
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {candidates.map((match) => {
              const isSelected = selectedMatch?.cardId === match.cardId;
              const rarity = FALLBACK_RARITY;
              const matchPct = Math.round(match.score * 100);
              return (
                <button
                  key={match.cardId}
                  onClick={() => handleSelectCandidate(match)}
                  className={[
                    'flex-shrink-0 w-28 flex flex-col rounded-xl border overflow-hidden transition-all text-left',
                    isSelected
                      ? 'border-rift-500 shadow-lg shadow-rift-500/20 scale-[1.03]'
                      : `${rarity.border} hover:border-rift-600/60 hover:-translate-y-0.5`,
                    'bg-surface-card',
                  ].join(' ')}
                  aria-pressed={isSelected}
                  aria-label={`Select ${match.name} (${matchPct}% match)`}
                >
                  {match.imageSmall ? (
                    <div className="relative w-full aspect-[2/3] bg-surface-elevated">
                      <Image
                        src={match.imageSmall}
                        alt={match.name}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-[2/3] bg-surface-elevated flex items-center justify-center">
                      <span className="text-xs text-zinc-600 text-center px-1 leading-tight">
                        {match.name}
                      </span>
                    </div>
                  )}
                  <div className="p-1.5">
                    <p className="text-xs font-medium text-white leading-tight line-clamp-2">
                      {match.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{match.setName}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{matchPct}% match</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Confirm panel ────────────────────────────────────────────────────── */}
      {showConfirm && selectedMatch && (
        <div
          className={`lg-card border ${selectedRarity.border} overflow-hidden animate-fade-in-up`}
          role="region"
          aria-label="Confirm card addition"
        >
          <div className="flex gap-4 p-4">
            <div className="flex-shrink-0">
              {selectedMatch.imageSmall ? (
                <div className="relative w-16 h-[88px] rounded-md overflow-hidden border border-surface-border">
                  <Image
                    src={selectedMatch.imageSmall}
                    alt={selectedMatch.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-[88px] rounded-md bg-surface-elevated border border-surface-border flex items-center justify-center">
                  <span className="text-xs text-zinc-600 text-center px-1">
                    {selectedMatch.name}
                  </span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-semibold text-white leading-tight">{selectedMatch.name}</p>
              <p className="text-xs text-zinc-400">{selectedMatch.setName}</p>
              {selectedMatch.number && (
                <p className="lg-text-muted">#{selectedMatch.number}</p>
              )}
            </div>
            <button
              onClick={handleClearSelection}
              className="flex-shrink-0 self-start w-7 h-7 flex items-center justify-center rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-surface-elevated transition-colors"
              aria-label="Change selection"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 pb-3 space-y-2">
            <p className="lg-section-title">Condition</p>
            <div className="flex gap-2 flex-wrap" role="group" aria-label="Select condition">
              {CARD_CONDITIONS.map((cond) => (
                <button
                  key={cond}
                  onClick={() => setCondition(cond)}
                  className={
                    condition === cond
                      ? 'lg-badge border border-rift-600 bg-rift-950/80 text-rift-300 cursor-default px-3 py-1'
                      : 'lg-badge border border-surface-border bg-surface-elevated text-zinc-400 hover:border-rift-700 hover:text-zinc-200 transition-colors px-3 py-1'
                  }
                  aria-pressed={condition === cond}
                >
                  {CONDITION_LABELS[cond]}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4">
            <button
              onClick={handleAdd}
              disabled={addMutation.isPending}
              className="lg-btn-primary w-full flex items-center justify-center gap-2"
            >
              {addMutation.isPending ? (
                <>
                  <div className="lg-spinner-sm" role="status">
                    <span className="sr-only">Adding card...</span>
                  </div>
                  Adding...
                </>
              ) : (
                <>
                  <IconPlus className="w-4 h-4" />
                  Add to Collection
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Added success state ──────────────────────────────────────────────── */}
      {showAdded && (
        <div
          className="lg-card border border-emerald-800/50 bg-emerald-900/10 px-4 py-4 flex items-center gap-3 animate-fade-in-up"
          role="status"
        >
          <IconCheckCircle className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <p className="text-sm text-emerald-300 font-medium">
            Card added -- resuming scan
          </p>
        </div>
      )}

      {/* ── Scanning idle tip ────────────────────────────────────────────────── */}
      {scanState === 'scanning' && candidates.length === 0 && (
        <div className="text-center py-2">
          <p className="lg-text-secondary text-sm">
            {cameraActive
              ? 'Hold a card steady within the frame'
              : cameraError
              ? 'Enable the camera or upload a photo'
              : 'Starting camera...'}
          </p>
        </div>
      )}

    </div>
  );
}

/* ── Scanline keyframe ───────────────────────────────────────────────────── */
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
  `}</style>
);

export { ScanlineStyle };

/* ── Icons ────────────────────────────────────────────────────────────────── */

function IconX({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M10 4v12M4 10h12" />
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

function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
