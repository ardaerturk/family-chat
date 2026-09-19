import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibleForMemory,
  memorySettings,
  MEMORY_IDLE_MS,
  redactMemorySecrets,
} from "../src/lib/memory-policy";
import type { Conversation } from "../src/lib/types";
const now = Date.UTC(2026, 8, 19, 12),
  cutoff = now - 2 * 86400000;
const chat: Conversation = {
  id: "chat",
  title: "Test",
  model: "test",
  generateMemory: true,
  updatedAt: new Date(now - MEMORY_IDLE_MS).toISOString(),
  messages: [
    {
      id: "a",
      role: "user",
      content: "I prefer practical explanations with examples. ".repeat(5),
      createdAt: new Date(cutoff + 1000).toISOString(),
    },
    {
      id: "b",
      role: "assistant",
      content: "Understood",
      status: "complete",
      createdAt: new Date(cutoff + 2000).toISOString(),
    },
    {
      id: "c",
      role: "user",
      content: "I plan vegetarian meals for my household every Sunday.",
      createdAt: new Date(cutoff + 3000).toISOString(),
    },
    {
      id: "d",
      role: "assistant",
      content: "Understood",
      status: "complete",
      createdAt: new Date(cutoff + 4000).toISOString(),
    },
  ],
};
const enabled = memorySettings({ enabled: true });
test("memory is opt-in and generation is separate from recall", () => {
  assert.equal(memorySettings().enabled, false);
  assert.equal(eligibleForMemory(chat, enabled, cutoff, now), true);
  assert.equal(eligibleForMemory(chat, memorySettings(), cutoff, now), false);
  assert.equal(
    eligibleForMemory(chat, { ...enabled, generate: false }, cutoff, now),
    false,
  );
  assert.equal(
    eligibleForMemory(chat, { ...enabled, use: false }, cutoff, now),
    true,
  );
});
test("active, short, temporary, excluded and stale conversations cannot generate memory", () => {
  for (const change of [
    { updatedAt: new Date(now - MEMORY_IDLE_MS + 1).toISOString() },
    { updatedAt: new Date(now - 31 * 86400000).toISOString() },
    { temporary: true },
    { generateMemory: false },
    { messages: chat.messages.slice(0, 2) },
    { messages: chat.messages.map((m) => ({ ...m, content: "Short" })) },
    {
      messages: [
        ...chat.messages.slice(0, -1),
        { ...chat.messages.at(-1)!, status: "stopped" as const },
      ],
    },
  ])
    assert.equal(
      eligibleForMemory({ ...chat, ...change }, enabled, cutoff, now),
      false,
    );
});
test("reset cutoff prevents old chats from recreating deleted memory", () => {
  assert.equal(eligibleForMemory(chat, enabled, now, now), false);
  assert.equal(
    eligibleForMemory(
      { ...chat, memoryEligibleAt: new Date(cutoff + 5000).toISOString() },
      enabled,
      cutoff,
      now,
    ),
    true,
  );
});
test("external search exclusion is independently enforced", () => {
  const searched = {
    ...chat,
    messages: chat.messages.map((m) => ({ ...m, searched: true })),
  };
  assert.equal(eligibleForMemory(searched, enabled, cutoff, now), true);
  assert.equal(
    eligibleForMemory(
      searched,
      { ...enabled, excludeSearch: true },
      cutoff,
      now,
    ),
    false,
  );
});
test("credential formats and private invitation URLs are redacted without erasing ordinary preferences", () => {
  const source =
    "I like tea. password=hunter2 api_key=ABCDEF123456 https://example.com/#invite=private-token sk-abcdefghijklmnop AccountKey=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefgh";
  const clean = redactMemorySecrets(source);
  assert.ok(clean.startsWith("I like tea."));
  for (const secret of [
    "hunter2",
    "ABCDEF123456",
    "private-token",
    "sk-abcdefghijklmnop",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefgh",
  ])
    assert.ok(!clean.includes(secret));
  assert.equal(
    redactMemorySecrets("I prefer Turkish and vegetarian dinners."),
    "I prefer Turkish and vegetarian dinners.",
  );
});
