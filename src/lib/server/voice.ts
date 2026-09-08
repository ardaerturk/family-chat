import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import { session } from "./auth";
import { body, fail } from "./http";
import { env, endpoint, voiceAvailable } from "./config";
import { rate } from "./store";
export async function voice(req: NextRequest) {
  const { person } = await session(req);
  if (!voiceAvailable()) fail(503, "Voice is not configured.");
  const { sdp } = await body(
    req,
    z.object({ sdp: z.string().min(20).max(32000) }),
  );
  if (!sdp.startsWith("v=0")) fail(400, "Invalid voice connection.");
  if (!(await rate(`voice_${person.id}`, 10, 86400)))
    fail(429, "The daily voice session limit has been reached.");
  const base = endpoint("AZURE_REALTIME_ENDPOINT");
  const secretResponse = await fetch(`${base}realtime/client_secrets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env("AZURE_REALTIME_API_KEY"),
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 60 },
      session: {
        type: "realtime",
        model: env("AZURE_REALTIME_MODEL"),
        instructions:
          "You are a helpful private voice assistant. Speak naturally and in the language the person uses. Keep answers concise unless asked for more detail. This is a separate voice conversation; you do not have access to saved text chats.",
        audio: { output: { voice: "marin" } },
        max_output_tokens: 2048,
      },
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!secretResponse.ok)
    fail(502, "Voice is unavailable at the moment. Try again later.");
  const secret = await secretResponse.json();
  if (!secret.value) fail(502, "Voice could not connect.");
  const answer = await fetch(`${base}realtime/calls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret.value}`,
      "Content-Type": "application/sdp",
    },
    body: sdp,
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!answer.ok) fail(502, "Voice could not connect. Please try again.");
  return new Response(await answer.text(), {
    headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" },
  });
}
