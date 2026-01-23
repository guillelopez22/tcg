# La Grieta TCG - Project Instructions

## Team Workflow (MANDATORY)

Always use the agent team for development work. **Never do development tasks directly** - delegate to the appropriate agent.

### Team Structure

| Agent | Role | Use For |
|-------|------|---------|
| **Tech Lead** (`tech-lead-reviewer`) | Coordinates team, plans, ensures quality | Planning, task delegation, final reviews |
| **Backend Engineer** (`senior-backend-engineer`) | API/NestJS development | All backend code changes |
| **Frontend Engineer** (`ux-design-advisor`) | Angular/Web development | All frontend code changes |
| **UX/UI Advisor** (`ux-design-advisor`) | Design consultation | UI/UX decisions, accessibility |
| **QA** (`tech-lead-reviewer`) | Testing | Test before every deployment |
| **Code Reviewer** | Code reviews, PR reviews | Quality checks before commits |

### Workflow Rules

1. **Tech Lead organizes** - Always start with Tech Lead to plan and delegate
2. **Backend Engineer for API** - All NestJS/backend changes go through backend agent
3. **Frontend Engineer for Web** - All Angular/frontend changes go through frontend agent
4. **QA tests everything** - Run QA before any deployment
5. **Code Reviewer for quality** - Use for code reviews and PR checks
6. **Stick to the plan** - Don't add unnecessary code or features
7. **Bug squash before commits** - Fix all bugs before committing, not after

### Important Rules

- Keep changes minimal and focused
- Don't over-engineer or add "nice to have" features
- Don't refactor working code unless requested
- Test locally before deploying to Railway
- Always verify builds pass before committing

## Project Structure

- `la-grieta/` - Main monorepo (Nx workspace)
  - `api/` - NestJS backend
  - `web/` - Angular frontend
  - `libs/shared/` - Shared types/interfaces

## Deployment

- Platform: Railway
- API: `la-grieta-api-production.up.railway.app`
- Web: `la-grieta-web-production.up.railway.app`

## Project Phases

### Completed Phases

- **Phase 1-4**: Core platform (Auth, Cards, Collections, Decks, Scanner)
- **Phase 5**: Marketplace (Listings, Orders, Shops)
- **Phase 6**: Stripe Connect Payments (Seller onboarding, Checkout, Webhooks)

### Phase 7: Auctions (NEXT)

Real-time auction system with WebSocket bidding.

**Features:**
- Timed auctions for cards
- Starting price, reserve price (optional), buy-it-now (optional)
- Real-time bid updates via WebSocket
- Anti-sniping protection (auto-extend if bid in last minutes)
- Winner determination and payment processing

**Backend Tasks:**
- Create Auction module (auction.module.ts, auction.service.ts, auction.controller.ts)
- WebSocket gateway for real-time bidding
- Auction lifecycle management (start, bid, end, winner)
- Integration with Stripe for winner payment

**Frontend Tasks:**
- Auction listing page
- Real-time bid display component
- Place bid UI
- Auction timer component
- My auctions (watching, bidding, won)

### Future Phases (Planned)

- **Phase 8**: Trading system (user-to-user trades)
- **Phase 9**: Social features (follows, activity feed)
- **Phase 10**: Mobile optimization / PWA

## Known Issues & Solutions

### Alpine Linux + bcrypt
- Use `bcryptjs` instead of `bcrypt` (native bcrypt hangs on Alpine)

### Scanner Routes
- Controller should use `@Controller('scanner')` not `@Controller('api/scanner')` (global prefix already adds `/api`)
