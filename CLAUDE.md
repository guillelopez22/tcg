# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# LA GRIETA — Agent Constitution

## Project Identity
You are building **La Grieta** — the definitive companion app for Riftbound TCG.
"La Grieta" means "The Rift" in Spanish. This is a Honduran-founded TCG brand with
existing community presence across multiple cities. The name is part of the
League of Legends universe — no other TCG app can say that.
Stack: NestJS + tRPC backend, Next.js web, React Native mobile, PostgreSQL, Redis, Cloudflare R2.
All code must be TypeScript strict mode. No `any`. No untested code.

## Architecture Principles
- API-first: every feature is an API endpoint before it's a UI
- Offline-first mobile: bundle full card DB (~550 cards) locally
- Security by default: JWT + refresh tokens, rate limiting on all endpoints, input validation via Zod
- Mobile-first UI: design for 375px width first, then scale up
- Riot Policy compliance: no tournament brackets via Riot API, no win-rate metagame data

## Code Standards
- Commit after every logical unit (feat/fix/chore/docs prefixes)
- All API routes must have Zod input validation
- All DB queries through Drizzle ORM — no raw SQL in application code
- Test coverage minimum 80% for services, 60% for controllers
- Use Zod schemas as single source of truth for types

## Data Sources
- All card data: apitcg/riftbound-tcg-data GitHub repo (cloned locally, free, no API key)
- Card art: image URLs from the cloned repo JSON — no external API calls
- Pricing: none for now — price fields left nullable, populated manually or added later
- No external API dependencies at this stage

## Security Rules
- NEVER log secrets or PII
- ALWAYS validate and sanitize user input
- Rate limit: 100 req/min per IP on public routes, 1000 req/min for authenticated
- All uploads through Cloudflare R2 presigned URLs only — never direct backend upload
- Marketplace transactions: escrow model, no direct payment between users

## Seed/Fallback Card Data

`riftbound-tcg-data/` is a cloned external repo (https://github.com/apitcg/riftbound-tcg-data.git). Do not modify it.

### Structure
- `sets/en.json` — array of sets (Origins, Origins: Proving Grounds, Spiritforged)
- `cards/en/<set-id>.json` — array of cards per set, sourced from TCGPlayer

### Card Schema (key fields)
`id`, `number`, `code`, `name`, `cleanName`, `images` (small/large), `set`, `tcgplayer` (id/url), `rarity`, `cardType`, `domain`, `energyCost`, `powerCost`, `might`, `description`, `flavorText`

**Note:** Early entries in Origins and Spiritforged are products (booster packs, displays) with null card attributes, not playable cards.

## Known Issues from V1
- Use `bcryptjs` instead of `bcrypt` on Alpine Linux (native bcrypt hangs)
- Avoid duplicating global route prefixes in controllers
