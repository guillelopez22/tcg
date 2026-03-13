---
phase: 3
slug: points-tracker
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-12
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.0 |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @la-grieta/api test -- match` |
| **Full suite command** | `pnpm --filter @la-grieta/api test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @la-grieta/api test -- match`
- **After every plan wave:** Run `pnpm --filter @la-grieta/api test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | PTS-01 | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | PTS-02 | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | PTS-03 | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ W0 | ⬜ pending |
| 03-01-04 | 01 | 1 | PTS-04 | unit | `pnpm --filter @la-grieta/api test -- match-scoring` | ❌ W0 | ⬜ pending |
| 03-01-05 | 01 | 1 | PTS-05 | unit | `pnpm --filter @la-grieta/api test -- match-scoring` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | PTS-06 | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | PTS-07 | manual | n/a — Socket.IO test client | manual | ⬜ pending |
| 03-03-01 | 03 | 2 | PTS-08 | unit | `pnpm --filter @la-grieta/api test -- match.service` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 2 | PLAT-02 | unit | `pnpm --filter @la-grieta/api test -- news.service` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/__tests__/match.service.spec.ts` — stubs for PTS-01 through PTS-06, PTS-08
- [ ] `apps/api/__tests__/match-scoring.spec.ts` — stubs for PTS-04, PTS-05 (pure function tests)
- [ ] `apps/api/__tests__/news.service.spec.ts` — stubs for PLAT-02

*Existing infrastructure covers test framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time WebSocket broadcast between two clients | PTS-07 | Requires live Socket.IO server + two connected clients | 1. Open match on device A, 2. Join via QR on device B, 3. Tap battlefield on A, 4. Verify B updates within 1s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
