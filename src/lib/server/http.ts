import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { origin } from "./config";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}
export function csrf(req: NextRequest) {
  if (req.headers.get("origin") !== origin())
    fail(
      403,
      "This request could not be verified. Reload the app and try again.",
    );
}
export async function body<T extends z.ZodType>(
  req: NextRequest,
  schema: T,
  max = 64 * 1024,
): Promise<z.infer<T>> {
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    fail(415, "Expected JSON.");
  const reader = req.body?.getReader();
  if (!reader) fail(400, "Missing request body.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      fail(413, "This request is too large.");
    }
    chunks.push(value);
  }
  try {
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString()));
  } catch {
    fail(400, "Please check the submitted information.");
  }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error("Request failed", {
    type: e instanceof Error ? e.name : "Unknown",
    status: (e as { statusCode?: number })?.statusCode,
  });
  return json({ error: "Something went wrong. Please try again." }, 500);
}
export const uuid = z.string().uuid();
