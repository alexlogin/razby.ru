import crypto from "node:crypto";

const PASSWORD_VERSION = "scrypt-v1";
const SCRYPT_KEY_LENGTH = 64;
const PASSWORD_ATTEMPT_WINDOW_MS = 10 * 60_000;
const MAX_PASSWORD_ATTEMPTS_PER_WINDOW = 8;
const passwordAttemptBuckets = new Map<string, { count: number; resetAt: number }>();

function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

export function normalizePasswordEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateNewPassword(password: string) {
  const trimmed = password.trim();

  if (trimmed.length < 10) {
    return "Пароль должен быть не короче 10 символов.";
  }

  if (!/[a-zа-я]/i.test(trimmed) || !/\d/.test(trimmed)) {
    return "Добавьте в пароль буквы и цифры.";
  }

  return null;
}

export async function hashUserPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt)).toString("hex");
  return `${PASSWORD_VERSION}:${salt}:${hash}`;
}

export async function verifyUserPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) {
    return false;
  }

  const [version, salt, hash] = storedHash.split(":");

  if (version !== PASSWORD_VERSION || !salt || !hash) {
    return false;
  }

  const candidate = (await scryptAsync(password, salt)).toString("hex");
  const provided = Buffer.from(candidate, "hex");
  const configured = Buffer.from(hash, "hex");
  return provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
}

type RequestLike = {
  headers?: Headers | Record<string, string | string[] | undefined>;
};

function getRequestHeader(request: RequestLike | undefined, name: string) {
  if (!request?.headers) {
    return null;
  }

  if (request.headers instanceof Headers) {
    return request.headers.get(name);
  }

  const value = request.headers[name] ?? request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function checkPasswordSignInLimit(email: string, request?: RequestLike) {
  const ip = getRequestHeader(request, "x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${ip}:${normalizePasswordEmail(email)}`;
  const now = Date.now();
  const bucket = passwordAttemptBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    passwordAttemptBuckets.set(key, { count: 1, resetAt: now + PASSWORD_ATTEMPT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_PASSWORD_ATTEMPTS_PER_WINDOW) {
    return false;
  }

  bucket.count += 1;
  return true;
}
