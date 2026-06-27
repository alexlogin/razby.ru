import crypto from "node:crypto";
import { isLocalHost } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const CODE_TTL_MINUTES = Math.max(3, Math.min(Number(process.env.RAZBY_EMAIL_CODE_TTL_MINUTES ?? 10), 30));
const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 3;
const VERIFY_WINDOW_MS = 10 * 60_000;
const MAX_VERIFY_ATTEMPTS_PER_WINDOW = 8;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const verifyBuckets = new Map<string, { count: number; resetAt: number }>();

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isEmailAuthEnabled() {
  return process.env.RAZBY_EMAIL_AUTH_ENABLED === "true";
}

export function hasEmailDeliveryConfig() {
  return Boolean(process.env.RAZBY_RESEND_API_KEY && process.env.RAZBY_EMAIL_FROM);
}

export function isEmailDevModeAllowed(host: string | null | undefined) {
  return process.env.RAZBY_EMAIL_DEV_MODE === "true" && isLocalHost(host);
}

export function authEmailAllowlist() {
  return (process.env.RAZBY_AUTH_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeAuthEmail(email))
    .filter(Boolean);
}

export function isAuthEmailAllowed(email: string, host?: string | null) {
  const allowlist = authEmailAllowlist();
  const normalized = normalizeAuthEmail(email);

  if (allowlist.includes(normalized)) {
    return true;
  }

  return allowlist.length === 0 && isEmailDevModeAllowed(host);
}

export function emailAuthSetupState(host?: string | null) {
  const devMode = isEmailDevModeAllowed(host);
  const enabled = isEmailAuthEnabled();
  const allowlistReady = authEmailAllowlist().length > 0 || devMode;
  const deliveryReady = hasEmailDeliveryConfig() || devMode;

  return {
    enabled,
    allowlistReady,
    deliveryReady,
    ready: enabled && allowlistReady && deliveryReady,
    devMode,
  };
}

export function codeIdentifier(email: string) {
  return `email-login:${normalizeAuthEmail(email)}`;
}

export function hashEmailCode(email: string, code: string) {
  const secret = process.env.NEXTAUTH_SECRET || "dev-razby-secret-change-on-vps";
  return crypto.createHmac("sha256", secret).update(`${normalizeAuthEmail(email)}:${code.trim()}`).digest("hex");
}

export function generateEmailCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function checkEmailCodeRateLimit(email: string, request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${ip}:${normalizeAuthEmail(email)}`;
  const now = Date.now();
  const bucket = requestBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + REQUEST_WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function checkEmailCodeVerifyLimit(email: string) {
  const key = normalizeAuthEmail(email);
  const now = Date.now();
  const bucket = verifyBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    verifyBuckets.set(key, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_VERIFY_ATTEMPTS_PER_WINDOW) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export async function storeEmailCode(email: string, code: string) {
  const identifier = codeIdentifier(email);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: hashEmailCode(email, code),
      expires: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    },
  });
}

export async function consumeEmailCode(email: string, code: string) {
  const identifier = codeIdentifier(email);
  const token = hashEmailCode(email, code);
  const verification = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier,
        token,
      },
    },
  });

  if (!verification || verification.expires.getTime() < Date.now()) {
    return false;
  }

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  return true;
}

export async function upsertEmailAuthUser(email: string) {
  const normalized = normalizeAuthEmail(email);
  const name = normalized.split("@")[0]?.replace(/[._-]+/g, " ") || "Razby Owner";

  return prisma.user.upsert({
    where: { email: normalized },
    update: {
      role: "OWNER",
    },
    create: {
      email: normalized,
      name,
      image: null,
      role: "OWNER",
    },
  });
}

export async function sendEmailCode(email: string, code: string, host?: string | null) {
  if (isEmailDevModeAllowed(host)) {
    return { mode: "dev" as const, code };
  }

  if (!hasEmailDeliveryConfig()) {
    throw new Error("Email delivery is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RAZBY_RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "razby/1.0",
    },
    body: JSON.stringify({
      from: process.env.RAZBY_EMAIL_FROM,
      to: [normalizeAuthEmail(email)],
      subject: "Razby sign-in code",
      text: `Ваш код входа в Razby: ${code}\n\nКод действует ${CODE_TTL_MINUTES} минут. Если вы не запрашивали вход, просто игнорируйте письмо.`,
      html: `<p>Ваш код входа в <strong>Razby</strong>:</p><p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p><p>Код действует ${CODE_TTL_MINUTES} минут.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error("Email provider rejected the message");
  }

  return { mode: "resend" as const };
}
