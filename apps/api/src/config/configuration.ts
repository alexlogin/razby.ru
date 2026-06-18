export interface AppConfig {
  env: string;
  port: number;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  redis: { url: string };
  storage: {
    driver: 'mock' | 's3';
    endpoint?: string;
    region?: string;
    bucket: string;
    accessKey?: string;
    secretKey?: string;
    publicBaseUrl: string;
  };
  sms: { driver: 'mock' | 'smsc'; apiKey?: string };
  email: { driver: 'mock' | 'smtp'; from: string };
  payments: { driver: 'mock' | 'yookassa'; secretKey?: string };
  ai: {
    driver: 'heuristic' | 'openrouter';
    apiKey?: string;
    model: string;
    baseUrl: string;
    appUrl: string;
  };
  uploads: { maxFileSizeMb: number; allowedMime: string[] };
}

function splitEnv(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default (): { app: AppConfig } => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),
    corsOrigins: splitEnv(process.env.CORS_ORIGINS, ['http://localhost:3000']),
    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
      refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
      accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
      refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    },
    redis: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    storage: {
      driver: (process.env.STORAGE_DRIVER as 'mock' | 's3') ?? 'mock',
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? 'ru-central1',
      bucket: process.env.S3_BUCKET ?? 'razby-uploads',
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
      publicBaseUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:4000/files',
    },
    sms: {
      driver: (process.env.SMS_DRIVER as 'mock' | 'smsc') ?? 'mock',
      apiKey: process.env.SMS_API_KEY,
    },
    email: {
      driver: (process.env.EMAIL_DRIVER as 'mock' | 'smtp') ?? 'mock',
      from: process.env.EMAIL_FROM ?? 'Razby.ru <no-reply@razby.ru>',
    },
    payments: {
      driver: (process.env.PAYMENTS_DRIVER as 'mock' | 'yookassa') ?? 'mock',
      secretKey: process.env.PAYMENTS_SECRET_KEY,
    },
    ai: {
      driver: (process.env.AI_DRIVER as 'heuristic' | 'openrouter') ?? 'heuristic',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.AI_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free',
      baseUrl: process.env.AI_BASE_URL ?? 'https://openrouter.ai/api/v1',
      appUrl: process.env.AI_APP_URL ?? 'https://razby.ru',
    },
    uploads: {
      maxFileSizeMb: parseInt(process.env.UPLOAD_MAX_MB ?? '25', 10),
      allowedMime: splitEnv(process.env.UPLOAD_ALLOWED_MIME, [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf',
        'video/mp4',
      ]),
    },
  },
});
