import type { StoreOps } from "./store";

/** Commit the deletion intent with the metadata change; a crash must not lose the blob ID. */
export async function queueBlobDeletion(tx: StoreOps, id: string) {
  await tx.put("blobDeletes", { id, createdAt: new Date().toISOString() });
}
