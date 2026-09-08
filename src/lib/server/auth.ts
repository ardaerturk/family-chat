import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type AuthenticatorTransport,
} from "@simplewebauthn/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { digest, token } from "./crypto";
import { origin } from "./config";
import * as db from "./store";
import { body, fail, json } from "./http";
import type { Person } from "../types";
export type Session = {
  userId: string;
  createdAt: string;
  expiresAt: number;
  device: string;
};
export type Invite = {
  userId: string;
  name: string;
  role: "owner" | "member";
  expiresAt: number;
  createdBy?: string;
  existing?: boolean;
};
type Key = {
  userId: string;
  id: string;
  publicKey: string;
  counter: number;
  transports?: AuthenticatorTransport[];
  createdAt: string;
};
type Challenge = {
  challenge: string;
  mode: "login" | "register";
  expiresAt: number;
  inviteId?: string;
  userId?: string;
  name?: string;
  role?: "owner" | "member";
};
function cookieName(type = "session") {
  return `${origin().startsWith("https:") ? "__Host-" : ""}family-${type}`;
}
function setCookie(
  res: NextResponse,
  value: string,
  age: number,
  type = "session",
) {
  res.cookies.set(cookieName(type), value, {
    httpOnly: true,
    secure: origin().startsWith("https:"),
    sameSite: "strict",
    path: "/",
    maxAge: age,
  });
}
export async function session(req: NextRequest) {
  const raw = req.cookies.get(cookieName())?.value;
  if (!raw || raw.length > 100) fail(401, "Please unlock your chat.");
  const id = `session_${digest(raw)}`;
  const s = await db.get<Session>("auth", id);
  if (!s || s.value.expiresAt < Date.now())
    fail(401, "Your session has expired. Unlock with your passkey.");
  const person = await db.get<Person>("auth", `user_${s.value.userId}`);
  if (!person || person.value.disabled)
    fail(401, "This account is no longer active.");
  return { person: person.value, session: s.value, id };
}
export async function owner(req: NextRequest) {
  const s = await session(req);
  if (s.person.role !== "owner") fail(403, "Owner access is required.");
  if (Date.now() - Date.parse(s.session.createdAt) > 15 * 60 * 1000)
    fail(428, "Unlock with your passkey again to manage family access.");
  return s;
}
async function setSession(req: NextRequest, userId: string) {
  const raw = token();
  const now = Date.now();
  const session: Session = {
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: now + 30 * 86400 * 1000,
    device: (req.headers.get("user-agent") || "Browser").slice(0, 240),
  };
  const previous = (await db.list<Session>("auth", "session_"))
    .filter((s) => s.value.userId === userId)
    .sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt));
  for (const old of previous.slice(19)) await db.remove("auth", old.id);
  await db.create("auth", `session_${digest(raw)}`, session);
  const res = json({ ok: true });
  setCookie(res, raw, 30 * 86400);
  setCookie(res, "", 0, "challenge");
  return res;
}
export async function authRate(req: NextRequest) {
  const ip =
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-forwarded-for") ||
    "local";
  if (!(await db.rate(`auth_${digest(ip.split(",")[0].trim())}`, 30, 600)))
    fail(429, "Too many attempts. Please wait a few minutes.");
}
async function challengeCookie(value: Challenge, options: unknown) {
  const raw = token();
  await db.create("auth", `challenge_${digest(raw)}`, value);
  const res = json(options);
  setCookie(res, raw, 300, "challenge");
  return res;
}
async function takeChallenge(req: NextRequest, mode: Challenge["mode"]) {
  const raw = req.cookies.get(cookieName("challenge"))?.value;
  if (!raw) fail(400, "This sign-in attempt has expired. Try again.");
  const c = await db.consume<Challenge>("auth", `challenge_${digest(raw)}`);
  if (!c || c.mode !== mode || c.expiresAt < Date.now())
    fail(400, "This sign-in attempt has expired. Try again.");
  return c;
}
export async function registerOptions(req: NextRequest) {
  await authRate(req);
  const input = await body(
    req,
    z.object({ invite: z.string().min(32).max(100).optional() }),
  );
  let userId: string,
    name: string,
    role: "owner" | "member",
    inviteId: string | undefined;
  if (input.invite) {
    inviteId = `invite_${digest(input.invite)}`;
    const invitation = await db.get<Invite>("auth", inviteId);
    if (!invitation || invitation.value.expiresAt < Date.now())
      fail(
        400,
        "This invitation has expired or has already been used. Ask for a new one.",
      );
    ({ userId, name, role } = invitation.value);
    const existing = await db.get<Person>("auth", `user_${userId}`);
    if (existing?.value.disabled) fail(403, "This account is not active.");
  } else {
    const s = await session(req);
    if (Date.now() - Date.parse(s.session.createdAt) > 15 * 60 * 1000)
      fail(428, "Sign in again before adding a passkey.");
    ({ id: userId, name, role } = s.person);
  }
  const keys = (await db.list<Key>("auth", "key_")).filter(
    (k) => k.value.userId === userId,
  );
  if (keys.length >= 10)
    fail(400, "You already have ten passkeys. Remove an old one first.");
  const options = await generateRegistrationOptions({
    rpName: "ChatGPT",
    rpID: new URL(origin()).hostname,
    userID: new TextEncoder().encode(userId),
    userName: name,
    userDisplayName: name,
    attestationType: "none",
    excludeCredentials: keys.map((k) => ({
      id: k.value.id,
      transports: k.value.transports,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    supportedAlgorithmIDs: [-7, -257],
  });
  return challengeCookie(
    {
      challenge: options.challenge,
      mode: "register",
      expiresAt: Date.now() + 300000,
      inviteId,
      userId,
      name,
      role,
    },
    options,
  );
}
export async function registerVerify(req: NextRequest) {
  await authRate(req);
  const response = await body(req, z.record(z.string(), z.unknown()));
  const c = await takeChallenge(req, "register");
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as unknown as RegistrationResponseJSON,
      expectedChallenge: c.challenge,
      expectedOrigin: origin(),
      expectedRPID: new URL(origin()).hostname,
      requireUserVerification: true,
    });
  } catch {
    fail(400, "Your passkey could not be verified. Try again.");
  }
  if (!verification.verified || !verification.registrationInfo || !c.userId)
    fail(400, "Your passkey could not be verified.");
  const cred = verification.registrationInfo.credential;
  const now = new Date().toISOString();
  const existing = await db.get<Person>("auth", `user_${c.userId}`);
  const ops: Parameters<typeof db.transaction>[0] = [];
  if (c.inviteId) {
    const invite = await db.get<Invite>("auth", c.inviteId);
    if (!invite || invite.value.expiresAt < Date.now())
      fail(400, "This invitation is no longer valid.");
    ops.push({ kind: "delete", id: c.inviteId, etag: invite.etag });
    if (invite.value.existing) {
      for (const key of await db.list<Key>("auth", "key_"))
        if (key.value.userId === c.userId)
          ops.push({ kind: "delete", id: key.id });
      for (const s of await db.list<Session>("auth", "session_"))
        if (s.value.userId === c.userId) ops.push({ kind: "delete", id: s.id });
    }
  } else {
    const s = await session(req);
    if (s.person.id !== c.userId) fail(403, "The account changed. Try again.");
  }
  if (existing?.value.disabled) fail(403, "This account is not active.");
  if (!existing)
    ops.push({
      kind: "create",
      id: `user_${c.userId}`,
      value: { id: c.userId, name: c.name, role: c.role, createdAt: now },
    });
  ops.push({
    kind: "create",
    id: `key_${digest(cred.id)}`,
    value: {
      userId: c.userId,
      id: cred.id,
      publicKey: Buffer.from(cred.publicKey).toString("base64"),
      counter: cred.counter,
      transports: cred.transports as AuthenticatorTransport[] | undefined,
      createdAt: now,
    } satisfies Key,
  });
  try {
    await db.transaction(ops);
  } catch (e) {
    if ([409, 412, 404].includes(db.status(e) ?? 0))
      fail(400, "This invitation or passkey has already been used.");
    throw e;
  }
  return setSession(req, c.userId);
}
export async function loginOptions(req: NextRequest) {
  await authRate(req);
  const options = await generateAuthenticationOptions({
    rpID: new URL(origin()).hostname,
    userVerification: "required",
  });
  return challengeCookie(
    {
      challenge: options.challenge,
      mode: "login",
      expiresAt: Date.now() + 300000,
    },
    options,
  );
}
export async function loginVerify(req: NextRequest) {
  await authRate(req);
  const response = await body(
    req,
    z.object({ id: z.string().max(1500) }).passthrough(),
  );
  const c = await takeChallenge(req, "login");
  const keyId = `key_${digest(response.id)}`;
  const key = await db.get<Key>("auth", keyId);
  if (!key) fail(400, "This passkey is not registered here.");
  const user = await db.get<Person>("auth", `user_${key.value.userId}`);
  if (!user || user.value.disabled) fail(403, "This account is not active.");
  let v;
  try {
    v = await verifyAuthenticationResponse({
      response: response as unknown as AuthenticationResponseJSON,
      expectedChallenge: c.challenge,
      expectedOrigin: origin(),
      expectedRPID: new URL(origin()).hostname,
      credential: {
        id: key.value.id,
        publicKey: new Uint8Array(Buffer.from(key.value.publicKey, "base64")),
        counter: key.value.counter,
        transports: key.value.transports,
      },
      requireUserVerification: true,
    });
  } catch {
    fail(400, "Your passkey could not be verified. Try again.");
  }
  if (!v.verified) fail(400, "Your passkey could not be verified.");
  await db.put(
    "auth",
    keyId,
    { ...key.value, counter: v.authenticationInfo.newCounter },
    key.etag,
  );
  return setSession(req, key.value.userId);
}
export async function logout(req: NextRequest) {
  try {
    const s = await session(req);
    await db.remove("auth", s.id);
  } catch {}
  const res = json({ ok: true });
  setCookie(res, "", 0);
  return res;
}
export async function createInvite(
  person: Person,
  name: string,
  existing?: Person,
) {
  const raw = token();
  const invitation: Invite = {
    userId: existing?.id ?? randomUUID(),
    name: existing?.name ?? name,
    role: existing?.role ?? "member",
    expiresAt: Date.now() + 86400000,
    createdBy: person.id,
    existing: !!existing,
  };
  await db.create("auth", `invite_${digest(raw)}`, invitation);
  return { url: `${origin()}/#invite=${raw}`, expiresAt: invitation.expiresAt };
}
