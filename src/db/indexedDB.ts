const DB_NAME = 'fintracker_v4';
const DB_VERSION = 4; // v4: journalEntries replaces expenses/incomes/transfers

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

export const dbPut = async <T>(s: string, rec: T): Promise<IDBValidKey> =>
	r2p((await openDB()).transaction(s, 'readwrite').objectStore(s).put(rec));

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
