import test from "node:test";
import assert from "node:assert/strict";
import { encrypt, decrypt, token, digest } from "../src/lib/server/crypto";
process.env.DATA_ENCRYPTION_KEY = "ab".repeat(32);
test("conversation encryption round-trips Unicode without exposing plaintext", () => {
  const text = Buffer.from("Private family chat: merhaba, 你好");
  const ciphertext = encrypt(text, "user-a/chat-1");
  assert.deepEqual(decrypt(ciphertext, "user-a/chat-1"), text);
  assert.ok(!ciphertext.includes(text));
});
test("ciphertext is bound to its account and resource", () => {
  const ciphertext = encrypt(Buffer.from("private"), "user-a/file-1");
  assert.throws(() => decrypt(ciphertext, "user-b/file-1"));
  assert.throws(() => decrypt(ciphertext, "user-a/file-2"));
});
test("modified ciphertext and authentication tags are rejected", () => {
  const ciphertext = encrypt(Buffer.from("private"), "scope");
  ciphertext[ciphertext.length - 1] ^= 1;
  assert.throws(() => decrypt(ciphertext, "scope"));
  assert.throws(() => decrypt(Buffer.from("bad"), "scope"));
});
test("encryption uses a fresh nonce for every write", () => {
  assert.notDeepEqual(
    encrypt(Buffer.from("same"), "scope"),
    encrypt(Buffer.from("same"), "scope"),
  );
});
test("invitation and session tokens have 256 bits and are stored by digest", () => {
  const a = token(),
    b = token();
  assert.equal(Buffer.from(a, "base64url").length, 32);
  assert.notEqual(a, b);
  assert.match(digest(a), /^[a-f0-9]{64}$/);
  assert.equal(digest(a), digest(a));
});
test("invalid encryption key fails closed", () => {
  const original = process.env.DATA_ENCRYPTION_KEY;
  process.env.DATA_ENCRYPTION_KEY = "invalid";
  assert.throws(() => encrypt(Buffer.from("x"), "scope"));
  process.env.DATA_ENCRYPTION_KEY = original;
});
