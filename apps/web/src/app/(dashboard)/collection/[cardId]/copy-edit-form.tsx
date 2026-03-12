'use client';

// Inline form for editing a single collection copy.
// Fields: variant, condition, purchase price, notes, photo.
// "Remove this copy" button is RED with confirmation dialog per user decision.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { CARD_VARIANTS, CARD_CONDITIONS } from '@la-grieta/shared';

// NOTE: All 4 variants shown for all cards — variant validation per card is deferred.
// When card-specific variant data becomes available, this should filter to allowed variants.

const CONDITION_LABELS: Record<string, string> = {
  near_mint: 'NM — Near Mint',
  lightly_played: 'LP — Lightly Played',
  moderately_played: 'MP — Moderately Played',
  heavily_played: 'HP — Heavily Played',
  damaged: 'Damaged',
};

const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  alt_art: 'Alt Art',
  overnumbered: 'Overnumbered',
  signature: 'Signature',
};

interface Copy {
  id: string;
  variant: string;
  condition: string;
  purchasePrice: string | null;
  notes: string | null;
  photoUrl: string | null;
  photoKey: string | null;
}

interface CopyEditFormProps {
  copy: Copy;
  onSaved: () => void;
  onRemoved: () => void;
}

export function CopyEditForm({ copy, onSaved, onRemoved }: CopyEditFormProps) {
  const t = useTranslations('collection');
  const tCommon = useTranslations('common');

  const [variant, setVariant] = useState(copy.variant);
  const [condition, setCondition] = useState(copy.condition);
  const [purchasePrice, setPurchasePrice] = useState(copy.purchasePrice ?? '');
  const [notes, setNotes] = useState(copy.notes ?? '');
  const [photoUrl, setPhotoUrl] = useState(copy.photoUrl ?? '');
  const [photoKey, setPhotoKey] = useState(copy.photoKey ?? '');

  const utils = trpc.useUtils();

  const update = trpc.collection.update.useMutation({
    onSuccess() {
      void utils.collection.getByCard.invalidate();
      void utils.collection.list.invalidate();
      toast.success('Copy updated');
      onSaved();
    },
    onError(err) {
      toast.error(err.message ?? tCommon('error'));
    },
  });

  const remove = trpc.collection.remove.useMutation({
    onSuccess() {
      void utils.collection.getByCard.invalidate();
      void utils.collection.list.invalidate();
      void utils.collection.stats.invalidate();
      toast.success('Copy removed from collection');
      onRemoved();
    },
    onError(err) {
      toast.error(err.message ?? tCommon('error'));
    },
  });

  const handleSave = () => {
    // Only send changed fields
    update.mutate({
      id: copy.id,
      variant: variant as typeof CARD_VARIANTS[number],
      condition: condition as typeof CARD_CONDITIONS[number],
      purchasePrice: purchasePrice.trim() || undefined,
      notes: notes.trim() || undefined,
      photoUrl: photoUrl || undefined,
      photoKey: photoKey || undefined,
    });
  };

  const handleRemove = () => {
    if (confirm(t('removeConfirm'))) {
      remove.mutate({ id: copy.id });
    }
  };

  const handlePhotoUpload = (url: string, key: string) => {
    setPhotoUrl(url);
    setPhotoKey(key);
  };

  return (
    <div className="space-y-4 px-4 py-4 bg-surface-elevated rounded-xl border border-surface-border">
      {/* Variant */}
      <div className="lg-field">
        <label className="lg-label" htmlFor={`variant-${copy.id}`}>{t('variant')}</label>
        <select
          id={`variant-${copy.id}`}
          value={variant}
          onChange={(e) => setVariant(e.target.value)}
          className="lg-select"
        >
          {CARD_VARIANTS.map((v) => (
            <option key={v} value={v}>{VARIANT_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {/* Condition */}
      <div className="lg-field">
        <label className="lg-label" htmlFor={`condition-${copy.id}`}>{t('condition')}</label>
        <select
          id={`condition-${copy.id}`}
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          className="lg-select"
        >
          {CARD_CONDITIONS.map((c) => (
            <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
          ))}
        </select>
      </div>

      {/* Purchase price */}
      <div className="lg-field">
        <label className="lg-label" htmlFor={`price-${copy.id}`}>{t('purchasePrice')}</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">$</span>
          <input
            id={`price-${copy.id}`}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className="lg-input pl-6"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="lg-field">
        <label className="lg-label" htmlFor={`notes-${copy.id}`}>{t('notes')}</label>
        <textarea
          id={`notes-${copy.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes about this copy..."
          rows={2}
          maxLength={500}
          className="lg-input resize-none"
        />
        <span className="lg-hint">{notes.length}/500</span>
      </div>

      {/* Photo upload */}
      <div className="lg-field">
        <span className="lg-label">{t('photo')}</span>
        <PhotoUpload
          purpose="copy"
          currentPhotoUrl={photoUrl || null}
          onUploadComplete={handlePhotoUpload}
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={update.isPending}
        className="lg-btn-primary w-full text-center"
      >
        {update.isPending ? tCommon('loading') : tCommon('save')}
      </button>

      {/* Remove copy — RED per user decision, confirmation required */}
      <button
        onClick={handleRemove}
        disabled={remove.isPending}
        className="w-full text-center py-2.5 px-5 rounded-lg text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed text-red-400 border border-red-800 hover:bg-red-900/20"
      >
        {remove.isPending ? tCommon('loading') : t('removeCopy')}
      </button>
    </div>
  );
}
