# Manual E2E Test Report — La Grieta

**Date:** 2026-03-10
**Environment:** Local development
**API:** http://localhost:3001/api | **Web:** http://localhost:3000
**Database:** PostgreSQL (675 cards, 3 sets seeded) | **Redis:** localhost:6379

---

## 1. Health & Infrastructure

| Test | Result | Details |
|------|--------|---------|
| `GET /api/health` | PASS | `{"status":"ok","database":"ok","redis":"ok"}` |

---

## 2. Card Browsing (Public, no auth)

| Test | Result | Details |
|------|--------|---------|
| `card.sets` | PASS | Returns 3 sets: Origins (360), Origins: Proving Grounds (24), Spiritforged (315) |
| `card.list` (limit 5) | PASS | Returns 5 cards with `nextCursor` for pagination |
| `card.list` (setSlug: origins) | PASS | Returns only Origins cards |
| `card.list` (rarity: Rare) | PASS | Returns only Rare cards |
| `card.list` (search: Jinx) | PASS | Returns 5 Jinx cards (Loose Cannon, Demolitionist, Rebel, alt arts) |
| `card.getById` | PASS | Returns full card detail with nested `set` object |
| Pagination (cursor) | PASS | Page 2 returns different cards (Warwick, Fiora, etc.) |
| `card.byId` (wrong name) | FAIL (expected) | Procedure not found — correct name is `card.getById` |

**Note:** The test plan referenced `card.byId` but the actual procedure is `card.getById`.

---

## 3. Authentication Flow

| Test | Result | Details |
|------|--------|---------|
| `auth.register` | PASS | Created user `testuser` / `test@lagrieta.com`, returned tokens |
| `auth.login` | PASS | Login successful, returned new accessToken + refreshToken |
| `auth.me` | PASS | Returns full user profile (id, email, username, role, etc.) |
| `auth.refresh` | PASS | Returns new accessToken + refreshToken pair |
| `auth.logout` | PASS | Returns empty success result |
| Token revocation after logout | PASS | `auth.me` returns `UNAUTHORIZED` with "Token has been revoked" |

**Note:** tRPC mutations accept raw JSON body (not wrapped in `{"json":{...}}`). The `{"json":{...}}` wrapper from the test plan does not work — the body is parsed directly.

---

## 4. Collection Management (Authenticated)

| Test | Result | Details |
|------|--------|---------|
| `collection.add` | PASS | Added Jinx - Loose Cannon (qty 2, near_mint) |
| `collection.list` | PASS | Returns entry with nested `card` and `set` data |
| `collection.update` | PASS | Updated quantity from 2 to 4 |
| `collection.stats` | PASS | Shows totalCards: 4, uniqueCards: 1, per-set completion stats |
| `collection.remove` | PASS | Returns empty success |
| Collection empty after removal | PASS | `collection.list` returns `{"items":[]}` |

---

## 5. Deck Management (Authenticated)

| Test | Result | Details |
|------|--------|---------|
| `deck.create` | PASS | Created "Test Deck" with empty cards array |
| `deck.list` | PASS | Returns deck in list |
| `deck.setCards` | PASS | Added 2 cards (Jinx qty 2, Mushroom Pouch qty 3), returns deck with card details |
| `deck.getById` (private deck) | FAIL | Returns `FORBIDDEN: "This deck is private"` — owner cannot view own private deck |
| `deck.update` | PASS | Renamed to "Renamed Deck", set isPublic: true |
| `deck.getById` (public deck) | PASS | Returns deck with 2 cards after making public |
| `deck.delete` | PASS | Returns empty success |

**Bug found:** `deck.getById` returns FORBIDDEN for the deck owner when `isPublic` is false. The owner should always be able to view their own decks regardless of privacy setting.

---

## 6. User Profile (Authenticated)

| Test | Result | Details |
|------|--------|---------|
| `user.getProfile` (no input) | FAIL (expected) | Requires input object with `username` field |
| `user.getProfile` (with username) | PASS | Returns full profile with all fields |
| `user.updateProfile` | PASS | Updated displayName and bio successfully |

**Note:** `user.getProfile` requires `{username: "..."}` input — it's not a "get my profile" endpoint; it's a public profile lookup. The `auth.me` endpoint serves as the "get my profile" function.

---

## 7. Web App Smoke Test

| Test | Result | Details |
|------|--------|---------|
| `GET /` (homepage) | PASS | HTTP 200, contains "Riftbound" |
| `GET /cards` | PASS | HTTP 200 |
| `GET /login` | PASS | HTTP 200 |
| `GET /register` | PASS | HTTP 200 |

---

## 8. Error Handling

| Test | Result | Details |
|------|--------|---------|
| Protected endpoint without auth | PASS | Returns `UNAUTHORIZED` (401) |
| Duplicate email registration | PASS | Returns `CONFLICT` with "Email already in use" |
| Empty password | PASS | Returns `BAD_REQUEST` (Zod validation) |
| Missing required fields | PASS | Returns `BAD_REQUEST` (Zod validation: username, password Required) |

---

## Summary

| Category | Passed | Failed | Notes |
|----------|--------|--------|-------|
| Health & Infrastructure | 1 | 0 | |
| Card Browsing | 7 | 0 | `card.byId` is actually `card.getById` |
| Authentication | 6 | 0 | |
| Collection Management | 6 | 0 | |
| Deck Management | 5 | 1 | Owner cannot view own private deck via `deck.getById` |
| User Profile | 2 | 0 | `getProfile` requires username input |
| Web App | 4 | 0 | |
| Error Handling | 4 | 0 | |
| **Total** | **35** | **1** | |

---

## Bugs / Issues Found

### BUG-001: Owner cannot view own private deck via `deck.getById`
- **Severity:** Medium
- **Steps:** Create a deck (defaults to isPublic: false) -> call `deck.getById` with the deck ID and the owner's auth token
- **Expected:** Owner can view their own deck regardless of isPublic flag
- **Actual:** Returns FORBIDDEN: "This deck is private"
- **Workaround:** Set `isPublic: true` via `deck.update` first, or use `deck.list` which always returns user's own decks

### NOTE-001: tRPC mutation body format
- The test plan suggested `{"json":{...}}` wrapper for POST mutations. The actual API accepts raw JSON body without wrapping. This is a documentation/knowledge issue, not a bug.

### NOTE-002: Procedure naming inconsistency
- `card.getById` exists but `card.byId` and `deck.byId` do not. The convention uses `getById` prefix. Test plan should be updated.
