export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  value?: unknown,
): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method,
    headers:
      value !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: value !== undefined ? JSON.stringify(value) : undefined,
    cache: "no-store",
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "Could not reach the server. Please try again.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(data.error || "Please try again.", response.status);
  return data as T;
}
export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
export async function login() {
  const { startAuthentication } = await import("@simplewebauthn/browser");
  const options = await api<
    Parameters<typeof startAuthentication>[0]["optionsJSON"]
  >("auth/login/options", "POST", {});
  const response = await startAuthentication({ optionsJSON: options });
  await api("auth/login/verify", "POST", response);
}
export async function register(invite?: string) {
  const { startRegistration } = await import("@simplewebauthn/browser");
  const options = await api<
    Parameters<typeof startRegistration>[0]["optionsJSON"]
  >("auth/register/options", "POST", invite ? { invite } : {});
  const response = await startRegistration({ optionsJSON: options });
  await api("auth/register/verify", "POST", response);
}
export function passkeyError(e: unknown) {
  if (
    e instanceof Error &&
    (e.name === "NotAllowedError" || e.name === "AbortError")
  )
    return "Passkey setup was cancelled. Tap the button to try again.";
  return errorMessage(e);
}
