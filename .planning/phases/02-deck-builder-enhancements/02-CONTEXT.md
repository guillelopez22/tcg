# Phase 2: Deck Builder Enhancements - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Competitive players can simulate opening hands, share decks via short codes, import decks from external formats (Riftbound.gg, Piltover Archive, share codes), and discover community-shared and tournament decks. DECK-01, DECK-02, and DECK-04 were completed in Phase 1.2 (Smart Deck Builder). This phase covers DECK-03, DECK-05, DECK-06, DECK-07, DECK-08, DECK-09.

</domain>

<decisions>
## Implementation Decisions

### Hand Simulation (DECK-03) — CONDITIONAL
- **Policy gate:** Claude must research Riftbound's official stance on hand/draw simulators before implementing. If Riftbound prohibits simulators, DECK-03 is skipped entirely — no feature-flagged build, no hidden implementation.
- If allowed: "Draw Hand" button plus "Mulligan" button that reshuffles and draws again
- Hand size: Claude researches Riftbound's official opening hand size (do not assume 7)
- Display: horizontal card row (not fan spread)
- No probability stats — just show the drawn cards, keep it simple
- Players draw multiple times to get a feel for consistency

### Share Codes (DECK-05, DECK-06)
- Server-stored short codes: generate an alphanumeric code (e.g., "LG-a3Xk9m") mapped to a server-side deck snapshot
- Only public decks can generate share codes — private decks cannot be shared via code
- Importing a share code shows a read-only preview first (cards, analytics, buildability %) with explicit "Import to My Decks" button
- Share button appears on both deck detail page and editor toolbar
- Copy-to-clipboard with toast confirmation on share

### External Format Import (DECK-07)
- Support both text paste and URL fetch
- Auto-detect format: Riftbound.gg list vs Piltover Archive format
- Partial import allowed: import all recognized cards, show warning listing unmatched card names ("3 cards not found: [names]. Import the 37 that matched?")
- Always creates a new deck — no merge-into-existing option
- Import modal on /decks page with three tabs: Share Code | Text Paste | URL

### Community Browsing (DECK-08, DECK-09)
- Three tabs on /decks page: My Decks | Community | Trending
- Community tab shows user-shared public decks with domain + champion/legend filters
- No favorites/bookmarking system — users import decks they like to their own list
- Tournament decks: existing riftdecks.com scraper is sufficient for DECK-09 — no new data source needed, just keep the Trending tab with existing tier badges
- Existing `browse` endpoint already supports public deck queries

### Claude's Discretion
- Share code format details (length, character set, collision strategy)
- Riftbound.gg and Piltover Archive parser implementations
- URL fetch approach (server-side to avoid CORS)
- Community tab sort order and pagination
- Import preview UI layout
- Hand simulation animation (if any)

</decisions>

<specifics>
## Specific Ideas

- Share codes prefixed with "LG-" to brand them as La Grieta codes
- Import modal consolidates all import methods in one place (share code, text paste, URL) rather than scattering across the UI
- The Honduran community shares decks primarily via WhatsApp — short codes are more copy-paste friendly than URLs
- Riftbound may have explicit policies against simulators — this must be verified before building DECK-03
- Community tab filters by domain + champion because competitive players build around specific archetypes

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deck.service.ts`: Full CRUD + `setCards` + `browse` + `suggest` + `getBuildability` — extend for share code generation, import, community queries
- `deck.router.ts`: 9 existing endpoints including `browse` (public) and `getById` (optional auth) — extend with share/import routes
- `trending-decks.tsx`: Riftdecks.com scraped decks with tier badges, domain badges, import flow — becomes the Trending tab
- `deck-list.tsx`: Already tabbed (My Decks | Trending) with `DeckBuildability` and `DeckStatusBadge` sub-components — extend to three tabs
- `deck-detail.tsx`: Deck view page — add share button, hand simulator section
- `deck-card-editor.tsx`: Full zone-aware editor — add share button to toolbar
- `deck-wizard.tsx`: 3-path wizard (Suggested, Legend, Scratch) — import is separate modal, not a wizard path
- `computeAnalytics` from `@la-grieta/shared`: Client-side analytics for import preview
- `validateDeckFormat` from `@la-grieta/shared`: Pure function for validating imported decks

### Established Patterns
- tRPC mutations with `onSuccess`/`onError`/`onSettled` callbacks
- `sonner` toast for user feedback (copy-to-clipboard confirmation)
- `lg-*` design system classes for consistent styling
- Tabbed UI pattern already established in deck-list and collection page
- `optionalAuthProcedure` for public endpoints that benefit from auth context

### Integration Points
- Deck list tabs: `apps/web/src/app/(dashboard)/decks/deck-list.tsx` — add Community tab
- Deck detail: `apps/web/src/app/(dashboard)/decks/[id]/deck-detail.tsx` — add share button, hand simulator
- Deck editor: `apps/web/src/app/(dashboard)/decks/[id]/deck-card-editor.tsx` — add share button to toolbar
- Deck service: `apps/api/src/modules/deck/deck.service.ts` — new methods: generateShareCode, resolveShareCode, importFromText, importFromUrl
- DB schema: `packages/db/src/schema/decks.ts` — may need share_code column or separate share_codes table
- Shared schemas: `packages/shared/src/schemas/` — new Zod schemas for share/import inputs
- Cards table: fuzzy matching for external format import (card name resolution)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-deck-builder-enhancements*
*Context gathered: 2026-03-12*
