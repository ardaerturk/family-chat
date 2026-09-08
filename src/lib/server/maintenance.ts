import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { env } from "./config";
import { fail, json } from "./http";
import * as db from "./store";
import { deleteFile, type FileRecord } from "./files";
import type { Person, Conversation } from "../types";
export async function maintenance(req: NextRequest) {
  const expected = Buffer.from(`Bearer ${env("CRON_SECRET")}`),
    received = Buffer.from(req.headers.get("authorization") ?? "");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    fail(401, "Unauthorized.");
  const now = Date.now();
  let removed = 0;
  for (const row of await db.list<{ expiresAt?: number }>("auth")) {
    if (row.value.expiresAt && row.value.expiresAt < now) {
      await db.remove("auth", row.id, row.etag);
      removed++;
    }
  }
  for (const row of await db.list<{ until: number }>("locks")) {
    if (row.value.until < now - 3600000)
      await db.remove("locks", row.id, row.etag);
  }
  // Counters expire after at most a day; rows older than 3 days are safe to remove.
  for (const row of await db.list<{ expiresAt?: number }>("rates")) {
    if (row.value.expiresAt && row.value.expiresAt < now)
      await db.remove("rates", row.id, row.etag);
  }
  for (const { value: user } of await db.list<Person>("auth", "user_")) {
    for (const row of await db.list<FileRecord>(user.id, "file_")) {
      if (row.value.createdAt > now - 86400000) continue;
      const conversationId = row.value.conversationId;
      const raw = conversationId
        ? await db.blobGet(`chats/${user.id}/${conversationId}`)
        : null;
      const chat: Conversation | null = raw ? JSON.parse(raw.toString()) : null;
      if (
        !chat?.messages.some((m) => m.files?.some((f) => f.id === row.value.id))
      ) {
        await deleteFile(user.id, row.value.id);
        removed++;
      }
    }
  }
  return json({ ok: true, removed });
}
