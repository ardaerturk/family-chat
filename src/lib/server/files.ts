import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import * as db from "./store";
import { fail, json } from "./http";
import { session } from "./auth";
import type { Attachment } from "../types";
export const MAX_FILE_SIZE = 3 * 1024 * 1024;
export type FileRecord = Attachment & {
  createdAt: number;
  conversationId?: string;
};
const textExtensions = new Set([
  "txt",
  "md",
  "csv",
  "tsv",
  "json",
  "py",
  "js",
  "ts",
  "tsx",
  "jsx",
  "css",
  "html",
  "xml",
  "yaml",
  "yml",
  "log",
  "sql",
]);
export function classify(name: string, data: Buffer) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" && data.subarray(0, 5).toString() === "%PDF-")
    return "application/pdf";
  if (
    ["jpg", "jpeg"].includes(ext) &&
    data[0] === 255 &&
    data[1] === 216 &&
    data[2] === 255
  )
    return "image/jpeg";
  if (
    ext === "png" &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (
    ext === "webp" &&
    data.subarray(0, 4).toString() === "RIFF" &&
    data.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (textExtensions.has(ext) && !data.includes(0)) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(data);
      return "text/plain";
    } catch {}
  }
  fail(400, "Choose a PDF, JPG, PNG, WebP, or UTF-8 text/code file.");
}
export async function upload(req: NextRequest) {
  const { person } = await session(req);
  if (!(await db.rate(`upload_${person.id}`, 30, 3600)))
    fail(429, "Upload limit reached. Try again in an hour.");
  const length = Number(req.headers.get("content-length"));
  if (length > MAX_FILE_SIZE + 65536)
    fail(413, "Files can be up to 3 MB each.");
  // Read a bounded multipart body before parsing, including chunked requests.
  const reader = req.body?.getReader();
  if (!reader) fail(400, "Choose a file.");
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_FILE_SIZE + 65536) {
      await reader.cancel();
      fail(413, "Files can be up to 3 MB each.");
    }
    parts.push(value);
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(parts), {
      headers: { "Content-Type": req.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    fail(400, "The upload could not be read.");
  }
  const file = form.get("file");
  if (!(file instanceof File) || !file.size)
    fail(400, "Choose a non-empty file.");
  if (file.size > MAX_FILE_SIZE) fail(413, "Files can be up to 3 MB each.");
  const data = Buffer.from(await file.arrayBuffer());
  const mime = classify(file.name, data);
  const name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").slice(0, 150);
  const id = randomUUID();
  const value: FileRecord = {
    id,
    name,
    mime,
    size: data.length,
    createdAt: Date.now(),
  };
  await db.blobPut(`files/${person.id}/${id}`, data);
  await db.create(person.id, `file_${id}`, value);
  return json({ id, name, mime, size: data.length });
}
export async function readFile(userId: string, id: string) {
  const row = await db.get<FileRecord>(userId, `file_${id}`);
  if (!row) fail(404, "Attachment not found.");
  const data = await db.blobGet(`files/${userId}/${id}`);
  if (!data) fail(404, "Attachment not found.");
  return { info: row.value, data };
}
export async function deleteFile(userId: string, id: string) {
  await db.blobDelete(`files/${userId}/${id}`);
  await db.remove(userId, `file_${id}`);
}
