// Run only from a trusted operator machine with production server secrets.
import { TableClient } from "@azure/data-tables";
import { writeFileSync } from "node:fs";
import { decrypt, encrypt, digest, token } from "../src/lib/server/crypto";
const output = process.env.BOOTSTRAP_OUTPUT;
if (!output) throw new Error("Set BOOTSTRAP_OUTPUT to a private path");
const table = TableClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!,
  "FamilyChat",
);
const owners = [];
for await (const row of table.listEntities<{ payload: string }>({
  queryOptions: { filter: "PartitionKey eq 'auth'" },
})) {
  if (!row.rowKey?.startsWith("user_")) continue;
  const user = JSON.parse(
    decrypt(
      Buffer.from(row.payload, "base64"),
      `auth/${row.rowKey}`,
    ).toString(),
  );
  if (user.role === "owner" && !user.disabled) owners.push(user);
}
if (owners.length !== 1)
  throw new Error(
    "Expected exactly one active owner. Inspect the account store.",
  );
const owner = owners[0],
  raw = token(),
  id = `invite_${digest(raw)}`;
await table.createEntity({
  partitionKey: "auth",
  rowKey: id,
  payload: encrypt(
    Buffer.from(
      JSON.stringify({
        userId: owner.id,
        name: owner.name,
        role: "owner",
        existing: true,
        expiresAt: Date.now() + 86400000,
      }),
    ),
    `auth/${id}`,
  ).toString("base64"),
});
writeFileSync(output, `${process.env.APP_ORIGIN}/#invite=${raw}\n`, {
  mode: 0o600,
});
console.log(
  "Recovery invitation saved privately. Redeeming it revokes previous passkeys and sessions.",
);
