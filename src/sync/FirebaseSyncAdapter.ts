import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
	getFirestore,
	collection,
	doc,
	writeBatch,
	getDocs,
	onSnapshot,
	type Firestore,
	type Unsubscribe,
} from 'firebase/firestore';
import { SyncAdapter } from './SyncAdapter';
import { dbPut, dbDelete, STORE_DEFS } from '@/db/indexedDB';
import type { ChangeRecord, PushResult, FirebaseConfig } from '@/types';

export class FirebaseSyncAdapter extends SyncAdapter {
	private app: FirebaseApp | null = null;
	private db: Firestore | null = null;
	private unsubs: Unsubscribe[] = [];

	constructor(private readonly config: FirebaseConfig) {
		super();
	}

	async prepare(): Promise<void> {
		if (this.db) return;
		this.app = getApps().length ? getApp() : initializeApp(this.config);
		this.db = getFirestore(this.app);
	}

	async pushChanges(changes: ChangeRecord[]): Promise<PushResult> {
		await this.prepare();
		const batch = writeBatch(this.db!);
		const synced: string[] = [];
		const entities = Object.keys(STORE_DEFS).filter((s) => s !== 'syncQueue');
		for (const change of changes) {
			if (!entities.includes(change.entity)) {
				synced.push(change.queueId);
				continue;
			}
			const ref = doc(collection(this.db!, change.entity), change.payload['id'] as string);
			change.type === 'delete'
				? batch.delete(ref)
				: batch.set(ref, change.payload, { merge: true });
			synced.push(change.queueId);
		}
		await batch.commit();
		return { synced, failed: [] };
	}

	async pullEntity(entity: string): Promise<Record<string, unknown>[]> {
		await this.prepare();
		return (await getDocs(collection(this.db!, entity))).docs.map(
			(d) => d.data() as Record<string, unknown>
		);
	}

	async subscribeRealtime(onReload: (entity: string) => void): Promise<void> {
		await this.prepare();
		for (const entity of Object.keys(STORE_DEFS).filter((s) => s !== 'syncQueue')) {
			this.unsubs.push(
				onSnapshot(collection(this.db!, entity), async (snap) => {
					for (const ch of snap.docChanges()) {
						ch.type === 'removed'
							? await dbDelete(entity, ch.doc.id)
							: await dbPut(entity, ch.doc.data());
					}
					onReload(entity);
				})
			);
		}
	}

	override destroy(): void {
		this.unsubs.forEach((u) => u());
		this.unsubs = [];
	}

	/** Delete every document in the given Firestore collections. */
	async clearCollections(entities: string[]): Promise<void> {
		await this.prepare();
		for (const entity of entities) {
			const snap = await getDocs(collection(this.db!, entity));
			if (snap.empty) continue;
			// Firestore writeBatch limit is 500 ops — chunk if needed
			const docs = snap.docs;
			for (let i = 0; i < docs.length; i += 500) {
				const batch = writeBatch(this.db!);
				docs.slice(i, i + 500).forEach((d) => batch.delete(d.ref));
				await batch.commit();
			}
		}
	}
}
