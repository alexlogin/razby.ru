import { decryptJson } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

type StoredTelegramValues = Record<string, unknown>;

type TelegramRuntimeConfig = {
  apiCredentialId: string;
  apiLabel: string;
  apiId: number;
  apiHash: string;
  sessionCredentialId: string;
  sessionLabel: string;
  sessionString: string;
  sessionUsername: string | null;
  sessionPhone: string | null;
};

export type TelegramApiConfig = {
  apiCredentialId: string;
  apiLabel: string;
  apiId: number;
  apiHash: string;
};

type TelegramClientLike = {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isUserAuthorized(): Promise<boolean>;
  getMe(inputPeer?: false): Promise<Record<string, unknown>>;
  sendMessage(entity: unknown, params: { message: string; linkPreview?: boolean }): Promise<Record<string, unknown>>;
};

function textValue(values: StoredTelegramValues, key: string) {
  const value = values[key];
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUsername(value: string | null | undefined) {
  return (value ?? "").replace(/^@/, "").trim().toLowerCase();
}

function maskPhone(value: string | null) {
  if (!value) {
    return null;
  }

  const compact = value.replace(/\s+/g, "");

  if (compact.length <= 5) {
    return "***";
  }

  return `${compact.slice(0, 2)}***${compact.slice(-2)}`;
}

export function publicTelegramError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown Telegram error");
  return raw.replace(/[A-Za-z0-9_+/=-]{24,}/g, "[redacted]").slice(0, 400);
}

function parseApiId(value: string) {
  const apiId = Number(value);

  if (!Number.isInteger(apiId) || apiId <= 0) {
    throw new Error("Telegram API ID is invalid");
  }

  return apiId;
}

export function telegramClientOptions() {
  return {
    appVersion: "Razby 1.0",
    connectionRetries: 2,
    floodSleepThreshold: 0,
    reconnectRetries: 0,
    requestRetries: 1,
    timeout: 10,
  };
}

export async function getTelegramApiConfig(workspaceId: string): Promise<TelegramApiConfig> {
  const apiCredential = await prisma.integrationCredential.findFirst({
    where: {
      workspaceId,
      service: "telegram-api",
      status: { in: ["READY", "SAVED"] },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  if (!apiCredential) {
    throw new Error("Telegram API credentials are not configured");
  }

  const apiValues = decryptJson<StoredTelegramValues>(apiCredential.encryptedJson);
  const apiHash = textValue(apiValues, "apiHash");

  if (!apiHash) {
    throw new Error("Telegram API Hash is not configured");
  }

  return {
    apiCredentialId: apiCredential.id,
    apiLabel: apiCredential.label,
    apiId: parseApiId(textValue(apiValues, "apiId")),
    apiHash,
  };
}

async function getTelegramRuntimeConfig(workspaceId: string, accountHint?: string | null): Promise<TelegramRuntimeConfig> {
  const credentials = await prisma.integrationCredential.findMany({
    where: {
      workspaceId,
      service: { in: ["telegram-api", "telegram-session"] },
      status: { in: ["READY", "SAVED"] },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  const apiCredential = credentials.find((credential) => credential.service === "telegram-api");
  const sessionCredentials = credentials.filter((credential) => credential.service === "telegram-session");

  if (!apiCredential) {
    throw new Error("Telegram API credentials are not configured");
  }

  if (sessionCredentials.length === 0) {
    throw new Error("Telegram session string is not configured");
  }

  const normalizedHint = normalizeUsername(accountHint);
  const sessionCredential =
    sessionCredentials.find((credential) => {
      const values = decryptJson<StoredTelegramValues>(credential.encryptedJson);
      return (
        normalizeUsername(credential.label) === normalizedHint ||
        normalizeUsername(textValue(values, "username")) === normalizedHint ||
        textValue(values, "phone") === accountHint
      );
    }) ?? sessionCredentials[0];

  const sessionValues = decryptJson<StoredTelegramValues>(sessionCredential.encryptedJson);
  const sessionString = textValue(sessionValues, "sessionString");

  if (!sessionString) {
    throw new Error("Telegram session string is empty");
  }

  const apiConfig = await getTelegramApiConfig(workspaceId);

  return {
    apiCredentialId: apiConfig.apiCredentialId,
    apiLabel: apiConfig.apiLabel,
    apiId: apiConfig.apiId,
    apiHash: apiConfig.apiHash,
    sessionCredentialId: sessionCredential.id,
    sessionLabel: sessionCredential.label,
    sessionString,
    sessionUsername: textValue(sessionValues, "username") || null,
    sessionPhone: textValue(sessionValues, "phone") || null,
  };
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function normalizePeer(peer: string) {
  const trimmed = peer.trim();
  const publicLink = trimmed.match(/^https?:\/\/t\.me\/([A-Za-z0-9_]{5,32})(?:[/?#].*)?$/i);

  if (publicLink) {
    return `@${publicLink[1]}`;
  }

  if (/^@[A-Za-z0-9_]{5,32}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^[A-Za-z0-9_]{5,32}$/.test(trimmed)) {
    return `@${trimmed}`;
  }

  if (/^-?\d{5,16}$/.test(trimmed)) {
    return Number(trimmed);
  }

  throw new Error("Telegram peer must be a @username, t.me link, or numeric chat id");
}

async function withTelegramClient<T>(
  workspaceId: string,
  accountHint: string | null | undefined,
  operation: (client: TelegramClientLike, config: TelegramRuntimeConfig) => Promise<T>,
) {
  const config = await getTelegramRuntimeConfig(workspaceId, accountHint);
  const [{ TelegramClient }, { StringSession }] = await Promise.all([import("telegram"), import("telegram/sessions")]);
  const client = new TelegramClient(new StringSession(config.sessionString), config.apiId, config.apiHash, telegramClientOptions()) as unknown as TelegramClientLike;

  try {
    await withTimeout(client.connect(), 15_000, "Telegram connection timed out");

    const authorized = await withTimeout(client.isUserAuthorized(), 10_000, "Telegram authorization check timed out");

    if (!authorized) {
      throw new Error("Telegram session is not authorized. Generate a fresh session string and save it again.");
    }

    return await operation(client, config);
  } finally {
    await client.disconnect().catch(() => undefined);
  }
}

function publicTelegramUser(me: Record<string, unknown>, config: TelegramRuntimeConfig) {
  return {
    id: me.id ? String(me.id) : null,
    username: typeof me.username === "string" && me.username ? `@${me.username}` : config.sessionUsername,
    firstName: typeof me.firstName === "string" ? me.firstName : null,
    lastName: typeof me.lastName === "string" ? me.lastName : null,
    phone: maskPhone(typeof me.phone === "string" ? me.phone : config.sessionPhone),
  };
}

export async function testTelegramSession(workspaceId: string, accountHint?: string | null) {
  return withTelegramClient(workspaceId, accountHint, async (client, config) => {
    const me = await withTimeout(client.getMe(false), 10_000, "Telegram getMe timed out");

    return {
      service: "telegram-session",
      apiCredentialId: config.apiCredentialId,
      sessionCredentialId: config.sessionCredentialId,
      apiLabel: config.apiLabel,
      sessionLabel: config.sessionLabel,
      account: publicTelegramUser(me, config),
    };
  });
}

export async function sendTelegramTextMessage(input: {
  workspaceId: string;
  peer: string;
  text: string;
  accountHint?: string | null;
}) {
  const message = input.text.trim();

  if (!message) {
    throw new Error("Message text is required");
  }

  if (message.length > 4096) {
    throw new Error("Telegram text message cannot be longer than 4096 characters");
  }

  const peer = normalizePeer(input.peer);

  return withTelegramClient(input.workspaceId, input.accountHint, async (client, config) => {
    const sent = await withTimeout(
      client.sendMessage(peer, {
        message,
        linkPreview: false,
      }),
      20_000,
      "Telegram send timed out",
    );

    return {
      mode: "live",
      peer: typeof peer === "string" ? peer : String(peer),
      sessionLabel: config.sessionLabel,
      accountUsername: config.sessionUsername,
      telegramMessageId: sent.id ? String(sent.id) : null,
      sentAt: new Date().toISOString(),
    };
  });
}

function rowAction(row: Record<string, unknown>, fallback: string) {
  const action = row.action ?? row.status ?? row.draft ?? row.post ?? row.story ?? row.source;
  return typeof action === "string" && action ? action : fallback;
}

export async function buildApprovedRunTelegramExecution(input: {
  workspaceId: string;
  moduleSlug: string;
  result: Record<string, unknown>;
  workerId: string;
}) {
  const session = await testTelegramSession(input.workspaceId);
  const rows = Array.isArray(input.result.rows) ? input.result.rows : [];

  return {
    workerId: input.workerId,
    state: "TELEGRAM_SESSION_VALIDATED",
    mode: "live",
    validatedAt: new Date().toISOString(),
    actionCount: rows.length,
    session: {
      label: session.sessionLabel,
      username: session.account.username,
    },
    rows: rows.slice(0, 50).map((row, index) => {
      const objectRow = row && typeof row === "object" ? (row as Record<string, unknown>) : {};

      return {
        index: index + 1,
        status: input.moduleSlug === "unified-inbox" ? "send_from_inbox_required" : "manual_worker_guard",
        action: rowAction(objectRow, input.moduleSlug),
        note:
          input.moduleSlug === "unified-inbox"
            ? "Use Unified Inbox Send for real Telegram delivery after reviewing the draft."
            : "Session is valid. This high-volume module is kept behind manual worker guard until per-account limits are configured.",
      };
    }),
  };
}
