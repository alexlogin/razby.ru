import type { User } from "@prisma/client";
import crypto from "node:crypto";

const DEMO_EMAIL = "demo@razby.local";

export function isOwner(user: Pick<User, "role"> | null | undefined) {
  return user?.role === "OWNER";
}

export function isDemoUser(user: Pick<User, "email"> | null | undefined) {
  return user?.email === DEMO_EMAIL;
}

export function isLocalHost(host: string | null | undefined) {
  const cleanHost = (host ?? "").toLowerCase().split(":")[0];
  return cleanHost === "localhost" || cleanHost === "127.0.0.1" || cleanHost === "::1";
}

function hasValidAdminToken(request: Request) {
  const configuredToken = process.env.RAZBY_ADMIN_TOKEN;

  if (!configuredToken) {
    return false;
  }

  const providedToken = request.headers.get("x-razby-admin-token");
  if (!providedToken) {
    return false;
  }

  const provided = Buffer.from(providedToken);
  const configured = Buffer.from(configuredToken);
  return provided.length === configured.length && crypto.timingSafeEqual(provided, configured);
}

export function canAccessAdminRequest(request: Request, user: Pick<User, "email" | "role"> | null | undefined) {
  if (!isOwner(user)) {
    return false;
  }

  if (!isDemoUser(user)) {
    return true;
  }

  if (isLocalHost(request.headers.get("host"))) {
    return true;
  }

  return hasValidAdminToken(request);
}

export function isDemoAdminLocked(host: string | null | undefined, user: Pick<User, "email" | "role"> | null | undefined) {
  return isOwner(user) && isDemoUser(user) && !isLocalHost(host);
}

export function requireOwner(user: Pick<User, "role"> | null | undefined) {
  if (!isOwner(user)) {
    throw new Error("Owner access required");
  }
}
