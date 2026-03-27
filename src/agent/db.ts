/**
 * Standalone IndexedDB for AI Agent chat sessions.
 * Completely separate from the main app DB — never synced.
 */
import type { ChatSession, ChatSessionSummary } from './types';

const DB_NAME = 'finTracker_agent';
const DB_VERSION = 1;
const STORE = 'chatSessions';

let _db: IDBDatabase | null = null;

function openAgentDB(): Promise<IDBDatabase> {
	if (_db) return Promise.resolve(_db);
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = (e.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, { keyPath: 'id' });
				store.createIndex('updatedAt', 'updatedAt');
			}
		};
		req.onsuccess = () => {
			_db = req.result;
			resolve(_db);
		};
		req.onerror = () => reject(req.error);
	});
}

export async function saveAgentSession(session: ChatSession): Promise<void> {
	const db = await openAgentDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).put(session);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function getAgentSession(id: string): Promise<ChatSession | null> {
	const db = await openAgentDB();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
		req.onsuccess = () => resolve((req.result as ChatSession) ?? null);
		req.onerror = () => reject(req.error);
	});
}

export async function listAgentSessions(): Promise<ChatSessionSummary[]> {
	const db = await openAgentDB();
	return new Promise((resolve, reject) => {
		const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
		req.onsuccess = () => {
			const sessions = (req.result as ChatSession[])
				.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
				.map((s) => ({
					id: s.id,
					title: s.title,
					messageCount: s.messages.length,
					createdAt: s.createdAt,
					updatedAt: s.updatedAt,
				}));
			resolve(sessions);
		};
		req.onerror = () => reject(req.error);
	});
}

export async function deleteAgentSession(id: string): Promise<void> {
	const db = await openAgentDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE, 'readwrite');
		tx.objectStore(STORE).delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
