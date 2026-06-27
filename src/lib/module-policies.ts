export type ModulePolicy = {
  risk: "low" | "medium" | "high";
  approval: "auto" | "manual" | "required";
  safeLimit: number;
  requires: string[];
};

export const modulePolicies: Record<string, ModulePolicy> = {
  "mass-looking": { risk: "medium", approval: "manual", safeLimit: 1200, requires: ["telegram-api", "accounts", "proxies"] },
  ggr: { risk: "low", approval: "auto", safeLimit: 200, requires: ["accounts"] },
  "neuro-dialogs": { risk: "high", approval: "required", safeLimit: 80, requires: ["telegram-api", "ai-provider", "accounts"] },
  "manager-telegram-accounts": { risk: "low", approval: "auto", safeLimit: 1000, requires: ["telegram-api"] },
  "account-takeover-protection": { risk: "low", approval: "auto", safeLimit: 500, requires: ["accounts"] },
  massreact: { risk: "medium", approval: "manual", safeLimit: 500, requires: ["telegram-api", "accounts", "proxies"] },
  "bulk-story-copy": { risk: "high", approval: "required", safeLimit: 120, requires: ["telegram-api", "accounts", "proxies"] },
  "parsing-comments": { risk: "low", approval: "auto", safeLimit: 5000, requires: ["telegram-api"] },
  "parsing-messages": { risk: "medium", approval: "manual", safeLimit: 3000, requires: ["telegram-api"] },
  "parsing-users": { risk: "medium", approval: "manual", safeLimit: 3000, requires: ["telegram-api"] },
  "parsing-groups": { risk: "low", approval: "auto", safeLimit: 1000, requires: ["telegram-api"] },
  "ai-account-protection": { risk: "low", approval: "auto", safeLimit: 1000, requires: ["accounts"] },
  "channel-parser": { risk: "low", approval: "auto", safeLimit: 8000, requires: ["telegram-api"] },
  "telegram-folders": { risk: "medium", approval: "manual", safeLimit: 250, requires: ["telegram-api", "accounts"] },
  "auto-warm": { risk: "medium", approval: "manual", safeLimit: 250, requires: ["telegram-api", "accounts", "proxies"] },
  "unified-inbox": { risk: "high", approval: "required", safeLimit: 1000, requires: ["telegram-api", "ai-provider", "accounts"] },
  neurochatting: { risk: "high", approval: "required", safeLimit: 120, requires: ["telegram-api", "ai-provider", "accounts"] },
  neurocommenting: { risk: "high", approval: "required", safeLimit: 120, requires: ["telegram-api", "ai-provider", "accounts"] },
  "proxy-checker": { risk: "low", approval: "auto", safeLimit: 100, requires: [] },
};

export function getModulePolicy(slug: string) {
  return modulePolicies[slug] ?? { risk: "low", approval: "auto", safeLimit: 100, requires: [] };
}
