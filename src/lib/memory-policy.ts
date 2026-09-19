import type { Conversation, MemorySettings } from "./types";
export const MEMORY_DEFAULTS: MemorySettings = {
  enabled: false,
  use: true,
  generate: true,
  excludeSearch: false,
};
export const MEMORY_IDLE_MS = 6 * 3600000;
export const MEMORY_MAX_AGE_MS = 30 * 86400000;
export function memorySettings(
  value?: Partial<MemorySettings>,
): MemorySettings {
  return { ...MEMORY_DEFAULTS, ...value };
}
export function eligibleForMemory(
  c: Conversation,
  settings: MemorySettings,
  cutoff: number,
  now: number,
) {
  const users = c.messages.filter((m) => m.role === "user");
  return (
    settings.enabled &&
    settings.generate &&
    !c.temporary &&
    c.generateMemory === true &&
    Date.parse(c.memoryEligibleAt ?? users[0]?.createdAt ?? "") >= cutoff &&
    now - Date.parse(c.updatedAt) >= MEMORY_IDLE_MS &&
    now - Date.parse(c.updatedAt) <= MEMORY_MAX_AGE_MS &&
    c.messages.at(-1)?.status === "complete" &&
    users.length >= 2 &&
    users.reduce((n, m) => n + m.content.length, 0) >= 200 &&
    !(settings.excludeSearch && c.messages.some((m) => m.searched))
  );
}
// Defense in depth: generated fields never retain known credential formats.
export function redactMemorySecrets(text: string) {
  return text
    .replace(
      /\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|Bearer\s+[A-Za-z0-9._~+/-]{12,})/gi,
      "[redacted]",
    )
    .replace(
      /(?:AccountKey|api[_ -]?key|password|secret|token)\s*(?:[:=]|is\b)\s*["']?[^\s,"';]+/gi,
      "[redacted]",
    )
    .replace(
      /https?:\/\/\S*(?:[?#&](?:invite|token|key|sig)=)\S*/gi,
      "[redacted]",
    )
    .replace(/\b[A-Za-z0-9_+/=-]{40,}\b/g, "[redacted]");
}
