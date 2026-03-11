---
phase: 1
slug: collection-tracker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @la-grieta/api test -- --reporter=verbose collection` |
| **Full suite command** | `pnpm --filter @la-grieta/api test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @la-grieta/api test -- --reporter=dot`
- **After every plan wave:** Run `pnpm --filter @la-grieta/api test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | COLL-01 | unit | `pnpm --filter @la-grieta/api test -- collection.service` | needs update | ⬜ pending |
| 01-01-02 | 01 | 1 | COLL-03 | unit | `pnpm --filter @la-grieta/api test -- collection.service` | needs update | ⬜ pending |
| 01-01-03 | 01 | 1 | COLL-04 | unit | `pnpm --filter @la-grieta/api test -- collection.service` | already tested | ⬜ pending |
| 01-01-04 | 01 | 1 | COLL-05 | unit | `pnpm --filter @la-grieta/api test -- collection.service` | needs update | ⬜ pending |
| 01-02-01 | 02 | 1 | COLL-02 | unit | `pnpm --filter @la-grieta/api test -- scanner.service` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | COLL-06 | unit | `pnpm --filter @la-grieta/api test -- collection.service` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | COLL-07 | unit | `pnpm --filter @la-grieta/api test -- wishlist.service` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 2 | COLL-08 | unit | `pnpm --filter @la-grieta/api test -- wishlist.service` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 2 | COLL-09 | unit | `pnpm --filter @la-grieta/api test -- collection.service` | needs update | ⬜ pending |
| 01-05-02 | 05 | 2 | COLL-10 | unit | `pnpm --filter @la-grieta/api test -- deck-recommendations.service` | ❌ W0 | ⬜ pending |
| 01-06-01 | 06 | 1 | PLAT-01 | smoke | manual-only (UI) | ❌ W0 config | ⬜ pending |
| 01-06-02 | 06 | 1 | PLAT-03 | smoke | manual-only (camera) | existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/__tests__/scanner.service.spec.ts` — stubs for COLL-02 scanner identify
- [ ] `apps/api/__tests__/wishlist.service.spec.ts` — stubs for COLL-07, COLL-08
- [ ] `apps/api/__tests__/deck-recommendations.service.spec.ts` — stubs for COLL-10
- [ ] Update `apps/api/__tests__/collection.service.spec.ts` — remove `quantity` field, add `variant` field; update add() tests to assert single insert (no upsert)
- [ ] next-intl package install + `apps/web/src/i18n.ts` config + `apps/web/messages/en.json` scaffold

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| i18n t() returns correct EN/ES string | PLAT-01 | UI rendering required | Switch locale in browser, verify collection labels in both EN and ES |
| Camera getUserMedia with facingMode:environment | PLAT-03 | Hardware camera required | Open scanner on mobile device, verify rear camera activates; deny permission, verify file fallback |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
