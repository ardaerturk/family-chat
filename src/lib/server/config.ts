import "server-only";
import { z } from "zod";
const modelsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(100),
      label: z.string().max(100),
      description: z.string().max(200),
      reasoning: z.boolean().default(false),
    }),
  )
  .min(1);
export function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing server configuration: ${name}`);
  return v;
}
export function origin() {
  const url = new URL(env("APP_ORIGIN"));
  if (url.origin !== env("APP_ORIGIN"))
    throw new Error("APP_ORIGIN must be an origin");
  return url.origin;
}
export function models() {
  return modelsSchema.parse(JSON.parse(env("AZURE_CHAT_MODELS")));
}
export function endpoint(name = "AZURE_OPENAI_ENDPOINT") {
  const url = new URL(env(name));
  if (
    url.protocol !== "https:" ||
    ![
      ".openai.azure.com",
      ".services.ai.azure.com",
      ".cognitiveservices.azure.com",
    ].some((s) => url.hostname.endsWith(s))
  )
    throw new Error("An Azure HTTPS endpoint is required");
  return `${url.origin}/openai/v1/`;
}
export function voiceAvailable() {
  return !!(
    process.env.AZURE_REALTIME_ENDPOINT &&
    process.env.AZURE_REALTIME_API_KEY &&
    process.env.AZURE_REALTIME_MODEL
  );
}
