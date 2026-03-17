const DB_NAME = 'fintracker_v4';
const DB_VERSION = 2; // bumped: added paymentOccurrences store

interface StoreDef {
	keyPath: string;
	indexes: string[];
}

export const STORE_DEFS: Record<string, StoreDef> = {
	accounts: { keyPath: 'id', indexes: [] },
	expenses: { keyPath: 'id', indexes: ['date', 'accountId', 'category'] },
	incomes: { keyPath: 'id', indexes: ['date', 'accountId'] },
	transfers: { keyPath: 'id', indexes: ['date', 'fromAccountId', 'toAccountId'] },
	recurringPayments: { keyPath: 'id', indexes: ['nextDate', 'accountId'] },
	recurringIncomes: { keyPath: 'id', indexes: ['nextDate', 'accountId'] },
	loans: { keyPath: 'id', indexes: ['accountId', 'loanType'] },
	creditCards: { keyPath: 'id', indexes: [] },
	receivables: { keyPath: 'id', indexes: ['accountId'] },
	repaymentRecords: { keyPath: 'id', indexes: ['receivableId', 'date'] },
	investments: { keyPath: 'id', indexes: ['type'] },
	reconciliations: { keyPath: 'id', indexes: ['accountId', 'reconciledDate'] },
	goals: { keyPath: 'id', indexes: ['type', 'status'] },
	paymentOccurrences: { keyPath: 'id', indexes: ['dueDate', 'sourceId', 'status', 'kind'] },
	syncQueue: { keyPath: 'queueId', indexes: ['entity'] },
};

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
	if (_db) return Promise.resolve(_db);
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			for (const [name, cfg] of Object.entries(STORE_DEFS)) {
				if (!db.objectStoreNames.contains(name)) {
					const s = db.createObjectStore(name, { keyPath: cfg.keyPath });
					cfg.indexes.forEach((idx) => s.createIndex(idx, idx, { unique: false }));
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
