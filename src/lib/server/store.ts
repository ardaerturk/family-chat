import "server-only";
import { TableClient, odata } from "@azure/data-tables";
import { BlobServiceClient } from "@azure/storage-blob";
import { encrypt, decrypt } from "./crypto";
import { env } from "./config";
let tableClient: TableClient | undefined;
function table() {
  return (tableClient ??= TableClient.fromConnectionString(
    env("AZURE_STORAGE_CONNECTION_STRING"),
    "FamilyChat",
  ));
}
function container() {
  return BlobServiceClient.fromConnectionString(
    env("AZURE_STORAGE_CONNECTION_STRING"),
  ).getContainerClient("private");
}
export type Stored<T> = { value: T; etag: string };
export function status(e: unknown) {
  return (e as { statusCode?: number }).statusCode;
}
export async function get<T>(
  partition: string,
  id: string,
): Promise<Stored<T> | null> {
  try {
    const row = await table().getEntity<{ payload: string }>(partition, id);
    return {
      value: JSON.parse(
        decrypt(
          Buffer.from(row.payload, "base64"),
          `${partition}/${id}`,
        ).toString(),
      ),
      etag: row.etag!,
    };
  } catch (e) {
    if (status(e) === 404) return null;
    throw e;
  }
}
function entity(partition: string, id: string, value: unknown) {
  return {
    partitionKey: partition,
    rowKey: id,
    payload: encrypt(
      Buffer.from(JSON.stringify(value)),
      `${partition}/${id}`,
    ).toString("base64"),
  };
}
export async function create(partition: string, id: string, value: unknown) {
  await table().createEntity(entity(partition, id, value));
}
export async function put(
  partition: string,
  id: string,
  value: unknown,
  etag?: string,
) {
  const row = entity(partition, id, value);
  if (etag) await table().updateEntity(row, "Replace", { etag });
  else await table().upsertEntity(row, "Replace");
}
export async function remove(partition: string, id: string, etag?: string) {
  try {
    await table().deleteEntity(partition, id, etag ? { etag } : undefined);
  } catch (e) {
    if (status(e) !== 404) throw e;
  }
}
export async function list<T>(
  partition: string,
  prefix = "",
): Promise<Array<Stored<T> & { id: string }>> {
  const rows = table().listEntities<{ payload: string }>({
    queryOptions: { filter: odata`PartitionKey eq ${partition}` },
  });
  const output: Array<Stored<T> & { id: string }> = [];
  for await (const row of rows) {
    if (!row.rowKey!.startsWith(prefix)) continue;
    output.push({
      id: row.rowKey!,
      etag: row.etag!,
      value: JSON.parse(
        decrypt(
          Buffer.from(row.payload, "base64"),
          `${partition}/${row.rowKey}`,
        ).toString(),
      ),
    });
  }
  return output;
}
export async function consume<T>(partition: string, id: string) {
  const row = await get<T>(partition, id);
  if (!row) return null;
  try {
    await table().deleteEntity(partition, id, { etag: row.etag });
    return row.value;
  } catch (e) {
    if ([404, 412].includes(status(e) ?? 0)) return null;
    throw e;
  }
}
export async function transaction(
  ops: Array<{
    kind: "create" | "delete" | "update";
    id: string;
    value?: unknown;
    etag?: string;
  }>,
) {
  await table().submitTransaction(
    ops.map((op) =>
      op.kind === "delete"
        ? ["delete", { partitionKey: "auth", rowKey: op.id, etag: op.etag }]
        : op.kind === "create"
          ? ["create", entity("auth", op.id, op.value)]
          : [
              "update",
              entity("auth", op.id, op.value),
              "Replace",
              { etag: op.etag },
            ],
    ),
  );
}
export async function blobPut(path: string, value: Buffer) {
  const data = encrypt(value, path);
  await container()
    .getBlockBlobClient(path)
    .uploadData(data, {
      blobHTTPHeaders: {
        blobContentType: "application/octet-stream",
        blobCacheControl: "no-store",
      },
    });
}
export async function blobGet(path: string) {
  try {
    return decrypt(
      await container().getBlockBlobClient(path).downloadToBuffer(),
      path,
    );
  } catch (e) {
    if (status(e) === 404) return null;
    throw e;
  }
}
export async function blobDelete(path: string) {
  await container().getBlockBlobClient(path).deleteIfExists();
}
export async function initialize() {
  await table().createTable();
  await container().createIfNotExists();
}
export async function lock(scope: string, seconds = 240) {
  const id = `lock_${scope}`;
  const now = Date.now();
  const old = await get<{ until: number }>("locks", id);
  if (old && old.value.until < now) await remove("locks", id, old.etag);
  await create("locks", id, { until: now + seconds * 1000 });
  const own = await get("locks", id);
  return async () => {
    if (own) await remove("locks", id, own.etag);
  };
}
export async function rate(key: string, limit: number, windowSeconds: number) {
  const id = `${key}_${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  for (let i = 0; i < 6; i++) {
    const old = await get<{ count: number }>("rates", id);
    if (old && old.value.count >= limit) return false;
    try {
      if (old)
        await put(
          "rates",
          id,
          { count: old.value.count + 1, expiresAt: Date.now() + 3 * 86400000 },
          old.etag,
        );
      else
        await create("rates", id, {
          count: 1,
          expiresAt: Date.now() + 3 * 86400000,
        });
      return true;
    } catch (e) {
      if (![409, 412].includes(status(e) ?? 0)) throw e;
    }
  }
  return false;
}
