import { dbGetAll, dbPut, dbPutLatest } from '@/db/indexedDB';
import { generateId } from '@/utils/id';
import type { ChangeRecord, ChangeType, PushResult } from '@/types';
import type { SyncAdapter } from './SyncAdapter';
import type { FirebaseSyncAdapter } from './FirebaseSyncAdapter';

let _adapter: SyncAdapter | null = null;
let _flushing = false;

// Optional callback invoked after every flush attempt so AppContext
// can update its SyncState without polling.
type FlushCallback = (result: { synced: number; failed: number; error: string | null }) => void;
let _onFlush: FlushCallback | null = null;

export function registerSyncAdapter(
	adapter: SyncAdapter,
	onRealtimeUpdate?: (entity: string) => void
): void {
	_adapter?.destroy();
	_adapter = adapter;
	if (onRealtimeUpdate && 'subscribeRealtime' in adapter)
		(adapter as FirebaseSyncAdapter).subscribeRealtime(onRealtimeUpdate).catch(console.warn);
	flush();
}

/** Register a callback that fires after every flush with the result. */
export function onFlushResult(cb: FlushCallback): void {
	_onFlush = cb;
}

/** Returns the currently registered sync adapter, or null if none. */
export function getAdapter(): SyncAdapter | null {
	return _adapter;
}

/** Number of change records not yet pushed to the cloud. */
export async function getPendingCount(): Promise<number> {
	const all = await dbGetAll<ChangeRecord>('syncQueue');
	return all.filter((c) => !c.syncedAt).length;
}

export async function enqueueChange(params: {
	entity: string;
	type: ChangeType;
	payload: Record<string, unknown>;
}): Promise<void> {
	await dbPut('syncQueue', {
		queueId: generateId(),
		...params,
		createdAt: new Date().toISOString(),
		syncedAt: null,
	} as ChangeRecord);
	flush();
}

export async function flush(): Promise<void> {
	if (!_adapter || _flushing) return;
	_flushing = true;
	let syncedCount = 0;
	let errorMsg: string | null = null;
	try {
		const pending = (await dbGetAll<ChangeRecord>('syncQueue')).filter((c) => !c.syncedAt);
		if (pending.length) {
			await _adapter.prepare();
			const { synced = [], failed = [] }: PushResult = await _adapter.pushChanges(pending);
			for (const qid of synced) {
				const r = pending.find((p) => p.queueId === qid);
				if (r) await dbPut('syncQueue', { ...r, syncedAt: new Date().toISOString() });
			}
			syncedCount = synced.length;
			if (failed.length) errorMsg = `${failed.length} record(s) failed to sync`;
		}
	} catch (e) {
		errorMsg = (e as Error).message;
		console.warn('[SyncQueue]', errorMsg);
	} finally {
		_flushing = false;
		_onFlush?.({ synced: syncedCount, failed: 0, error: errorMsg });
	}
}

/**
 * Merge pulled cloud records into local DB, keeping whichever is newer by timestamp.
 * Use this in any pull-based sync path (manual sync, initial load, etc).
 */
export async function mergeCloudRecords(
	entity: string,
	cloudRecords: Record<string, unknown>[]
): Promise<number> {
	let mergedCount = 0;
	for (const rec of cloudRecords) {
		const applied = await dbPutLatest(entity, rec);
		if (applied) mergedCount++;
	}
	return mergedCount;
}
