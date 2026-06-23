# YouTube Platform Reference

Source: https://www.youtube.com/watch?v=0uHZ5nOkzE0  
Title: "Я Получил +1237 Заявок в Telegram за 4 Дня - Вот Как"  
Channel: "Гришин Трафик"  
Video date from metadata: 2026-06-13  
Reviewed: 2026-06-21

## Core Funnel Shown

The video demonstrates GramGPT as an operations panel for a Telegram lead-generation funnel. The flow is:

1. Prepare a Telegram channel with an offer and request-to-join link.
2. Import Telegram accounts from session files.
3. Match account country with SOCKS5 proxies and distribute proxy pools across accounts.
4. Re-style accounts for the niche: names, bios, avatars, profile identity and optional Telegram Premium trust signals.
5. Generate or prepare creative assets for the channel.
6. Search and collect active Telegram chats by niche keywords, language and minimum member count.
7. Assign collected chats across accounts in a multi-account mode.
8. Configure an AI chat prompt: language mode, short answers, persona, context depth, link behavior and per-user reply limit.
9. Monitor chats, answer selected messages with probability controls and move users toward private messages or the channel link.
10. Watch join requests/subscriber requests increase, then iterate prompts and targeting.

## Functional Requirements For Razby

- Account import must support session-style payloads, account role, GEO and notes.
- Proxy tooling must support a proxy pool and account-to-proxy distribution guidance.
- Account manager needs a profile/identity setup mode for niche personas.
- GGR/readiness should include GEO/proxy/account health signals before launch.
- Channel parser should support:
  - niche keywords,
  - active-only search,
  - minimum members,
  - language,
  - seed channels/chats,
  - export selected chats into AI chat campaigns.
- Neurochatting should support:
  - prompt library,
  - persona,
  - manual/auto language mode,
  - context messages count,
  - response probability,
  - max replies per user,
  - optional link/handoff behavior,
  - stop-after-link option,
  - test prompt before launch.
- Module runs should keep visible setup requirements and live-readiness gates.

## Razby UX Translation

Razby should not copy the visual design of GramGPT. The reference is functional:

- keep the current premium dashboard style;
- make module forms feel like guided campaign setup;
- show safety limits and readiness before any live action;
- make "simulate" results explain how the real worker would behave;
- keep high-risk AI outreach behind manual approval until live credentials and policy are configured.

## Next Implementation Priority

1. Add richer module settings for Account Manager, Channel Parser and Neurochatting.
2. Add Prompt Library and Campaign Scenario builder.
3. Add export from Channel Parser into Neurochatting campaign settings.
4. Add live Telegram worker adapters after credentials/session storage are fully configured.
