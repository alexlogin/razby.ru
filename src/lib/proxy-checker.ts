import net from "node:net";

export type ProxyCheckRow = {
  proxy: string;
  host: string;
  port: number;
  status: "online" | "failed" | "invalid";
  latencyMs: number | null;
  error?: string;
};

function parseProxy(line: string) {
  const raw = line.trim();

  if (!raw) {
    return null;
  }

  try {
    if (raw.includes("://")) {
      const url = new URL(raw);
      return {
        raw,
        host: url.hostname,
        port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
      };
    }
  } catch {
    return null;
  }

  const parts = raw.split(":");
  if (parts.length >= 2) {
    return {
      raw,
      host: parts[0],
      port: Number(parts[1]),
    };
  }

  return null;
}

function checkOne(line: string, timeoutMs: number): Promise<ProxyCheckRow> {
  const parsed = parseProxy(line);

  if (!parsed || !parsed.host || !Number.isFinite(parsed.port)) {
    return Promise.resolve({
      proxy: line,
      host: "",
      port: 0,
      status: "invalid",
      latencyMs: null,
      error: "Invalid proxy format",
    });
  }

  const startedAt = Date.now();

  return new Promise((resolve) => {
    const socket = net.createConnection({
      host: parsed.host,
      port: parsed.port,
      timeout: timeoutMs,
    });

    socket.once("connect", () => {
      const latencyMs = Date.now() - startedAt;
      socket.destroy();
      resolve({
        proxy: parsed.raw,
        host: parsed.host,
        port: parsed.port,
        status: "online",
        latencyMs,
      });
    });

    socket.once("timeout", () => {
      socket.destroy();
      resolve({
        proxy: parsed.raw,
        host: parsed.host,
        port: parsed.port,
        status: "failed",
        latencyMs: null,
        error: "Timeout",
      });
    });

    socket.once("error", (error) => {
      socket.destroy();
      resolve({
        proxy: parsed.raw,
        host: parsed.host,
        port: parsed.port,
        status: "failed",
        latencyMs: null,
        error: error.message,
      });
    });
  });
}

export async function checkProxies(input: string, timeoutMs = 3000) {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100);

  const rows = await Promise.all(lines.map((line) => checkOne(line, timeoutMs)));
  const online = rows.filter((row) => row.status === "online").length;
  const failed = rows.filter((row) => row.status === "failed").length;
  const invalid = rows.filter((row) => row.status === "invalid").length;
  const latencies = rows
    .map((row) => row.latencyMs)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const medianLatency = latencies.length ? latencies[Math.floor(latencies.length / 2)] : null;

  return {
    summary: "Прокси проверены через TCP-подключение к host:port. Telegram MTProto-handshake добавляется на worker-слое.",
    stats: {
      total: rows.length,
      online,
      failed,
      invalid,
      medianLatency: medianLatency ?? "n/a",
    },
    rows,
  };
}
