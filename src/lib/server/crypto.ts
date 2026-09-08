import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
export const token = () => randomBytes(32).toString("base64url");
export const digest = (v: string) =>
  createHash("sha256").update(v).digest("hex");
function key() {
  const value = process.env.DATA_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error("A 32-byte encryption key is required");
  return Buffer.from(value, "hex");
}
export function encrypt(value: Buffer, context: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const body = Buffer.concat([cipher.update(value), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
export function decrypt(value: Buffer, context: string): Buffer {
  if (value.length < 28) throw new Error("Invalid ciphertext");
  const cipher = createDecipheriv("aes-256-gcm", key(), value.subarray(0, 12));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(value.subarray(12, 28));
  return Buffer.concat([cipher.update(value.subarray(28)), cipher.final()]);
}
