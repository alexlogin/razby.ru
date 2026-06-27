import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function keyFromSecret() {
  const secret = process.env.NEXTAUTH_SECRET || "dev-razby-secret-change-on-vps";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptJson(value: Record<string, unknown>) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keyFromSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptJson<T extends Record<string, unknown>>(payload: string): T {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");

  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, keyFromSecret(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64")), decipher.final()]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}
