const DB_NAME = 'fintracker_v4';
const DB_VERSION = 5; // v5: importSessions store for resumable import review

interface StoreDef {
	keyPath: string;
	indexes: string[];
}

export const STORE_DEFS: Record<string, StoreDef> = {
	accounts: { keyPath: 'id', indexes: [] },
	accountHeads: { keyPath: 'id', indexes: ['type', 'parentId', 'isAccount'] },
	journalEntries: {
		keyPath: 'id',
		indexes: ['date', 'type', 'debitAccountHeadId', 'creditAccountHeadId'],
	},
	recurringPayments: { keyPath: 'id', indexes: ['nextDate', 'accountId'] },
	recurringIncomes: { keyPath: 'id', indexes: ['nextDate', 'accountId'] },
	loans: { keyPath: 'id', indexes: ['accountId', 'loanType'] },
	receivables: { keyPath: 'id', indexes: ['accountId'] },
	repaymentRecords: { keyPath: 'id', indexes: ['receivableId', 'date'] },
	investments: { keyPath: 'id', indexes: ['type'] },
	reconciliations: { keyPath: 'id', indexes: ['accountId', 'reconciledDate'] },
	goals: { keyPath: 'id', indexes: ['type', 'status'] },
	paymentOccurrences: { keyPath: 'id', indexes: ['dueDate', 'sourceId', 'status', 'kind'] },
	importReviews: { keyPath: 'id', indexes: ['sessionId', 'status', 'entity'] },
	importSessions: { keyPath: 'id', indexes: ['status', 'updatedAt'] },
	syncQueue: { keyPath: 'queueId', indexes: ['entity'] },
};

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
	if (_db) return Promise.resolve(_db);
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			const oldVer = e.oldVersion;
			const tx = (e.target as IDBOpenDBRequest).transaction!;

			// Create any stores not yet present
			for (const [name, cfg] of Object.entries(STORE_DEFS)) {
				if (!db.objectStoreNames.contains(name)) {
					const s = db.createObjectStore(name, { keyPath: cfg.keyPath });
					cfg.indexes.forEach((idx) => s.createIndex(idx, idx, { unique: false }));
				}
			}

			// v4: clear old transaction stores, add journalEntries
			if (oldVer > 0 && oldVer < 4) {
				for (const store of ['expenses', 'incomes', 'transfers']) {
					if (db.objectStoreNames.contains(store)) {
						tx.objectStore(store).clear();
						// Note: we leave the store definition but won't use it
					}
				}
				// Migrate account.balance → account.openingBalance if still on v2 shape
				if (db.objectStoreNames.contains('accounts')) {
					const acctStore = tx.objectStore('accounts');
					acctStore.openCursor().onsuccess = (ev) => {
						const cursor = (ev.target as IDBRequest<IDBCursorWithValue>).result;
						if (!cursor) return;
						const rec = cursor.value as Record<string, unknown>;
						if (rec.openingBalance === undefined) {
							rec.openingBalance = rec.balance ?? 0;
							delete rec.balance;
							cursor.update(rec);
						}
						cursor.continue();
					};
				}
			}
		};

		req.onsuccess = (e) => {
			_db = (e.target as IDBOpenDBRequest).result;
			resolve(_db);
		};
		req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error);
	});
}

const r2p = <T>(r: IDBRequest<T>) =>
	new Promise<T>((res, rej) => {
		r.onsuccess = (e) => res((e.target as IDBRequest<T>).result);
		r.onerror = (e) => rej((e.target as IDBRequest).error);
	});

export const dbGetAll = async <T>(s: string): Promise<T[]> =>
	r2p((await openDB()).transaction(s).objectStore(s).getAll() as IDBRequest<T[]>);

export const dbGet = async <T>(s: string, k: IDBValidKey): Promise<T | undefined> =>
	r2p((await openDB()).transaction(s).objectStore(s).get(k) as IDBRequest<T | undefined>);

export const dbPut = async <T>(s: string, rec: T): Promise<IDBValidKey> =>
	r2p((await openDB()).transaction(s, 'readwrite').objectStore(s).put(rec));

const asTimestampMs = (value: unknown): number => {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value !== 'string') return 0;
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
};

const getRecordTs = (value: unknown): number => {
	if (!value || typeof value !== 'object') return 0;
	const rec = value as Record<string, unknown>;
	return Math.max(asTimestampMs(rec.updatedAt), asTimestampMs(rec.createdAt));
};

/**
 * Upsert a record only when it is newer than the currently stored version.
 * Returns true when the write is applied and false when skipped as stale.
 */
export async function dbPutLatest<T extends Record<string, unknown>>(
	s: string,
	rec: T
): Promise<boolean> {
	const db = await openDB();
	const tx = db.transaction(s, 'readwrite');
	const store = tx.objectStore(s);
	const keyPath = STORE_DEFS[s]?.keyPath;
	if (!keyPath) {
		await r2p(store.put(rec));
		return true;
	}

	const key = rec[keyPath];
	if (key === undefined || key === null) {
		await r2p(store.put(rec));
		return true;
	}

	const existing = await r2p(store.get(key));
	if (existing && getRecordTs(existing) > getRecordTs(rec)) {
		return false;
	}

	await r2p(store.put(rec));
	return true;
}

export const dbDelete = async (s: string, k: IDBValidKey): Promise<undefined> =>
	r2p(
		(await openDB())
			.transaction(s, 'readwrite')
			.objectStore(s)
			.delete(k) as IDBRequest<undefined>
	);

export const dbClear = async (s: string): Promise<undefined> =>
	r2p(
		(await openDB()).transaction(s, 'readwrite').objectStore(s).clear() as IDBRequest<undefined>
	);
