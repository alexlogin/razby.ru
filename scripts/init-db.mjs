import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dbUrl = process.env.DATABASE_URL ?? "file:./razby.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
const absolutePath = resolve(process.cwd(), "prisma", dbPath.replace(/^\.\//, ""));

mkdirSync(dirname(absolutePath), { recursive: true });

const db = new DatabaseSync(absolutePath);
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS User (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT,
  email TEXT UNIQUE,
  emailVerified DATETIME,
  image TEXT,
  passwordHash TEXT,
  passwordUpdatedAt DATETIME,
  role TEXT NOT NULL DEFAULT 'OWNER',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Account (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  providerAccountId TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  CONSTRAINT Account_userId_fkey FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS Account_provider_providerAccountId_key ON Account(provider, providerAccountId);

CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY NOT NULL,
  sessionToken TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL,
  expires DATETIME NOT NULL,
  CONSTRAINT Session_userId_fkey FOREIGN KEY (userId) REFERENCES User (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS VerificationToken (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS VerificationToken_identifier_token_key ON VerificationToken(identifier, token);

CREATE TABLE IF NOT EXISTS Workspace (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'FOUNDATION',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT Workspace_ownerId_fkey FOREIGN KEY (ownerId) REFERENCES User (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS TelegramAccount (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  label TEXT NOT NULL,
  username TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'WARMING',
  healthScore INTEGER NOT NULL DEFAULT 72,
  ggrScore REAL NOT NULL DEFAULT 6.8,
  proxy TEXT,
  notes TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT TelegramAccount_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ProxyEndpoint (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  label TEXT NOT NULL,
  protocol TEXT NOT NULL DEFAULT 'SOCKS5',
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  latencyMs INTEGER,
  country TEXT,
  lastCheckedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ProxyEndpoint_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ModuleRun (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  moduleSlug TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  inputJson TEXT NOT NULL,
  resultJson TEXT,
  logsJson TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME,
  CONSTRAINT ModuleRun_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ModuleRun_workspaceId_moduleSlug_createdAt_idx ON ModuleRun(workspaceId, moduleSlug, createdAt);

CREATE TABLE IF NOT EXISTS ApprovalItem (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  moduleRunId TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  risk TEXT NOT NULL DEFAULT 'medium',
  payloadJson TEXT NOT NULL,
  decisionJson TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decidedAt DATETIME,
  CONSTRAINT ApprovalItem_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ApprovalItem_moduleRunId_fkey FOREIGN KEY (moduleRunId) REFERENCES ModuleRun (id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS ApprovalItem_workspaceId_status_createdAt_idx ON ApprovalItem(workspaceId, status, createdAt);
CREATE INDEX IF NOT EXISTS ApprovalItem_moduleRunId_idx ON ApprovalItem(moduleRunId);

CREATE TABLE IF NOT EXISTS TelegramConversation (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  telegramAccountId TEXT,
  peerUsername TEXT NOT NULL,
  peerTitle TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  tags TEXT NOT NULL DEFAULT '[]',
  lastMessageAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT TelegramConversation_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT TelegramConversation_telegramAccountId_fkey FOREIGN KEY (telegramAccountId) REFERENCES TelegramAccount (id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS TelegramConversation_workspaceId_status_lastMessageAt_idx ON TelegramConversation(workspaceId, status, lastMessageAt);
CREATE INDEX IF NOT EXISTS TelegramConversation_telegramAccountId_idx ON TelegramConversation(telegramAccountId);

CREATE TABLE IF NOT EXISTS TelegramMessage (
  id TEXT PRIMARY KEY NOT NULL,
  conversationId TEXT NOT NULL,
  direction TEXT NOT NULL,
  authorUsername TEXT,
  text TEXT NOT NULL,
  aiDraft TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT TelegramMessage_conversationId_fkey FOREIGN KEY (conversationId) REFERENCES TelegramConversation (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS TelegramMessage_conversationId_createdAt_idx ON TelegramMessage(conversationId, createdAt);

CREATE TABLE IF NOT EXISTS Lead (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  source TEXT NOT NULL,
  username TEXT NOT NULL,
  displayName TEXT NOT NULL,
  bio TEXT,
  score INTEGER NOT NULL DEFAULT 50,
  tags TEXT NOT NULL DEFAULT '[]',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT Lead_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS Lead_workspaceId_source_idx ON Lead(workspaceId, source);

CREATE TABLE IF NOT EXISTS Campaign (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  moduleSlug TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  settingsJson TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT Campaign_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS ReferralCode (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  ownerId TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  commission INTEGER NOT NULL DEFAULT 20,
  clicks INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ReferralCode_ownerId_fkey FOREIGN KEY (ownerId) REFERENCES User (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ReferralCode_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS AuditLog (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  actorId TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entityId TEXT,
  metadataJson TEXT NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT AuditLog_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS AuditLog_workspaceId_createdAt_idx ON AuditLog(workspaceId, createdAt);

CREATE TABLE IF NOT EXISTS IntegrationCredential (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  service TEXT NOT NULL,
  label TEXT NOT NULL,
  encryptedJson TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEEDS_CHECK',
  lastCheckedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT IntegrationCredential_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS IntegrationCredential_workspaceId_service_label_key ON IntegrationCredential(workspaceId, service, label);
CREATE INDEX IF NOT EXISTS IntegrationCredential_workspaceId_service_idx ON IntegrationCredential(workspaceId, service);

CREATE TABLE IF NOT EXISTS WorkerHeartbeat (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  workerId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ONLINE',
  metadataJson TEXT NOT NULL DEFAULT '{}',
  seenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT WorkerHeartbeat_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS WorkerHeartbeat_workspaceId_workerId_key ON WorkerHeartbeat(workspaceId, workerId);
CREATE INDEX IF NOT EXISTS WorkerHeartbeat_workspaceId_seenAt_idx ON WorkerHeartbeat(workspaceId, seenAt);

CREATE TABLE IF NOT EXISTS WorkspaceSetting (
  id TEXT PRIMARY KEY NOT NULL,
  workspaceId TEXT NOT NULL,
  key TEXT NOT NULL,
  valueJson TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT WorkspaceSetting_workspaceId_fkey FOREIGN KEY (workspaceId) REFERENCES Workspace (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS WorkspaceSetting_workspaceId_key_key ON WorkspaceSetting(workspaceId, key);
CREATE INDEX IF NOT EXISTS WorkspaceSetting_workspaceId_idx ON WorkspaceSetting(workspaceId);
`);

function addColumnIfMissing(table, column, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (error) {
    if (!String(error?.message ?? "").toLowerCase().includes("duplicate column")) {
      throw error;
    }
  }
}

addColumnIfMissing("User", "passwordHash", "TEXT");
addColumnIfMissing("User", "passwordUpdatedAt", "DATETIME");

db.close();

console.log(`SQLite database ready: ${absolutePath}`);
