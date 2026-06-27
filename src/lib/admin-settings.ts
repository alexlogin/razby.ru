import { prisma } from "@/lib/prisma";

export type ExecutionMode = "simulate" | "live";

export type RuntimeAdminSettings = {
  executionMode: ExecutionMode;
  liveSafetyAcknowledged: boolean;
  defaultApproval: "manual" | "auto";
  operatorEmail: string;
  telegramAlertChat: string;
};

const RUNTIME_SETTINGS_KEY = "runtime";

function envExecutionMode(): ExecutionMode {
  return (process.env.RAZBY_EXECUTION_MODE ?? "simulate").toLowerCase() === "live" ? "live" : "simulate";
}

export function defaultRuntimeSettings(): RuntimeAdminSettings {
  return {
    executionMode: envExecutionMode(),
    liveSafetyAcknowledged: false,
    defaultApproval: "manual",
    operatorEmail: "",
    telegramAlertChat: "",
  };
}

function parseRuntimeSettings(value: string | null | undefined): Partial<RuntimeAdminSettings> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as Partial<RuntimeAdminSettings>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export async function getRuntimeAdminSettings(workspaceId: string): Promise<RuntimeAdminSettings> {
  const row = await prisma.workspaceSetting.findUnique({
    where: {
      workspaceId_key: {
        workspaceId,
        key: RUNTIME_SETTINGS_KEY,
      },
    },
  });

  return {
    ...defaultRuntimeSettings(),
    ...parseRuntimeSettings(row?.valueJson),
  };
}

export async function getWorkspaceExecutionMode(workspaceId: string): Promise<ExecutionMode> {
  const settings = await getRuntimeAdminSettings(workspaceId);
  return settings.executionMode;
}

export async function saveRuntimeAdminSettings(workspaceId: string, settings: RuntimeAdminSettings) {
  return prisma.workspaceSetting.upsert({
    where: {
      workspaceId_key: {
        workspaceId,
        key: RUNTIME_SETTINGS_KEY,
      },
    },
    update: {
      valueJson: JSON.stringify(settings),
    },
    create: {
      workspaceId,
      key: RUNTIME_SETTINGS_KEY,
      valueJson: JSON.stringify(settings),
    },
  });
}
