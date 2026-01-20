# La Grieta

*"Donde los campeones comercian"* - Where champions trade

A comprehensive TCG platform for Riot's **Riftbound** card game, built for the Central American gaming community.

## Features

- **Card Database** - Full Riftbound catalog synced from Riot API
- **AI Card Scanner** - Camera + ML to identify cards instantly
- **Deck Builder** - Build, validate, and share Riftbound decks
- **Collection Manager** - Track your cards with scan-to-add
- **Marketplace** - P2P sales, user shops, auctions
- **Trading System** - Card-for-card exchanges
- **Escrow Payments** - Secure transactions with buyer protection

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Nx 17+ |
| Frontend | Angular 17+ (Standalone Components) |
| UI Library | Angular Material |
| Styling | TailwindCSS |
| Backend | NestJS |
| Database | PostgreSQL |
| ORM | Prisma |
| Card Data | Riot Games Riftbound API |
| Card Scanner | Google Cloud Vision API |
| Auth | JWT + Passport |
| Payments | Stripe Connect |
| Real-time | Socket.io |

## Project Structure

```
la-grieta/
├── apps/
│   ├── web/          # Angular frontend
│   └── api/          # NestJS backend
├── libs/
│   ├── shared/       # Shared interfaces, DTOs, constants
│   └── ui/           # Shared Angular components
└── prisma/           # Database schema
```

## Getting Started

```bash
# Install dependencies
npm install

# Start development servers
nx serve web
nx serve api

# Run tests
nx test web
nx test api
```

## Riftbound Card Types

| Type | Description |
|------|-------------|
| LEGEND | Defines deck domains (1 per deck) |
| CHAMPION | Playable version of legend |
| UNIT | Creatures for battlefields |
| SPELL | Events (Neutral/Action/Reaction) |
| GEAR | Equipment for units |
| RELIC | Persistent effects |
| TERRAIN | Battlefield modifiers |
| BATTLEFIELD | Locations |
| RUNE | Resources (side deck) |

## Domains

| Domain | Color | Strategy |
|--------|-------|----------|
| FURY | Red | Aggro, direct damage |
| CALM | Green | Buffs, protection |
| MIND | Blue | Control, card draw |
| BODY | Orange | Ramp, big creatures |
| CHAOS | Purple | Movement, bounce |
| ORDER | Yellow | TBD |

## License

MIT

---

Built with ❤️ for the Central American TCG community

