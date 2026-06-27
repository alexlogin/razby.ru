# Razby Roadmap

## Phase 1 - Platform Foundation

- Next.js app with public landing, Google OAuth route, dashboard shell and local demo mode.
- SQLite database models for users, workspaces, accounts, proxies, module runs, leads, campaigns and referrals.
- Working API endpoints for account creation, module runs and proxy checks.
- All 14 module screens available in the dashboard with persistent run history.
- Campaign CRUD, audit log, CSV lead export and real TCP proxy reachability check.
- Worker script for queued module runs: `npm run worker -- --watch`.
- Workflow builder for the full traffic-system scenario: source, Telegram resource, parser settings, AI prompt, offer and launch plan.
- Production control layer: approval queue, unified inbox, AI draft workflow and newer GramGPT-class modules for Telegram folders, bulk story copy and seller-protection.

## Phase 2 - Real Telegram Worker

- Add a separate worker service on VPS for Telegram API/session execution.
- Store encrypted Telegram session metadata outside the web process.
- Support session-style Telegram account import, GEO tagging and proxy-pool assignment.
- Add niche profile setup for Telegram accounts: names, bios, avatars and persona notes.
- Add queue states: queued, running, paused, failed, completed.
- Add rate limits, stop rules and real Telegram worker execution for approved risky actions.
- Replace demo module results with real adapters per module.
- Add official Google OAuth credentials and disable demo mode.

## Phase 3 - AI and Data

- Connect AI generation for comments, chat replies and dialogs.
- Expand the existing approval workflow and operator handoff into live Telegram delivery.
- Expand workflow builder into reusable scenario templates and conversion analytics.
- Add neurochatting controls from the reference funnel: response probability, context window, max replies per user, link handoff and stop-after-link.
- Add channel/chat discovery filters: language, active-only mode, minimum members and seed sources.
- Add CSV export/import for leads, accounts and parsed sources.
- Expand GGR into a real scoring model once production telemetry exists.

## Phase 4 - Public Growth Layer

- Add SEO blog engine.
- Add channel map as a public lead magnet.
- Add proxy checker and account checker public pages with hourly limits.
- Add referral dashboard and tracking.

## Phase 5 - Billing

- Add pricing plans, module entitlements and usage limits.
- Integrate payment provider after the product flow is stable.
