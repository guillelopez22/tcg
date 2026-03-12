# Phase 2: Deck Builder Enhancements - Research

**Researched:** 2026-03-12
**Domain:** Riftbound TCG deck sharing, external format import, community browsing, hand simulation policy
**Confidence:** MEDIUM (HIGH for codebase analysis, MEDIUM for policy, LOW for external format specs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Hand Simulation (DECK-03) — CONDITIONAL**
- Policy gate: Claude must research Riftbound's official stance on hand/draw simulators before implementing. If Riftbound prohibits simulators, DECK-03 is skipped entirely — no feature-flagged build, no hidden implementation.
- If allowed: "Draw Hand" button plus "Mulligan" button that reshuffles and draws again
- Hand size: Claude researches Riftbound's official opening hand size (do not assume 7)
- Display: horizontal card row (not fan spread)
- No probability stats — just show the drawn cards, keep it simple
- Players draw multiple times to get a feel for consistency

**Share Codes (DECK-05, DECK-06)**
- Server-stored short codes: generate an alphanumeric code (e.g., "LG-a3Xk9m") mapped to a server-side deck snapshot
- Only public decks can generate share codes — private decks cannot be shared via code
- Importing a share code shows a read-only preview first (cards, analytics, buildability %) with explicit "Import to My Decks" button
- Share button appears on both deck detail page and editor toolbar
- Copy-to-clipboard with toast confirmation on share

**External Format Import (DECK-07)**
- Support both text paste and URL fetch
- Auto-detect format: Riftbound.gg list vs Piltover Archive format
- Partial import allowed: import all recognized cards, show warning listing unmatched card names
- Always creates a new deck — no merge-into-existing option
- Import modal on /decks page with three tabs: Share Code | Text Paste | URL

**Community Browsing (DECK-08, DECK-09)**
- Three tabs on /decks page: My Decks | Community | Trending
- Community tab shows user-shared public decks with domain + champion/legend filters
- No favorites/bookmarking system — users import decks they like to their own list
- Tournament decks: existing riftdecks.com scraper is sufficient for DECK-09 — no new data source needed
- Existing `browse` endpoint already supports public deck queries

### Claude's Discretion
- Share code format details (length, character set, collision strategy)
- Riftbound.gg and Piltover Archive parser implementations
- URL fetch approach (server-side to avoid CORS)
- Community tab sort order and pagination
- Import preview UI layout
- Hand simulation animation (if any)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DECK-03 | User can simulate sample opening hands from their deck | Policy finding: pure client-side card draw is NOT automated rules enforcement; allowed under Riot policy with correct framing |
| DECK-05 | User can export deck as a short share code | Server-stored code approach; new `deck_share_codes` table recommended; `generateShareCode` method on DeckService |
| DECK-06 | User can import deck from a share code | `resolveShareCode` → read-only preview → `deck.create` import flow |
| DECK-07 | User can import deck from Riftbound.gg and Piltover Archive formats | Server-side URL fetch to avoid CORS; fuzzy name matching via `ilike`; format specs are LOW confidence |
| DECK-08 | User can browse community-shared decks | `browse` endpoint already exists; add Community tab + champion/domain filters |
| DECK-09 | User can view decks used in notable tournaments | Existing Trending tab with [RD] prefix filter is sufficient; no new data source needed |
</phase_requirements>

---

## Summary

This phase adds six capabilities on top of the fully-built deck builder from Phase 1.2: share code generation/import, external format import, community deck browsing, and optionally opening hand simulation. All six features extend existing code — no new architectural patterns are required.

The most critical research finding is the **Riot Digital Tools Policy** (published ~2025): it explicitly prohibits apps that "enable automated rules enforcement for Riftbound gameplay." However, it explicitly encourages "deckbuilders" and "card libraries." A "Draw Hand" button that shuffles a local JavaScript array and shows 4 random card images is not automated rules enforcement — it is equivalent to a physical shuffle preview tool. The implementation must be framed and implemented as a "consistency preview" and must not simulate combat, targeting, chain resolution, or scoring. The feature is **allowed** under this reading, but implementation discipline matters.

The opening hand size is confirmed as **4 cards** (not 7 as in other TCGs). Mulligan is: put up to 2 cards on the bottom of the deck and draw replacements — one mulligan opportunity per player.

External format import (DECK-07) is the highest-uncertainty feature. The text export formats for Riftbound.gg and Piltover Archive are not publicly documented in machine-readable form. Implementation must detect format by heuristic pattern matching and should fall back gracefully to fuzzy name matching against the local card database.

**Primary recommendation:** Implement DECK-03 as a pure client-side shuffle utility (no server calls, no stats), framing it clearly as a "preview" tool. Implement DECK-05/06 with a `deck_share_codes` table (not a column on `decks`) to allow one deck to have multiple codes over time. Defer DECK-07 format spec investigation to implementation — ship with best-effort parsers and clear "N cards not found" warnings.

---

## Standard Stack

### Core (already in use — no new installs required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | existing | New `deck_share_codes` table | Already the DB ORM |
| zod | existing | New input schemas for share/import | Single source of truth pattern |
| tRPC | existing | New router procedures | Established API pattern |
| sonner | existing | Toast for copy-to-clipboard | Already used for all toasts |
| nanoid | check package.json | Short alphanumeric code generation | Collision-resistant, URL-safe |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-fetch / built-in fetch | Node 18+ | Server-side URL fetch for DECK-07 | Avoids CORS on external URLs |
| crypto (Node built-in) | built-in | Fallback for ID generation if nanoid absent | Only if nanoid not available |

### Check: Is nanoid already in the repo?

```bash
grep -r "nanoid" package.json packages/*/package.json apps/*/package.json
```

If absent, add: `pnpm add nanoid --filter @la-grieta/api`

**Installation (if nanoid missing):**
```bash
pnpm add nanoid --filter @la-grieta/api
```

No other new packages required for this phase.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
apps/api/src/modules/deck/
├── deck.service.ts          # Add: generateShareCode, resolveShareCode, importFromText, importFromUrl, communityBrowse
├── deck.router.ts           # Add: shareCode.generate, shareCode.resolve, import.fromText, import.fromUrl
├── deck.module.ts           # No change
└── parsers/
    ├── riftbound-gg.parser.ts    # NEW: parse Riftbound.gg text format
    └── piltover-archive.parser.ts # NEW: parse Piltover Archive text format

packages/db/src/schema/
├── decks.ts                 # No change to existing columns
└── deck-share-codes.ts      # NEW: share_codes table

packages/shared/src/
├── schemas/deck.schema.ts   # Add: shareCodeGenerateSchema, shareCodeResolveSchema, deckImportSchema
└── utils/
    └── draw-hand.ts         # NEW: pure function, shuffles deck cards, returns 4

apps/web/src/app/(dashboard)/decks/
├── deck-list.tsx            # Add Community tab (3rd tab)
├── trending-decks.tsx       # Becomes the Trending tab content (already exists)
├── community-decks.tsx      # NEW: Community tab component
└── import-deck-modal.tsx    # NEW: 3-tab modal (Share Code | Text Paste | URL)

apps/web/src/app/(dashboard)/decks/[id]/
├── deck-detail.tsx          # Add Share button, add Hand Simulator section
└── deck-card-editor.tsx     # Add Share button to toolbar
```

### Pattern 1: Share Code Table (separate from decks)

**What:** A `deck_share_codes` table maps short codes to deck snapshots (deck ID + creation time). A deck can have multiple codes; codes are immutable snapshots.
**When to use:** Prevents code invalidation if a deck is edited; old codes still resolve to the state at time of sharing.

```typescript
// packages/db/src/schema/deck-share-codes.ts
import { pgTable, varchar, uuid, timestamp, index } from 'drizzle-orm/pg-core';
import { decks } from './decks';

export const deckShareCodes = pgTable('deck_share_codes', {
  code: varchar('code', { length: 12 }).primaryKey(), // e.g. "LG-a3Xk9m"
  deckId: uuid('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_deck_share_codes_deck_id').on(table.deckId),
]);
```

**Code generation approach:**
- Format: `LG-` prefix + 6 random alphanumeric chars (uppercase + digits, excluding ambiguous 0/O/I/1) = 36^6 ≈ 2.1B combinations
- Collision check: try INSERT, catch unique violation, retry up to 3 times
- Only generate for `isPublic = true` decks

### Pattern 2: Pure Client-Side Hand Draw (DECK-03)

**What:** A pure TypeScript function in `@la-grieta/shared` that takes the flat deck card array, expands quantities to individual "cards", shuffles using Fisher-Yates, and returns the first 4.
**When to use:** Called only in the browser — no server round-trip, no state tracking, no rules automation.

```typescript
// packages/shared/src/utils/draw-hand.ts
export interface HandCard {
  cardId: string;
  name: string;
  imageSmall: string | null;
}

/**
 * Pure shuffle — no Node or browser APIs.
 * Returns 4 cards representing an opening hand preview.
 * This is a consistency tool, not a game simulator.
 */
export function drawHand(
  deckCards: Array<{ cardId: string; quantity: number; name: string; imageSmall: string | null }>,
  handSize: number = 4,
): HandCard[] {
  // Expand quantities: [{cardId, quantity:3}] → 3 entries
  const pool: HandCard[] = [];
  for (const entry of deckCards) {
    for (let i = 0; i < entry.quantity; i++) {
      pool.push({ cardId: entry.cardId, name: entry.name, imageSmall: entry.imageSmall });
    }
  }

  // Fisher-Yates shuffle using Math.random() — acceptable for preview tool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }

  return pool.slice(0, Math.min(handSize, pool.length));
}
```

**Opening hand facts (confirmed):**
- Hand size: **4 cards**
- Mulligan: put up to 2 cards back (bottom of deck), draw replacements — one opportunity per player
- UI: "Draw Hand" button draws 4; "Mulligan" picks up to 2 to swap, redraws

**Note on Riot policy:** Only include main deck cards in the hand draw pool (exclude champion/rune zones). The champion zone is revealed at game start, not drawn. Runes are channeled separately. The draw pool is the 40-card main deck only.

### Pattern 3: External Import Parser Architecture

**What:** Two parser modules, each implementing a common `ParseResult` interface. Format auto-detection by heuristic.
**When to use:** DECK-07 text paste and URL fetch flows.

```typescript
// packages/shared/src/utils/deck-import-parser.ts
export interface ParsedDeckEntry {
  quantity: number;
  cardName: string;   // raw name as parsed from text
  zone: 'main' | 'rune' | 'champion';
}

export interface ParseResult {
  entries: ParsedDeckEntry[];
  format: 'riftbound-gg' | 'piltover-archive' | 'unknown';
}

export function parseRiftboundGg(text: string): ParseResult { /* ... */ }
export function parsePiltoverArchive(text: string): ParseResult { /* ... */ }

export function autoDetectAndParse(text: string): ParseResult {
  // Heuristic: check for format-specific headers or patterns
  if (text.includes('## Champion') || text.match(/^Legend:/im)) {
    return parsePiltoverArchive(text);
  }
  return parseRiftboundGg(text); // fallback
}
```

**Name resolution (server-side):** After parsing, the API resolves card names using `ilike` fuzzy match against the `cards` table (`cleanName` column). Unmatched names are returned in the `unmatched` array. This keeps all DB access server-side.

### Pattern 4: Community Tab (DECK-08)

**What:** Third tab in `deck-list.tsx` using the existing `deck.browse` tRPC query with `domain` and optional `search` filters.
**Key insight:** The `browse` endpoint already exists and handles public deck pagination. The Community tab only needs new UI — no new API endpoint.

```typescript
// In community-decks.tsx — uses existing endpoint
const { data } = trpc.deck.browse.useInfiniteQuery(
  { limit: 12, domain: selectedDomain ?? undefined, search: searchQuery || undefined },
  { getNextPageParam: (p) => p.nextCursor }
);
```

**Filters needed:**
- Domain dropdown: values from `CARD_DOMAINS` constant (already in `@la-grieta/shared`)
- Champion/legend filter: requires adding a `championName` filter parameter to `browse` — needs a join on deck_cards → cards where zone='champion'

### Anti-Patterns to Avoid

- **Storing share code on the `decks` table:** Adding a `shareCode` column means a deck can only have one code ever, and the column is null for most decks (sparse). Use a separate `deck_share_codes` table.
- **Client-side URL fetching for external import:** Riftbound.gg and Piltover Archive have no CORS headers for API access. Always fetch external URLs server-side from NestJS.
- **Expanding hand draw pool to include runes/champion:** Only the 40-card main deck is drawn from. Rune deck is channeled separately.
- **Building a full deck simulator:** Riot policy prohibits automated rule enforcement. The hand draw must remain a pure shuffle — no targeting, no chain resolution, no combat simulation.
- **Generating codes with Math.random() directly:** Use nanoid or Node crypto for production-quality randomness; Math.random() is only acceptable inside the pure hand-draw utility.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Short ID generation | Custom base-62 encoder | nanoid | Handles URL-safe chars, crypto-random, tested |
| Fuzzy card name matching | Levenshtein in JS | PostgreSQL `ilike` + `pg_trgm` (optional) | Already used in `browse`, handles partial matches at DB level |
| Deck snapshot storage | Re-query cards on each code resolution | Store deckId in share_codes table + re-fetch live | Codes resolve to current deck state (live) or snapshot at share time (immutable) — user decision drove immutable; table FK handles cleanup |
| External URL fetch CORS bypass | Browser proxy trick | Server-side fetch in NestJS | Only approach that works reliably across all domains |
| Fisher-Yates shuffle | Naive random splice | Proper index-swap Fisher-Yates | Naive splice is biased; Fisher-Yates is O(n) and unbiased |

**Key insight:** The hand draw feature is trivially simple (shuffle array, take 4) — the complexity is in NOT adding more. Resist adding probability calculations, opening hand statistics, or consistency percentages. Riot's policy concern is apps that become standalone games.

---

## Common Pitfalls

### Pitfall 1: Share Code Resolution After Deck Deletion
**What goes wrong:** A share code is generated, then the deck owner deletes the deck. The share code row is orphaned or throws a FK violation.
**Why it happens:** `deck_share_codes.deck_id` references `decks.id`. If `onDelete: 'cascade'`, the code disappears; if not, the FK blocks deletion.
**How to avoid:** Use `onDelete: 'cascade'` on the FK. When a code resolves and the deck is gone, return a clear "Deck no longer available" error (NOT_FOUND).
**Warning signs:** "violates foreign key constraint" errors on deck delete.

### Pitfall 2: Private Deck Share Code Generation
**What goes wrong:** A private deck gets a share code, and anyone with the code can view it.
**Why it happens:** Code generation endpoint doesn't check `isPublic` before creating.
**How to avoid:** Check `deck.isPublic === true` before generating. Return a `FORBIDDEN` error with message "Only public decks can be shared. Make this deck public first."
**Warning signs:** Share button appearing on private deck detail view.

### Pitfall 3: Stale Compiled Artifacts in packages/shared
**What goes wrong:** New exports added to `packages/shared/src/*.ts` don't appear in the web app because the `.js` and `.d.ts` compiled artifacts are stale.
**Why it happens:** Known project issue — shared package uses compiled JS artifacts that aren't auto-rebuilt.
**How to avoid:** After adding any new export to `packages/shared/src/`, update the corresponding `.js` and `.d.ts` files in `packages/shared/src/`. This was hit in Phase 01.2.
**Warning signs:** "Module not found" or "Property does not exist" TypeScript errors when importing from `@la-grieta/shared`.

### Pitfall 4: External URL Fetch Hangs / Timeouts
**What goes wrong:** Server-side fetch of an external URL (Riftbound.gg, Piltover Archive) hangs indefinitely or returns a bot-detection page.
**Why it happens:** These sites may use Cloudflare or bot-detection that blocks server-side requests.
**How to avoid:** Set a 10-second timeout on all external fetches. Return a clear "Could not fetch that URL" error — don't retry. Let the user paste the text manually as a fallback.
**Warning signs:** tRPC mutation hanging for more than 5 seconds with no response.

### Pitfall 5: Champion Filter in Community Browse
**What goes wrong:** Filtering community decks by champion/legend requires a join that the existing `browse` endpoint doesn't have.
**Why it happens:** `DeckBrowseInput` only supports `domain` and `search` filters. There's no `championName` field.
**How to avoid:** Add `championName?: string` to `deckBrowseSchema` and update the `browse` query to LEFT JOIN `deck_cards` + `cards` on `zone='champion'` when this filter is active. Add an index on `(deck_id, zone)` in `deck_cards` if not present.
**Warning signs:** Community tab showing all public decks regardless of the legend filter.

### Pitfall 6: External Format Parser Fragility
**What goes wrong:** The Riftbound.gg or Piltover Archive text format changes and the parser silently produces wrong results.
**Why it happens:** Community sites update their export format without versioning.
**How to avoid:** Parser should be defensive — any line that doesn't match expected patterns is collected as unmatched (not silently dropped). Always surface the unmatched count to the user.
**Warning signs:** Import succeeds with 0 cards found, or import creates a deck missing entire zones.

---

## Code Examples

Verified patterns from existing codebase:

### Share Code Generation (new service method)
```typescript
// apps/api/src/modules/deck/deck.service.ts
import { customAlphabet } from 'nanoid';

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

async generateShareCode(userId: string, deckId: string): Promise<string> {
  // Verify ownership + isPublic
  const [deck] = await this.db
    .select({ userId: decks.userId, isPublic: decks.isPublic })
    .from(decks)
    .where(eq(decks.id, deckId))
    .limit(1);

  if (!deck) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deck not found' });
  if (deck.userId !== userId) throw new TRPCError({ code: 'FORBIDDEN' });
  if (!deck.isPublic) throw new TRPCError({
    code: 'FORBIDDEN',
    message: 'Only public decks can be shared. Make this deck public first.'
  });

  // Generate with collision retry
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = `LG-${generateCode()}`;
    try {
      await this.db.insert(deckShareCodes).values({ code, deckId });
      return code;
    } catch (err) {
      if (attempt === 2) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      // retry on unique violation
    }
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
}
```

### Browse with Champion Filter (extending existing pattern)
```typescript
// Extension to deck.service.ts browse()
if (input.championName) {
  // Subquery: deck IDs that have a champion card matching the name
  conditions.push(
    sql`${decks.id} IN (
      SELECT dc.deck_id FROM deck_cards dc
      INNER JOIN cards c ON dc.card_id = c.id
      WHERE dc.zone = 'champion'
        AND c.clean_name ILIKE ${`%${escapeLike(input.championName)}%`}
    )`
  );
}
```

### Name Resolution for Import
```typescript
// Server-side: resolve parsed card names to DB card IDs
async resolveCardNames(
  names: Array<{ name: string; quantity: number; zone: string }>
): Promise<{ resolved: DeckCardEntry[]; unmatched: string[] }> {
  const resolved: DeckCardEntry[] = [];
  const unmatched: string[] = [];

  for (const entry of names) {
    const [card] = await this.db
      .select({ id: cards.id })
      .from(cards)
      .where(and(
        ilike(cards.cleanName, `%${escapeLike(entry.name)}%`),
        eq(cards.isProduct, false)
      ))
      .limit(1);

    if (card) {
      resolved.push({ cardId: card.id, quantity: entry.quantity, zone: entry.zone as DeckZone });
    } else {
      unmatched.push(entry.name);
    }
  }

  return { resolved, unmatched };
}
```

### Copy-to-Clipboard Pattern (existing sonner pattern)
```typescript
// Client component — copy share code
async function handleShare() {
  const { code } = await trpc.deck.shareCode.generate.mutate({ deckId: id });
  await navigator.clipboard.writeText(code);
  toast.success(`Share code copied: ${code}`);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TCG apps freely built simulators | Riot policy prohibits automated rules enforcement | ~2025 (Digital Tools Policy) | Hand draw must be framed as preview tool, not simulator |
| 7-card opening hand (Magic standard) | Riftbound: 4-card opening hand | Launch rules | Hand simulator must draw 4, not 7 |
| Long URLs for deck sharing | Short codes (e.g., "LG-A3XK9M") | Community expectation | WhatsApp-shareable; 8-char codes fit one line |

**Current community tools (for import format research):**
- Riftbound.gg deck builder: community standard; text export format unknown (LOW confidence, investigate during implementation)
- Piltover Archive: secondary community tool; format unknown (LOW confidence)
- Rift Mana: uses "3x Card Name" format with zone sections as headers
- RiftDecks.com: tournament scraper source (already integrated as Trending tab)

---

## DECK-03 Policy Decision

**Finding (HIGH confidence — from official Riot Developer Portal):**

The Riot Digital Tools Policy states:
- PROHIBITED: Apps that "enable automated rules enforcement for Riftbound gameplay"
- PROHIBITED: "standalone clients" that exist solely for Riftbound play
- ENCOURAGED: "Deckbuilders" and "card libraries"

**Analysis:** A "Draw Hand" button that:
1. Takes a JavaScript array of the 40 main-deck cards
2. Runs Fisher-Yates shuffle
3. Returns the first 4 card images

...is NOT automated rules enforcement. It does not resolve abilities, track game state, handle targeting, manage the chain, or automate scoring. It is equivalent to "click to see a random 4 cards from your deck" — a visual consistency preview tool.

**Decision: DECK-03 is ALLOWED.** Implementation constraints:
- Pure client-side (Math.random or crypto.getRandomValues in browser) — no server round-trip
- Only the 40-card main deck is in the draw pool (not rune deck, not champion)
- No probability stats, no win-rate calculations
- No "simulate game" framing in UI copy — use "Preview Hand" or "Draw Sample Hand"
- UI: horizontal row of 4 card images + "Mulligan" button (swaps up to 2 back, draws replacements)
- No animation required unless trivially simple (optional fade-in)

**Opening hand confirmed:** 4 cards. Mulligan: set aside up to 2, draw replacements.

---

## Open Questions

1. **Riftbound.gg text export format**
   - What we know: Community uses the site; some format uses "Nx Card Name" notation; section headers vary
   - What's unclear: Exact section header strings, whether zone is encoded in text or inferred from card type
   - Recommendation: During implementation, manually export a deck from riftbound.gg and document the format. Build parser defensively — collect all unmatched lines, surface to user.

2. **Piltover Archive text export format**
   - What we know: Site has a deck builder with export; format uses card names + quantities
   - What's unclear: Section headers, whether zone data is included, how champion is denoted
   - Recommendation: Same as above — manual export during implementation. The two formats are likely similar enough that a single flexible parser handles both.

3. **Nanoid availability**
   - What we know: Not confirmed in package.json without checking
   - Recommendation: Check during Wave 0 setup; if absent, `pnpm add nanoid --filter @la-grieta/api` and update compiled `.js` artifacts if needed.

4. **Community tab champion filter performance**
   - What we know: `deck_cards` has an index on `deck_id`. A champion-name subquery needs a scan on zone='champion' rows.
   - What's unclear: Whether PostgreSQL will use the index efficiently for the subquery
   - Recommendation: Add a partial index on `(deck_id)` WHERE `zone = 'champion'` if query performance is poor. Monitor during implementation.

5. **Share code immutability vs. live deck state**
   - What we know: User decision is that codes map to a deck snapshot (separate table). But the code only stores the `deck_id` — it resolves to live deck state, not the state at time of sharing.
   - What's unclear: Whether "snapshot" means truly frozen state or just "this deck's current cards"
   - Recommendation: Implement as live resolution (simpler, aligns with how other deck tools work). If a deck is edited after sharing, the code resolves to the new state. Document this in UI as "share code links to your deck's current state."

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && pnpm vitest run --reporter=dot` |
| Full suite command | `cd apps/api && pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECK-03 | `drawHand()` returns 4 cards from main deck pool only | unit | `pnpm vitest run __tests__/draw-hand.spec.ts` | Wave 0 |
| DECK-03 | `drawHand()` returns <= pool size when deck has < 4 main cards | unit | `pnpm vitest run __tests__/draw-hand.spec.ts` | Wave 0 |
| DECK-05 | `generateShareCode()` returns "LG-XXXXXX" for public decks | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | Extend existing |
| DECK-05 | `generateShareCode()` throws FORBIDDEN for private decks | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | Extend existing |
| DECK-06 | `resolveShareCode()` returns deck with cards for valid code | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | Extend existing |
| DECK-06 | `resolveShareCode()` throws NOT_FOUND for invalid code | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | Extend existing |
| DECK-07 | Text parser extracts name + quantity + zone from Rift-style text | unit | `pnpm vitest run __tests__/deck-import-parser.spec.ts` | Wave 0 |
| DECK-07 | Unmatched card names surfaced in result (not silently dropped) | unit | `pnpm vitest run __tests__/deck-import-parser.spec.ts` | Wave 0 |
| DECK-08 | `browse()` with `championName` filter returns only matching decks | unit | `pnpm vitest run __tests__/deck.service.spec.ts` | Extend existing |
| DECK-09 | Trending tab shows decks with [RD] prefix (existing behavior) | manual | View /decks → Trending tab | Existing feature |

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm vitest run --reporter=dot`
- **Per wave merge:** `cd apps/api && pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/__tests__/draw-hand.spec.ts` — covers DECK-03 unit tests
- [ ] `apps/api/__tests__/deck-import-parser.spec.ts` — covers DECK-07 parser unit tests
- [ ] `packages/db/src/schema/deck-share-codes.ts` — new schema file (Wave 0 DB setup)
- [ ] Migration script for `deck_share_codes` table

---

## Sources

### Primary (HIGH confidence)
- Riot Developer Portal `developer.riotgames.com/docs/riftbound` — Digital Tools Policy, prohibited/allowed categories
- Riftbound Wiki Fextralife `riftbound.wiki.fextralife.com/Core+Rules` — Opening hand = 4 cards, mulligan rules (rules 116-118)
- Existing codebase `apps/api/src/modules/deck/deck.service.ts` — full service interface, existing methods
- Existing codebase `packages/db/src/schema/decks.ts` — current DB schema
- Existing codebase `packages/shared/src/constants/card.constants.ts` — MAIN_DECK_SIZE=40, RUNE_DECK_SIZE=12, CHAMPION_COUNT=1

### Secondary (MEDIUM confidence)
- Multiple web sources (eneba.com, runesandrift.com) confirming 4-card opening hand and mulligan rules
- Riot Grove `riotgrove.com/articles/riftbound/news/riftbound-league-of-legends-tcg-digital-tools-policy` — policy text summary

### Tertiary (LOW confidence)
- Riftbound.gg and Piltover Archive text export formats — could not be verified from public documentation; requires manual investigation during implementation
- nanoid availability in project — not confirmed without checking package.json

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project except nanoid (confirm during Wave 0)
- Architecture: HIGH — extends established patterns, no new paradigms
- Policy (DECK-03): MEDIUM-HIGH — policy text confirmed from Riot Developer Portal; interpretation that pure shuffle = not automated rules enforcement is logical but not explicitly stated
- Pitfalls: HIGH — drawn from project history (STATE.md) and known TCG tool gotchas
- External format specs (DECK-07): LOW — format not publicly documented; investigation deferred to implementation

**Research date:** 2026-03-12
**Valid until:** 2026-06-12 for codebase findings; 2026-04-12 for Riot policy (check for updates quarterly)
