import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICE_SESSION_SECONDS,
  SESSION_REFRESH_INTERVAL_MS,
  needsSessionRenewal,
  renewedSession,
  sessionExpired,
  type DeviceSession,
} from "../src/lib/session-policy";
const now = Date.UTC(2026, 8, 8);
const original: DeviceSession = {
  userId: "member",
  createdAt: new Date(now - 60 * 86400000).toISOString(),
  expiresAt: now + 1000,
  device: "Phone",
};
test("a still-valid legacy session upgrades without asking for a passkey", () => {
  assert.equal(needsSessionRenewal(original, now), true);
  const next = renewedSession(original, now);
  assert.equal(next.expiresAt, now + DEVICE_SESSION_SECONDS * 1000);
  assert.equal(next.createdAt, original.createdAt);
  assert.equal(next.userId, original.userId);
});
test("ordinary requests do not repeatedly write sessions or cookies", () => {
  const next = renewedSession(original, now);
  assert.equal(
    needsSessionRenewal(next, now + SESSION_REFRESH_INTERVAL_MS - 1),
    false,
  );
  assert.equal(
    needsSessionRenewal(next, now + SESSION_REFRESH_INTERVAL_MS),
    true,
  );
});
test("regular use extends sign-in without refreshing privileged verification age", () => {
  let next = renewedSession(original, now);
  for (let day = 1; day <= 730; day++)
    next = renewedSession(next, now + day * 86400000);
  assert.equal(next.createdAt, original.createdAt);
  assert.equal(
    next.expiresAt,
    now + 730 * 86400000 + DEVICE_SESSION_SECONDS * 1000,
  );
});
test("expired sessions cannot be revived, including at the exact expiry instant", () => {
  const expired = { ...original, expiresAt: now };
  assert.equal(sessionExpired(expired, now), true);
  assert.equal(needsSessionRenewal(expired, now), false);
  assert.throws(() => renewedSession(expired, now));
});
