import { dbGetAll, dbPut } from '@/db/indexedDB';
import { generateId } from '@/utils/id';
import type { ChangeRecord, ChangeType, PushResult } from '@/types';
import type { SyncAdapter } from './SyncAdapter';
import type { FirebaseSyncAdapter } from './FirebaseSyncAdapter';

let _adapter: SyncAdapter | null = null;
let _flushing = false;

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
	try {
		const pending = (await dbGetAll<ChangeRecord>('syncQueue')).filter((c) => !c.syncedAt);
		if (!pending.length) return;
		await _adapter.prepare();
		const { synced = [] }: PushResult = await _adapter.pushChanges(pending);
		for (const qid of synced) {
			const r = pending.find((p) => p.queueId === qid);
			if (r) await dbPut('syncQueue', { ...r, syncedAt: new Date().toISOString() });
		}
	} catch (e) {
		console.warn('[SyncQueue]', (e as Error).message);
	} finally {
		_flushing = false;
	}
}
