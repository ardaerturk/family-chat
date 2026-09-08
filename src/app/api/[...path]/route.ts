import { NextRequest } from "next/server";
import { z } from "zod";
import * as auth from "@/lib/server/auth";
import * as db from "@/lib/server/store";
import { body, csrf, errorResponse, fail, json, uuid } from "@/lib/server/http";
import { models, voiceAvailable } from "@/lib/server/config";
import {
  chat,
  conversation,
  save,
  deleteConversation,
  userLock,
} from "@/lib/server/chat";
import {
  upload,
  readFile,
  deleteFile,
  type FileRecord,
} from "@/lib/server/files";
import { voice } from "@/lib/server/voice";
import { maintenance } from "@/lib/server/maintenance";
import type { ConversationSummary, Person } from "@/lib/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 240;
type Context = { params: Promise<{ path: string[] }> };
async function handle(req: NextRequest, context: Context) {
  try {
    const parts = (await context.params).path;
    const path = parts.join("/");
    const method = req.method;
    if (method !== "GET") csrf(req);
    if (method === "GET" && path === "maintenance")
      return await maintenance(req);
    if (method === "GET" && path === "health") return json({ ok: true });
    if (method === "POST") {
      if (path === "auth/register/options")
        return await auth.registerOptions(req);
      if (path === "auth/register/verify")
        return await auth.registerVerify(req);
      if (path === "auth/login/options") return await auth.loginOptions(req);
      if (path === "auth/login/verify") return await auth.loginVerify(req);
      if (path === "auth/logout") return await auth.logout(req);
      if (path === "chat") return await chat(req);
      if (path === "files") return await upload(req);
      if (path === "voice") return await voice(req);
    }
    const current = await auth.session(req);
    const user = current.person;
    if (method === "GET" && path === "me")
      return json({ person: user, models: models(), voice: voiceAvailable() });
    if (method === "GET" && path === "chats") {
      const rows = await db.list<ConversationSummary>(user.id, "chat_");
      return json(
        rows
          .map((r) => r.value)
          .sort(
            (a, b) =>
              Number(!!b.pinned) - Number(!!a.pinned) ||
              b.updatedAt.localeCompare(a.updatedAt),
          ),
      );
    }
    if (parts[0] === "chats" && parts.length === 2) {
      const id = uuid.parse(parts[1]);
      if (method === "GET") return json(await conversation(user.id, id));
      const unlock = await userLock(user.id);
      try {
        if (method === "DELETE") {
          await deleteConversation(user.id, id);
          return json({ ok: true });
        }
        if (method === "PATCH") {
          const change = await body(
            req,
            z.object({
              title: z.string().trim().min(1).max(100).optional(),
              pinned: z.boolean().optional(),
            }),
          );
          const c = await conversation(user.id, id);
          Object.assign(c, change);
          await save(user.id, c);
          return json({ ok: true });
        }
      } finally {
        await unlock();
      }
    }
    if (parts[0] === "files" && parts.length === 2) {
      const id = uuid.parse(parts[1]);
      if (method === "GET") {
        const f = await readFile(user.id, id);
        return new Response(new Uint8Array(f.data), {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(f.info.name)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      if (method === "DELETE") {
        const f = await db.get<FileRecord>(user.id, `file_${id}`);
        if (f?.value.conversationId)
          fail(400, "Delete the conversation to remove its attachments.");
        await deleteFile(user.id, id);
        return json({ ok: true });
      }
    }
    if (path === "sessions" && method === "GET") {
      const rows = await db.list<auth.Session>("auth", "session_");
      return json(
        rows
          .filter(
            (r) => r.value.userId === user.id && r.value.expiresAt > Date.now(),
          )
          .map((r) => ({
            id: r.id,
            device: r.value.device,
            createdAt: r.value.createdAt,
            expiresAt: r.value.expiresAt,
            current: r.id === current.id,
          })),
      );
    }
    if (parts[0] === "sessions" && parts.length === 2 && method === "DELETE") {
      const id = z
        .string()
        .regex(/^session_[a-f0-9]{64}$/)
        .parse(parts[1]);
      const s = await db.get<auth.Session>("auth", id);
      if (!s || s.value.userId !== user.id) fail(404, "Session not found.");
      await db.remove("auth", id);
      return json({ ok: true });
    }
    if (path === "export" && method === "GET") {
      const rows = await db.list<ConversationSummary>(user.id, "chat_");
      const chats = [];
      for (const row of rows)
        chats.push(await conversation(user.id, row.value.id));
      return json({
        exportedAt: new Date().toISOString(),
        conversations: chats,
      });
    }
    if (path === "chats" && method === "DELETE") {
      const unlock = await userLock(user.id);
      try {
        const rows = await db.list<ConversationSummary>(user.id, "chat_");
        for (const row of rows) await deleteConversation(user.id, row.value.id);
        return json({ ok: true });
      } finally {
        await unlock();
      }
    }
    if (parts[0] === "admin") {
      await auth.owner(req);
      if (path === "admin/people" && method === "GET") {
        const rows = await db.list<Person>("auth", "user_");
        const invites = await db.list<auth.Invite>("auth", "invite_");
        return json({
          people: rows.map((r) => r.value),
          invitations: invites
            .filter((r) => r.value.expiresAt > Date.now())
            .map((r) => ({
              id: r.id,
              name: r.value.name,
              expiresAt: r.value.expiresAt,
            })),
        });
      }
      if (path === "admin/invites" && method === "POST") {
        const input = await body(
          req,
          z.object({ name: z.string().trim().min(1).max(60) }),
        );
        if (!(await db.rate(`invite_${user.id}`, 20, 86400)))
          fail(429, "Invitation limit reached.");
        return json(await auth.createInvite(user, input.name));
      }
      if (parts[1] === "invites" && parts.length === 3 && method === "DELETE") {
        const id = z
          .string()
          .regex(/^invite_[a-f0-9]{64}$/)
          .parse(parts[2]);
        await db.remove("auth", id);
        return json({ ok: true });
      }
      if (parts[1] === "people" && parts.length === 3) {
        const id = uuid.parse(parts[2]);
        if (id === user.id)
          fail(400, "You cannot revoke your own owner account.");
        const p = await db.get<Person>("auth", `user_${id}`);
        if (!p) fail(404, "Person not found.");
        if (method === "PATCH") {
          const input = await body(req, z.object({ disabled: z.boolean() }));
          await db.put(
            "auth",
            `user_${id}`,
            { ...p.value, disabled: input.disabled },
            p.etag,
          );
          if (input.disabled) {
            for (const s of await db.list<auth.Session>("auth", "session_"))
              if (s.value.userId === id) await db.remove("auth", s.id);
            for (const invite of await db.list<auth.Invite>("auth", "invite_"))
              if (invite.value.userId === id)
                await db.remove("auth", invite.id);
          }
          return json({ ok: true });
        }
        if (method === "POST") {
          if (p.value.disabled)
            fail(400, "Restore this person’s access first.");
          return json(await auth.createInvite(user, p.value.name, p.value));
        }
      }
    }
    fail(404, "Not found.");
  } catch (e) {
    if (e instanceof z.ZodError)
      return json({ error: "Invalid request." }, 400);
    return errorResponse(e);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
