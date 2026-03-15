'use client';

interface EditorToolbarProps {
  isPublic: boolean | undefined;
  isGeneratingShareCode: boolean;
  isSaving: boolean;
  onGenerateShareCode: () => void;
  onCancel: () => void;
  onSave: () => void;
}

export function EditorToolbar({
  isPublic,
  isGeneratingShareCode,
  isSaving,
  onGenerateShareCode,
  onCancel,
  onSave,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <div className="flex items-center gap-2">
        {isPublic && (
          <button
            onClick={onGenerateShareCode}
            disabled={isGeneratingShareCode}
            className="lg-btn-secondary disabled:opacity-50 inline-flex items-center gap-1.5"
            aria-label="Generate and copy share code"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 2h4v4M14 2l-7 7M6 4H3a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-3" />
            </svg>
            {isGeneratingShareCode ? 'Copying...' : 'Share'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="lg-btn-ghost"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="lg-btn-primary flex items-center gap-2"
        >
          {isSaving && (
            <div role="status" className="lg-spinner-sm">
              <span className="sr-only">Saving</span>
            </div>
          )}
          {isSaving ? 'Saving...' : 'Save Deck'}
        </button>
      </div>
    </div>
  );
}
