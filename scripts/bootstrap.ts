import { TableClient } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { encrypt, digest, token } from "../src/lib/server/crypto";
const output = process.env.BOOTSTRAP_OUTPUT;
if (!output) throw new Error("Set BOOTSTRAP_OUTPUT to a private file path");
const connection = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const table = TableClient.fromConnectionString(connection, "FamilyChat");
await table.createTable();
await BlobServiceClient.fromConnectionString(connection)
  .getContainerClient("private")
  .createIfNotExists();
const raw = token(),
  id = `invite_${digest(raw)}`;
// A single durable marker prevents accidentally minting a second owner.
await table.submitTransaction([
  [
    "create",
    {
      partitionKey: "auth",
      rowKey: "bootstrap",
      payload: encrypt(
        Buffer.from(JSON.stringify({ createdAt: new Date().toISOString() })),
        "auth/bootstrap",
      ).toString("base64"),
    },
  ],
  [
    "create",
    {
      partitionKey: "auth",
      rowKey: id,
      payload: encrypt(
        Buffer.from(
          JSON.stringify({
            userId: randomUUID(),
            name: process.env.OWNER_NAME || "Owner",
            role: "owner",
            expiresAt: Date.now() + 7 * 86400000,
          }),
        ),
        `auth/${id}`,
      ).toString("base64"),
    },
  ],
]);
writeFileSync(output, `${process.env.APP_ORIGIN}/#invite=${raw}\n`, {
  mode: 0o600,
});
console.log(
  "Owner invitation saved to the private output file. It expires in 7 days.",
);
