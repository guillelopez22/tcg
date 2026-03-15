'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import {
  MAX_COPIES_PER_CARD,
  MAX_SIGNATURE_COPIES,
  MAIN_DECK_SIZE,
  RUNE_DECK_SIZE,
  BATTLEFIELD_COUNT,
  SIDEBOARD_SIZE,
  type DeckZone,
} from '@la-grieta/shared';
import type {
  Step,
  BuildMethod,
  ImportTab,
  BrowserTab,
  DeckEntry,
  LegendCard,
  CardItem,
} from './wizard-types';
import {
  parseDomains,
  isSignatureCard,
  autoBuildEntries,
} from './wizard-helpers';

interface UseDeckWizardOptions {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function useDeckWizard({ isOpen, onClose, onCreated }: UseDeckWizardOptions) {
  const router = useRouter();

  // — Step state —
  const [step, setStep] = useState<Step>('name');
  const [deckName, setDeckName] = useState('');
  const [legendSearch, setLegendSearch] = useState('');
  const [legendDomainFilter, setLegendDomainFilter] = useState('all');
  const [selectedLegend, setSelectedLegend] = useState<LegendCard | null>(null);
  const [entries, setEntries] = useState<DeckEntry[]>([]);
  const [browserTab, setBrowserTab] = useState<BrowserTab>('main');
  const [nameError, setNameError] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Method step state
  const [buildMethod, setBuildMethod] = useState<BuildMethod | null>(null);

  // Import inline state
  const [importTab, setImportTab] = useState<ImportTab>('text');
  const [importText, setImportText] = useState('');
  const [importName, setImportName] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [importCode, setImportCode] = useState('');
  const [importError, setImportError] = useState('');

  // Auto-build state
  const [isAutoBuilding, setIsAutoBuilding] = useState(false);

  // — tRPC queries —
  const { data: legendsData, isLoading: legendsLoading } = trpc.card.legends.useQuery(
    undefined,
    { staleTime: Infinity, enabled: isOpen },
  );

  const legendDomains = useMemo(() => parseDomains(selectedLegend?.domain ?? null), [selectedLegend]);

  const autoBuildQ1 = trpc.card.list.useQuery(
    { domain: legendDomains[0] || undefined, limit: 100 },
    { staleTime: 60_000, enabled: isOpen && buildMethod === 'auto' && !!legendDomains[0] },
  );

  const autoBuildQ2 = trpc.card.list.useQuery(
    { domain: legendDomains[1] || undefined, limit: 100 },
    { staleTime: 60_000, enabled: isOpen && buildMethod === 'auto' && !!legendDomains[1] },
  );

  const autoBuildBfQ = trpc.card.list.useQuery(
    { cardType: 'Battlefield', limit: 50 },
    { staleTime: 60_000, enabled: isOpen && buildMethod === 'auto' },
  );

  // — tRPC mutations —
  const importFromTextMutation = trpc.deck.importFromText.useMutation({
    onSuccess(result) {
      if (result.resolved.length === 0) {
        setImportError('No cards could be matched from the pasted text.');
        return;
      }
      applyImportResult(result.resolved, result.deckName);
    },
    onError(err) {
      setImportError(err.message || 'Import failed. Please check your deck list.');
    },
  });

  const importFromUrlMutation = trpc.deck.importFromUrl.useMutation({
    onSuccess(result) {
      if (result.resolved.length === 0) {
        setImportError('No cards could be matched from that URL.');
        return;
      }
      applyImportResult(result.resolved, result.deckName);
    },
    onError(err) {
      setImportError(err.message || 'Failed to fetch deck from URL.');
    },
  });

  const utils = trpc.useUtils();

  const createDeck = trpc.deck.create.useMutation({
    onSuccess: (deck) => {
      toast.success(`"${deck.name}" created!`);
      onCreated();
      handleClose();
      router.push(`/decks/${deck.id}`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create deck');
    },
  });

  // — Effects —

  useEffect(() => {
    if (isOpen && step === 'name') {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [isOpen, step]);

  // Auto-build: when queries are ready run the algorithm
  useEffect(() => {
    if (!isAutoBuilding) return;
    if (!selectedLegend) return;

    const q1Done = autoBuildQ1.isSuccess;
    const q2Done = !legendDomains[1] || autoBuildQ2.isSuccess;
    const bfDone = autoBuildBfQ.isSuccess;

    if (!q1Done || !q2Done || !bfDone) return;

    const allDomainCards = [
      ...(autoBuildQ1.data?.items ?? []),
      ...(autoBuildQ2.data?.items ?? []),
      ...(autoBuildBfQ.data?.items ?? []),
    ];

    const seen = new Set<string>();
    const deduped: CardItem[] = [];
    for (const c of allDomainCards) {
      if (!seen.has(c.id)) { seen.add(c.id); deduped.push(c); }
    }

    const legendEntry: DeckEntry = {
      card: selectedLegend as unknown as CardItem,
      quantity: 1,
      zone: 'legend',
    };

    const built = autoBuildEntries(selectedLegend, deduped);
    setEntries([legendEntry, ...built]);
    setIsAutoBuilding(false);
    setStep('review');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoBuilding, autoBuildQ1.isSuccess, autoBuildQ2.isSuccess, autoBuildBfQ.isSuccess, autoBuildQ1.data, autoBuildQ2.data, autoBuildBfQ.data, selectedLegend, legendDomains]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // — Reset —
  const handleClose = useCallback(() => {
    setStep('name');
    setDeckName('');
    setLegendSearch('');
    setLegendDomainFilter('all');
    setSelectedLegend(null);
    setEntries([]);
    setBrowserTab('main');
    setNameError('');
    setBuildMethod(null);
    setImportTab('text');
    setImportText('');
    setImportName('');
    setImportUrl('');
    setImportCode('');
    setImportError('');
    setIsAutoBuilding(false);
    onClose();
  }, [onClose]);

  // — Derived data —
  const filteredLegends = useMemo(() => {
    const all = legendsData ?? [];
    return all.filter((l) => {
      const matchesSearch = !legendSearch || l.name.toLowerCase().includes(legendSearch.toLowerCase());
      const matchesDomain = legendDomainFilter === 'all' || (l.domain ?? '').includes(legendDomainFilter);
      return matchesSearch && matchesDomain;
    });
  }, [legendsData, legendSearch, legendDomainFilter]);

  const legendEntry = entries.find((e) => e.zone === 'legend');
  const championEntry = entries.find((e) => e.zone === 'champion');
  const mainEntries = entries.filter((e) => e.zone === 'main');
  const runeEntries = entries.filter((e) => e.zone === 'rune');
  const battlefieldEntries = entries.filter((e) => e.zone === 'battlefield');
  const sideboardEntries = entries.filter((e) => e.zone === 'sideboard');

  const mainCount = mainEntries.reduce((s, e) => s + e.quantity, 0);
  const runeCount = runeEntries.reduce((s, e) => s + e.quantity, 0);
  const battlefieldCount = battlefieldEntries.length;
  const sideboardCount = sideboardEntries.reduce((s, e) => s + e.quantity, 0);

  const validation = useMemo(() => {
    const hasChampion = !!championEntry;
    const mainOk = mainCount === MAIN_DECK_SIZE && hasChampion;
    const runeOk = runeCount === RUNE_DECK_SIZE;
    const bfOk = battlefieldCount === BATTLEFIELD_COUNT;
    const sideboardOk = sideboardCount <= SIDEBOARD_SIZE;
    const legendDomain = legendEntry?.card.domain ?? null;
    const signaturesOk = entries
      .filter((e) => isSignatureCard(e.card.cardType))
      .every((e) => e.card.domain === legendDomain);
    return {
      mainOk,
      runeOk,
      bfOk,
      sideboardOk,
      hasChampion,
      isValid: mainOk && runeOk && bfOk && sideboardOk && signaturesOk,
    };
  }, [mainCount, runeCount, battlefieldCount, sideboardCount, championEntry, entries, legendEntry]);

  // — Entry mutation helpers —
  const addCard = useCallback((card: CardItem) => {
    setEntries((prev) => {
      if (isSignatureCard(card.cardType)) {
        const legend = prev.find((e) => e.zone === 'legend');
        if (!legend || card.domain !== legend.card.domain) return prev;
      }

      let zone: DeckZone = browserTab === 'sideboard' ? 'sideboard' : 'main';
      if (card.cardType === 'Rune') zone = 'rune';
      else if (card.cardType === 'Battlefield') zone = 'battlefield';
      else if (card.cardType === 'Champion Unit') {
        const hasChampion = prev.some((e) => e.zone === 'champion');
        zone = hasChampion ? zone : 'champion';
      }

      if (zone === 'champion') {
        const existing = prev.find((e) => e.zone === 'champion');
        if (existing) return prev;
        return [...prev, { card, quantity: 1, zone }];
      }

      if (zone === 'battlefield') {
        const alreadyHave = prev.some((e) => e.zone === 'battlefield' && e.card.name === card.name);
        if (alreadyHave || prev.filter((e) => e.zone === 'battlefield').length >= BATTLEFIELD_COUNT) return prev;
        return [...prev, { card, quantity: 1, zone }];
      }

      if (zone === 'rune') {
        const currentRuneTotal = prev.filter((e) => e.zone === 'rune').reduce((s, e) => s + e.quantity, 0);
        if (currentRuneTotal >= RUNE_DECK_SIZE) return prev;
        const existing = prev.find((e) => e.card.id === card.id && e.zone === 'rune');
        if (existing) {
          return prev.map((e) => e.card.id === card.id && e.zone === 'rune' ? { ...e, quantity: e.quantity + 1 } : e);
        }
        return [...prev, { card, quantity: 1, zone }];
      }

      if (zone === 'sideboard') {
        const currentSideboardTotal = prev.filter((e) => e.zone === 'sideboard').reduce((s, e) => s + e.quantity, 0);
        if (currentSideboardTotal >= SIDEBOARD_SIZE) return prev;
      } else {
        const currentMainTotal = prev.filter((e) => e.zone === 'main').reduce((s, e) => s + e.quantity, 0);
        if (currentMainTotal >= MAIN_DECK_SIZE) return prev;
      }

      const totalCopies = prev
        .filter((e) => e.card.id === card.id && (e.zone === 'main' || e.zone === 'sideboard'))
        .reduce((s, e) => s + e.quantity, 0);
      if (totalCopies >= MAX_COPIES_PER_CARD) return prev;

      const existing = prev.find((e) => e.card.id === card.id && e.zone === zone);
      if (existing) {
        return prev.map((e) => e.card.id === card.id && e.zone === zone ? { ...e, quantity: e.quantity + 1 } : e);
      }
      return [...prev, { card, quantity: 1, zone }];
    });
  }, [browserTab]);

  const removeCard = useCallback((cardId: string) => {
    setEntries((prev) => {
      const existing = prev.find((e) => e.card.id === cardId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((e) => e.card.id !== cardId);
      return prev.map((e) => e.card.id === cardId ? { ...e, quantity: e.quantity - 1 } : e);
    });
  }, []);

  const removeCardFully = useCallback((cardId: string) => {
    setEntries((prev) => prev.filter((e) => e.card.id !== cardId));
  }, []);

  // — Import result application —
  function applyImportResult(
    resolved: Array<{ cardId: string; quantity: number; zone: string; name?: string; imageSmall?: string | null }>,
    importedDeckName: string,
  ) {
    const newEntries: DeckEntry[] = resolved.map((r) => ({
      card: {
        id: r.cardId,
        name: r.name ?? r.cardId,
        imageSmall: r.imageSmall ?? null,
        externalId: '',
        number: '',
        code: '',
        cleanName: r.name ?? '',
        setId: '',
        rarity: '',
        cardType: null,
        domain: null,
        energyCost: null,
        powerCost: null,
        might: null,
        description: null,
        flavorText: null,
        imageLarge: null,
        tcgplayerId: null,
        tcgplayerUrl: null,
        set: { id: '', name: '', slug: '', releaseDate: null },
      } as unknown as CardItem,
      quantity: r.quantity,
      zone: (r.zone as DeckZone) ?? 'main',
    }));

    if (!deckName.trim() || deckName === importedDeckName) {
      setDeckName(importedDeckName);
    }

    setEntries(newEntries);
    setStep('review');
  }

  // — Step navigation —
  const goNext = () => {
    if (step === 'name') {
      const trimmed = deckName.trim();
      if (!trimmed) { setNameError('Please enter a deck name'); return; }
      if (trimmed.length > 80) { setNameError('Name must be 80 characters or fewer'); return; }
      setNameError('');
      setStep('legend');
    } else if (step === 'legend') {
      if (!selectedLegend) return;
      setEntries((prev) => {
        const hasLegend = prev.some((e) => e.zone === 'legend');
        if (hasLegend) return prev;
        return [...prev, { card: selectedLegend as unknown as CardItem, quantity: 1, zone: 'legend' }];
      });
      setStep('method');
    } else if (step === 'build') {
      setStep('review');
    }
  };

  const goBack = () => {
    if (step === 'legend') setStep('name');
    else if (step === 'method') {
      setBuildMethod(null);
      setImportError('');
      setStep('legend');
    }
    else if (step === 'build') setStep('method');
    else if (step === 'review') {
      if (buildMethod === 'manual') setStep('build');
      else setStep('method');
    }
  };

  const handlePickManual = () => {
    setBuildMethod('manual');
    setStep('build');
  };

  const handlePickImport = () => {
    setBuildMethod('import');
  };

  const handlePickAuto = () => {
    setBuildMethod('auto');
    setIsAutoBuilding(true);
  };

  const handleSubmitImport = () => {
    setImportError('');
    if (importTab === 'text') {
      if (!importText.trim()) { setImportError('Please paste a deck list.'); return; }
      importFromTextMutation.mutate({ text: importText, name: importName || deckName || undefined });
    } else if (importTab === 'url') {
      if (!importUrl.trim()) { setImportError('Please enter a URL.'); return; }
      importFromUrlMutation.mutate({ url: importUrl, name: importName || deckName || undefined });
    } else {
      if (!importCode.trim()) { setImportError('Please enter a share code.'); return; }
      void utils.deck.resolveShareCode.fetch({ code: importCode.trim() }).then((deck) => {
        const resolved = deck.cards.map((c) => ({
          cardId: c.card.id,
          quantity: c.quantity,
          zone: c.zone,
          name: c.card.name,
          imageSmall: c.card.imageSmall,
        }));
        applyImportResult(resolved, `Copy of ${deck.name}`);
      }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Share code not found.';
        setImportError(message);
      });
    }
  };

  const handleCreate = () => {
    if (!selectedLegend) return;
    const cards = entries.map((e) => ({
      cardId: e.card.id,
      quantity: e.quantity,
      zone: e.zone,
    }));
    createDeck.mutate({
      name: deckName.trim(),
      isPublic: false,
      coverCardId: selectedLegend.id,
      cards,
    });
  };

  // — Layout flags —
  const canGoNext =
    (step === 'name' && deckName.trim().length > 0) ||
    (step === 'legend' && !!selectedLegend) ||
    (step === 'build');

  const showFooter = step !== 'method' || (buildMethod === 'import');
  const footerOnlyBack = step === 'method' && buildMethod === 'import';

  const isTallStep = step === 'legend' || step === 'build' || step === 'review' ||
    (step === 'method' && buildMethod === 'import');

  return {
    // step state
    step,
    deckName,
    setDeckName,
    nameError,
    setNameError,
    nameInputRef,
    // legend
    legendSearch,
    setLegendSearch,
    legendDomainFilter,
    setLegendDomainFilter,
    selectedLegend,
    setSelectedLegend,
    filteredLegends,
    legendsLoading,
    legendDomains,
    legendEntry,
    // method
    buildMethod,
    setBuildMethod,
    isAutoBuilding,
    // import
    importTab,
    setImportTab,
    importText,
    setImportText,
    importName,
    setImportName,
    importUrl,
    setImportUrl,
    importCode,
    setImportCode,
    importError,
    setImportError,
    importFromTextMutation,
    importFromUrlMutation,
    // build
    entries,
    browserTab,
    setBrowserTab,
    championEntry,
    mainEntries,
    runeEntries,
    battlefieldEntries,
    sideboardEntries,
    mainCount,
    runeCount,
    battlefieldCount,
    sideboardCount,
    validation,
    // entry mutation
    addCard,
    removeCard,
    removeCardFully,
    // navigation
    goNext,
    goBack,
    handlePickManual,
    handlePickImport,
    handlePickAuto,
    handleSubmitImport,
    handleCreate,
    handleClose,
    // layout
    canGoNext,
    showFooter,
    footerOnlyBack,
    isTallStep,
    // mutation state
    isCreating: createDeck.isPending,
  };
}
