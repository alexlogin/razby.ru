# GramGPT Structure Audit

Source review date: 2026-06-21.

## Public Structure

- Main landing: hero, workflow, video, modules, pricing, reviews, comparison, cases, FAQ, final CTA.
- Functions page: complete module catalog and pricing CTA.
- Prices page: module calculator, full license, separate module prices, selected-module summary.
- Auth pages: Google/Telegram/social entry in addition to classic fields on the original site.
- Utility pages: channel map, proxy checker, GGR account checker.
- SEO pages: blog index, article pages, module/feature article hub, Telegram soft page.
- Trust pages: reviews, contacts, privacy, terms, referral program.
- Closed routes visible through robots/sitemap hints: `/panel`, `/auth`, `/payment`, `/webapp`, `/app`.

## Module Set To Cover

1. Mass looking
2. GGR account rating
3. AI dialogs
4. Account manager
5. Mass reactions
6. Comment parser
7. Message parser
8. User parser
9. Group parser
10. AI account protection
11. Channel parser
12. Auto warm-up
13. AI chat
14. AI commenting

## Razby Product Decisions

- Brand and visual design are original, not copied from GramGPT.
- Functional surface follows the same platform idea: public acquisition pages plus protected workspace.
- Production sign-in target is Google OAuth only.
- Payments are intentionally deferred.
- Local preview uses `RAZBY_DEMO_MODE=true` until Google OAuth keys are installed on VPS.
- Current implementation persists accounts, module runs, leads, proxies and referrals in SQLite through Prisma.

