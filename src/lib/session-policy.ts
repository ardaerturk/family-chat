// Sliding device sessions; passkey verification age is tracked separately.
export const DEVICE_SESSION_SECONDS = 365 * 24 * 60 * 60;
export const SESSION_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
export type DeviceSession = {
  userId: string;
  createdAt: string;
  expiresAt: number;
  renewedAt?: number;
  device: string;
};
export function sessionExpired(session: DeviceSession, now: number) {
  return session.expiresAt <= now;
}
export function needsSessionRenewal(session: DeviceSession, now: number) {
  return (
    !sessionExpired(session, now) &&
    (session.renewedAt === undefined ||
      now - session.renewedAt >= SESSION_REFRESH_INTERVAL_MS)
  );
}
export function renewedSession(
  session: DeviceSession,
  now: number,
): DeviceSession {
  if (sessionExpired(session, now))
    throw new Error("Expired sessions cannot be renewed");
  return {
    ...session,
    expiresAt: now + DEVICE_SESSION_SECONDS * 1000,
    renewedAt: now,
  };
}
