// ─────────────────────────────────────────────────────────────────────────────
//  importStore.ts
//  Persistent import session store backed by IndexedDB.
//  Keeps import review sessions resumable across navigation and reloads.
// ─────────────────────────────────────────────────────────────────────────────

import { dbDelete, dbGet, dbGetAll, dbPut } from '@/db/indexedDB';
import type { JournalEntry } from '@/types';
import type { ImportPlan } from './importEngine';

const STORE = 'importSessions';
const ACTIVE_KEY = 'ft_active_import_session_id';

type SessionStatus = 'pending' | 'completed' | 'discarded';

interface SerializedImportPlan {
	resolvedAccountsEntries: [string, string][];
	cleanAccounts: ImportPlan['cleanAccounts'];
	cleanLoans: ImportPlan['cleanLoans'];
	cleanJournalEntries: ImportPlan['cleanJournalEntries'];
	intraFileDuplicates: ImportPlan['intraFileDuplicates'];
	existingDuplicates: ImportPlan['existingDuplicates'];
	txDuplicates: ImportPlan['txDuplicates'];
	sessionId: string;
	errors: string[];
}

export interface ImportSessionDraft {
	entries: Partial<JournalEntry>[];
	accountRemap: Record<string, string>;
}

interface ImportSessionRecord {
	id: string;
	status: SessionStatus;
	fileName?: string;
	plan: SerializedImportPlan;
	mergeMap: Record<string, Record<string, unknown>>;
	draft?: ImportSessionDraft;
	createdAt: string;
	updatedAt: string;
	lastOpenedAt: string;
}

export interface PendingImport {
	plan: ImportPlan;
	mergeMap: Record<string, Record<string, unknown>>;
	sessionId: string;
	fileName?: string;
	draft?: ImportSessionDraft;
}

export interface ImportSessionSummary {
	id: string;
	fileName?: string;
	createdAt: string;
	updatedAt: string;
	entriesCount: number;
	accountsCount: number;
	loansCount: number;
}

const serializePlan = (plan: ImportPlan): SerializedImportPlan => ({
	resolvedAccountsEntries: [...plan.resolvedAccounts.entries()],
	cleanAccounts: plan.cleanAccounts,
	cleanLoans: plan.cleanLoans,
	cleanJournalEntries: plan.cleanJournalEntries,
	intraFileDuplicates: plan.intraFileDuplicates,
	existingDuplicates: plan.existingDuplicates,
	txDuplicates: plan.txDuplicates,
	sessionId: plan.sessionId,
	errors: plan.errors,
});

const deserializePlan = (plan: SerializedImportPlan): ImportPlan => ({
	resolvedAccounts: new Map(plan.resolvedAccountsEntries),
	cleanAccounts: plan.cleanAccounts,
	cleanLoans: plan.cleanLoans,
	cleanJournalEntries: plan.cleanJournalEntries,
	intraFileDuplicates: plan.intraFileDuplicates,
	existingDuplicates: plan.existingDuplicates,
	txDuplicates: plan.txDuplicates,
	sessionId: plan.sessionId,
	errors: plan.errors,
});

const getActiveId = (): string | null => {
	try {
		return localStorage.getItem(ACTIVE_KEY);
	} catch {
		return null;
	}
};

export const setActiveImportSession = (sessionId: string | null) => {
	try {
		if (!sessionId) localStorage.removeItem(ACTIVE_KEY);
		else localStorage.setItem(ACTIVE_KEY, sessionId);
	} catch {
		/* ignore storage failures */
	}
};

const toPending = (rec: ImportSessionRecord): PendingImport => ({
	plan: deserializePlan(rec.plan),
	mergeMap: rec.mergeMap,
	sessionId: rec.id,
	fileName: rec.fileName,
	draft: rec.draft,
});

export async function storePendingImport(
	plan: ImportPlan,
	mergeMap: Record<string, Record<string, unknown>>,
	options?: { fileName?: string }
): Promise<string> {
	const now = new Date().toISOString();
	const id = plan.sessionId;
	const rec: ImportSessionRecord = {
		id,
		status: 'pending',
		fileName: options?.fileName,
		plan: serializePlan(plan),
		mergeMap,
		createdAt: now,
		updatedAt: now,
		lastOpenedAt: now,
	};
	await dbPut(STORE, rec);
	setActiveImportSession(id);
	return id;
}

export async function listPendingImportSessions(): Promise<ImportSessionSummary[]> {
	const all = await dbGetAll<ImportSessionRecord>(STORE);
	return all
		.filter((s) => s.status === 'pending')
		.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
		.map((s) => ({
			id: s.id,
			fileName: s.fileName,
			createdAt: s.createdAt,
			updatedAt: s.updatedAt,
			entriesCount: s.draft?.entries.length ?? s.plan.cleanJournalEntries.length,
			accountsCount: s.plan.cleanAccounts.length,
			loansCount: s.plan.cleanLoans.length,
		}));
}

export async function getPendingImport(sessionId?: string): Promise<PendingImport | null> {
	const explicitId = sessionId ?? getActiveId() ?? undefined;
	if (explicitId) {
		const rec = await dbGet<ImportSessionRecord>(STORE, explicitId);
		if (rec && rec.status === 'pending') {
			const now = new Date().toISOString();
			await dbPut(STORE, { ...rec, lastOpenedAt: now, updatedAt: now });
			setActiveImportSession(rec.id);
			return toPending(rec);
		}
	}

	const all = await dbGetAll<ImportSessionRecord>(STORE);
	const latestPending = all
		.filter((s) => s.status === 'pending')
		.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
	if (!latestPending) return null;

	const now = new Date().toISOString();
	await dbPut(STORE, { ...latestPending, lastOpenedAt: now, updatedAt: now });
	setActiveImportSession(latestPending.id);
	return toPending(latestPending);
}

export async function savePendingImportDraft(
	sessionId: string,
	draft: ImportSessionDraft
): Promise<void> {
	const rec = await dbGet<ImportSessionRecord>(STORE, sessionId);
	if (!rec || rec.status !== 'pending') return;
	await dbPut(STORE, {
		...rec,
		draft,
		updatedAt: new Date().toISOString(),
	});
}

export async function markImportSessionCompleted(sessionId: string): Promise<void> {
	const rec = await dbGet<ImportSessionRecord>(STORE, sessionId);
	if (!rec) return;
	await dbPut(STORE, {
		...rec,
		status: 'completed',
		updatedAt: new Date().toISOString(),
	});
	if (getActiveId() === sessionId) setActiveImportSession(null);
}

export async function discardPendingImport(sessionId?: string): Promise<void> {
	const id = sessionId ?? getActiveId();
	if (!id) return;
	const rec = await dbGet<ImportSessionRecord>(STORE, id);
	if (!rec) {
		if (getActiveId() === id) setActiveImportSession(null);
		return;
	}
	await dbPut(STORE, {
		...rec,
		status: 'discarded',
		updatedAt: new Date().toISOString(),
	});
	if (getActiveId() === id) setActiveImportSession(null);
}

export async function clearPendingImport(): Promise<void> {
	await discardPendingImport();
}

export async function hardDeleteImportSession(sessionId: string): Promise<void> {
	await dbDelete(STORE, sessionId);
	if (getActiveId() === sessionId) setActiveImportSession(null);
}
