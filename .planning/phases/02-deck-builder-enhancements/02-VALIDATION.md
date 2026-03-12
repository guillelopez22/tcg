---
phase: 2
slug: deck-builder-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && pnpm vitest run --reporter=dot` |
| **Full suite command** | `cd apps/api && pnpm vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && pnpm vitest run --reporter=dot`
- **After every plan wave:** Run `cd apps/api && pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | DECK-03 | unit | `pnpm vitest run __tests__/draw-hand.spec.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | DECK-07 | unit | `pnpm vitest run __tests__/deck-import-parser.spec.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | DECK-03 | unit | `pnpm vitest run __tests__/draw-hand.spec.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | DECK-05 | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | ✅ extend | ⬜ pending |
| 02-02-02 | 02 | 1 | DECK-06 | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | ✅ extend | ⬜ pending |
| 02-03-01 | 03 | 1 | DECK-07 | unit | `pnpm vitest run __tests__/deck-import-parser.spec.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | DECK-08 | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | ✅ extend | ⬜ pending |
| 02-04-02 | 04 | 2 | DECK-09 | manual | View /decks Trending tab | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/__tests__/draw-hand.spec.ts` — stubs for DECK-03 hand draw unit tests
- [ ] `apps/api/__tests__/deck-import-parser.spec.ts` — stubs for DECK-07 parser unit tests
- [ ] `packages/db/src/schema/deck-share-codes.ts` — new schema file for share code table
- [ ] Migration script for `deck_share_codes` table

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trending tab shows [RD] prefix decks | DECK-09 | UI visual verification | Navigate to /decks, select Trending tab, verify tournament decks appear |
| Card images display in draw hand | DECK-03 | Visual rendering | Click "Draw Hand" in deck editor, verify 4 card images render horizontally |
| Share code copy-to-clipboard | DECK-05 | Browser clipboard API | Click Share on public deck, verify toast and clipboard content |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
