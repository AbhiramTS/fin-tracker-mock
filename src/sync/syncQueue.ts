// ─────────────────────────────────────────────────────────────────────────────
//  sync/syncQueue.ts
//  Offline-first change queue persisted in IndexedDB.
//  Every write goes here first; the adapter flushes when online.
// ─────────────────────────────────────────────────────────────────────────────

import { dbGetAll, dbPut } from "@/db/indexedDB";
import { generateId }      from "@/utils/id";
import type { ChangeRecord, ChangeType, PushResult } from "@/types";
import type { SyncAdapter }  from "./SyncAdapter";
import type { FirebaseSyncAdapter } from "./FirebaseSyncAdapter";

let _adapter: SyncAdapter | null = null;
let _flushing = false;

export function registerSyncAdapter(
  adapter: SyncAdapter,
  onRealtimeUpdate?: (entity: string) => void,
): void {
  _adapter?.destroy();
  _adapter = adapter;
  // Wire up real-time listener if it's a Firebase adapter
  if (onRealtimeUpdate && "subscribeRealtime" in adapter) {
    (adapter as FirebaseSyncAdapter)
      .subscribeRealtime(onRealtimeUpdate)
      .catch(console.warn);
  }
  flush();
}

export function getSyncAdapter(): SyncAdapter | null { return _adapter; }

export async function enqueueChange(params: {
  entity:  string;
  type:    ChangeType;
  payload: Record<string, unknown>;
}): Promise<void> {
  const record: ChangeRecord = {
    queueId:   generateId(),
    entity:    params.entity,
    type:      params.type,
    payload:   params.payload,
    createdAt: new Date().toISOString(),
    syncedAt:  null,
  };
  await dbPut("syncQueue", record);
  flush();
}

export async function flush(): Promise<void> {
  if (!_adapter || _flushing) return;
  _flushing = true;
  try {
    const pending = (await dbGetAll<ChangeRecord>("syncQueue")).filter((c) => !c.syncedAt);
    if (!pending.length) return;

    await _adapter.prepare();
    const result: PushResult = await _adapter.pushChanges(pending);

    for (const queueId of result.synced) {
      const rec = pending.find((p) => p.queueId === queueId);
      if (rec) await dbPut("syncQueue", { ...rec, syncedAt: new Date().toISOString() });
    }
  } catch (err) {
    console.warn("[SyncQueue] flush failed:", (err as Error).message);
  } finally {
    _flushing = false;
  }
}
