import {
	createContext,
	useContext,
	useReducer,
	useEffect,
	useCallback,
	useRef,
	type ReactNode,
} from 'react';
import { openDB, dbClear } from '@/db/indexedDB';
import { Repos, legacyCreditCardRepo } from '@/repositories';
import {
	registerSyncAdapter,
	getAdapter,
	onFlushResult,
	flush,
	getPendingCount,
} from '@/sync/syncQueue';
import { FirebaseSyncAdapter } from '@/sync/FirebaseSyncAdapter';
import { computeBalances } from '@/workers/balanceWorker';
import type {
	AppState,
	AppAction,
	EntityName,
	BaseRecord,
	FirebaseConfig,
	AccountHead,
	ComputedBalances,
	SyncState,
	Account,
	Loan,
} from '@/types';
import { ROOT_HEADS, rootHeadForAccountType } from '@/types';

type LegacyCreditCardRecord = BaseRecord & {
	name: string;
	limit: number;
	outstanding: number;
	statementDay: number;
	billingCycleDays: number;
	gracePeriodDays: number;
	dueDate: string;
	statementDate: string;
	taxRate?: number;
	notes?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
const INITIAL_SYNC: SyncState = {
	status: 'idle',
	phase: 'idle',
	pendingCount: 0,
	lastSyncedAt: null,
	lastSyncedCount: 0,
	lastError: null,
};

const INITIAL: AppState = {
	accounts: [],
	accountHeads: [],
	journalEntries: [],
	recurringPayments: [],
	recurringIncomes: [],
	loans: [],
	receivables: [],
	repaymentRecords: [],
	investments: [],
	reconciliations: [],
	goals: [],
	paymentOccurrences: [],
	importReviews: [],
	computedBalances: {},
	loading: true,
	error: null,
	syncStatus: 'idle',
	sync: INITIAL_SYNC,
};

function reducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case 'LOAD_ALL':
			return { ...state, ...action.payload, loading: false };
		case 'SET_ERROR':
			return { ...state, error: action.payload, loading: false };
		case 'SET_SYNC':
			return {
				...state,
				syncStatus: action.payload,
				sync: { ...state.sync, status: action.payload },
			};
		case 'SET_SYNC_STATE':
			return { ...state, sync: { ...state.sync, ...action.payload } };
		case 'SET_BALANCES':
			return { ...state, computedBalances: action.payload };
		case 'UPSERT': {
			const { entity, record } = action.payload;
			const list = (state[entity as keyof AppState] as BaseRecord[]) ?? [];
			const idx = list.findIndex((r) => r.id === record.id);
			return {
				...state,
				[entity]:
					idx >= 0
						? list.map((r) => (r.id === record.id ? record : r))
						: [...list, record],
			};
		}
		case 'REMOVE':
			return {
				...state,
				[action.payload.entity]: (
					(state[action.payload.entity as keyof AppState] as BaseRecord[]) ?? []
				).filter((r) => r.id !== action.payload.id),
			};
		case 'RELOAD_ENTITY':
			return { ...state, [action.payload.entity]: action.payload.records };
		default:
			return state;
	}
}

interface AppContextValue {
	state: AppState;
	save: (entity: EntityName, record: Record<string, unknown>) => Promise<BaseRecord>;
	remove: (entity: EntityName, id: string) => Promise<void>;
	clearData: (opts: { local: boolean; cloud: boolean; entities: EntityName[] }) => Promise<void>;
	syncNow: () => Promise<void>;
	connectFirebase: (config: FirebaseConfig) => Promise<void>;
}

const AppCtx = createContext<AppContextValue | null>(null);

// ── AccountHead mirror helpers ────────────────────────────────────────────────
// Every Account and Loan is ALSO an AccountHead (same id, isAccount: true).
// These helpers sync the AccountHead when the underlying entity changes.

function accountToHead(a: Account): AccountHead {
	const now = new Date().toISOString();
	return {
		id: a.id,
		name: a.name,
		type: a.type === 'credit_card' || a.type === 'loan' ? 'liability' : 'asset',
		parentId: rootHeadForAccountType(a.type),
		isSystem: false,
		isAccount: true,
		notes: a.notes,
		createdAt: (a as unknown as Record<string, string>).createdAt ?? now,
		updatedAt: now,
	};
}

function creditCardToAccount(c: LegacyCreditCardRecord, existingAccountIds: Set<string>): Account {
	const id = existingAccountIds.has(c.id) ? `${c.id}_cc` : c.id;
	return {
		id,
		name: c.name,
		type: 'credit_card',
		openingBalance: -(c.outstanding ?? 0),
		creditCard: {
			limit: c.limit ?? 0,
			outstanding: c.outstanding ?? 0,
			statementDay: c.statementDay ?? 1,
			billingCycleDays: c.billingCycleDays ?? 30,
			gracePeriodDays: c.gracePeriodDays ?? 20,
			dueDate: c.dueDate,
			statementDate: c.statementDate,
			taxRate: c.taxRate,
		},
		notes: c.notes,
		createdAt: c.createdAt,
		updatedAt: c.updatedAt,
	};
}

function loanToHead(l: Loan): AccountHead {
	const now = new Date().toISOString();
	return {
		id: l.id,
		name: l.name,
		type: 'liability',
		parentId: 'head_liability',
		isSystem: false,
		isAccount: true,
		createdAt: (l as unknown as Record<string, string>).createdAt ?? now,
		updatedAt: now,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, INITIAL);
	const stateRef = useRef(state);
	const workerRef = useRef<Worker | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	// ── Balance worker ────────────────────────────────────────────────────────
	useEffect(() => {
		try {
			const w = new Worker(new URL('../workers/balanceWorker.ts', import.meta.url), {
				type: 'module',
			});
			w.onmessage = (e: MessageEvent<ComputedBalances>) => {
				if (!e.data.error) dispatch({ type: 'SET_BALANCES', payload: e.data });
			};
			workerRef.current = w;
		} catch {
			workerRef.current = null;
		}
		return () => {
			workerRef.current?.terminate();
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	// ── Debounced balance trigger ─────────────────────────────────────────────
	const triggerBalance = useCallback(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			const s = stateRef.current;
			if (s.loading) return;
			const input = {
				accounts: s.accounts,
				accountHeads: s.accountHeads,
				journalEntries: s.journalEntries,
			};
			if (workerRef.current) {
				workerRef.current.postMessage(input);
			} else {
				dispatch({ type: 'SET_BALANCES', payload: computeBalances(input) });
			}
		}, 300);
	}, []);

	useEffect(() => {
		if (!state.loading) triggerBalance();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.accounts, state.accountHeads, state.journalEntries, state.loading]);

	// ── Seed system account heads ─────────────────────────────────────────────
	const seedAccountHeads = useCallback(async (existing: AccountHead[]) => {
		const existingIds = new Set(existing.map((h) => h.id));
		const now = new Date().toISOString();
		for (const head of ROOT_HEADS) {
			if (!existingIds.has(head.id)) {
				const record: AccountHead = { ...head, createdAt: now, updatedAt: now };
				await Repos.accountHeads.save(
					record as Parameters<typeof Repos.accountHeads.save>[0]
				);
				dispatch({ type: 'UPSERT', payload: { entity: 'accountHeads', record } });
			}
		}
	}, []);

	// ── Flush callback ────────────────────────────────────────────────────────
	useEffect(() => {
		onFlushResult(async ({ synced, error }) => {
			const pending = await getPendingCount();
			dispatch({
				type: 'SET_SYNC_STATE',
				payload: {
					phase: error ? 'error' : 'success',
					pendingCount: pending,
					lastSyncedAt:
						synced > 0 ? new Date().toISOString() : stateRef.current.sync.lastSyncedAt,
					lastSyncedCount: synced,
					lastError: error,
				},
			});
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const reloadEntity = useCallback(async (entity: string) => {
		const repo = Repos[entity as EntityName];
		if (!repo) return;
		const records = await repo.getAll();
		dispatch({ type: 'RELOAD_ENTITY', payload: { entity: entity as EntityName, records } });
	}, []);

	const migrateLegacyCreditCards = useCallback(
		async (accounts: Account[], heads: AccountHead[], cards: LegacyCreditCardRecord[]) => {
			if (!cards.length) return;

			const accountById = new Map(accounts.map((a) => [a.id, a]));
			const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
			const existingIds = new Set(accounts.map((a) => a.id));
			const headIds = new Set(heads.map((h) => h.id));

			for (const card of cards) {
				const matched =
					accountById.get(card.id) ?? accountByName.get(card.name.toLowerCase()) ?? null;

				if (matched) {
					if (matched.type !== 'credit_card' || matched.creditCard) continue;
					const updated: Account = {
						...matched,
						type: 'credit_card',
						creditCard: {
							limit: card.limit ?? 0,
							outstanding: card.outstanding ?? 0,
							statementDay: card.statementDay ?? 1,
							billingCycleDays: card.billingCycleDays ?? 30,
							gracePeriodDays: card.gracePeriodDays ?? 20,
							dueDate: card.dueDate,
							statementDate: card.statementDate,
							taxRate: card.taxRate,
						},
						notes: matched.notes ?? card.notes,
						updatedAt: new Date().toISOString(),
					};
					await Repos.accounts.save(updated as Parameters<typeof Repos.accounts.save>[0]);
					dispatch({ type: 'UPSERT', payload: { entity: 'accounts', record: updated } });

					const head = accountToHead(updated);
					await Repos.accountHeads.save(
						head as Parameters<typeof Repos.accountHeads.save>[0]
					);
					dispatch({ type: 'UPSERT', payload: { entity: 'accountHeads', record: head } });
					continue;
				}

				const account = creditCardToAccount(card, existingIds);
				existingIds.add(account.id);
				await Repos.accounts.save(account as Parameters<typeof Repos.accounts.save>[0]);
				dispatch({ type: 'UPSERT', payload: { entity: 'accounts', record: account } });

				if (!headIds.has(account.id)) {
					const head = accountToHead(account);
					await Repos.accountHeads.save(
						head as Parameters<typeof Repos.accountHeads.save>[0]
					);
					headIds.add(account.id);
					dispatch({ type: 'UPSERT', payload: { entity: 'accountHeads', record: head } });
				}
			}

			// Legacy store is no longer used after unified account migration.
			await dbClear('creditCards').catch(() => {});
		},
		[]
	);

	// ── Initial load ──────────────────────────────────────────────────────────
	useEffect(() => {
		(async () => {
			try {
				await openDB();
				const entries = await Promise.all(
					Object.entries(Repos).map(async ([k, r]) => [k, await r.getAll()])
				);
				const payload = Object.fromEntries(entries) as Partial<AppState>;
				dispatch({ type: 'LOAD_ALL', payload });
				await seedAccountHeads((payload.accountHeads ?? []) as AccountHead[]);
				const legacyCards = await legacyCreditCardRepo.getAll().catch(() => []);
				await migrateLegacyCreditCards(
					(payload.accounts ?? []) as Account[],
					(payload.accountHeads ?? []) as AccountHead[],
					legacyCards
				);

				const saved = localStorage.getItem('ft_firebase_config');
				if (saved) {
					const cfg = JSON.parse(saved) as FirebaseConfig;
					const adapter = new FirebaseSyncAdapter(cfg);
					registerSyncAdapter(adapter, reloadEntity);
					dispatch({ type: 'SET_SYNC', payload: 'firebase' });
				}
				const fbc = new URLSearchParams(window.location.search).get('fbc');
				if (fbc && !saved) {
					try {
						const cfg = JSON.parse(atob(fbc)) as FirebaseConfig;
						localStorage.setItem('ft_firebase_config', JSON.stringify(cfg));
						const adapter = new FirebaseSyncAdapter(cfg);
						registerSyncAdapter(adapter, reloadEntity);
						dispatch({ type: 'SET_SYNC', payload: 'firebase' });
						window.history.replaceState({}, '', window.location.pathname);
					} catch {
						/* invalid */
					}
				}
			} catch (err) {
				dispatch({ type: 'SET_ERROR', payload: (err as Error).message });
			}
		})();
	}, [migrateLegacyCreditCards, reloadEntity, seedAccountHeads]);

	// ── Save ──────────────────────────────────────────────────────────────────
	// When saving an Account or Loan → also upsert its AccountHead mirror.
	const save = useCallback(async (entity: EntityName, record: Record<string, unknown>) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const saved = await Repos[entity].save(record as any);
		dispatch({ type: 'UPSERT', payload: { entity, record: saved } });

		// Mirror to AccountHead
		if (entity === 'accounts') {
			const head = accountToHead(saved as unknown as Account);
			await Repos.accountHeads.save(head as Parameters<typeof Repos.accountHeads.save>[0]);
			dispatch({ type: 'UPSERT', payload: { entity: 'accountHeads', record: head } });
		} else if (entity === 'loans') {
			const head = loanToHead(saved as unknown as Loan);
			await Repos.accountHeads.save(head as Parameters<typeof Repos.accountHeads.save>[0]);
			dispatch({ type: 'UPSERT', payload: { entity: 'accountHeads', record: head } });
		}

		getPendingCount()
			.then((n) => dispatch({ type: 'SET_SYNC_STATE', payload: { pendingCount: n } }))
			.catch(() => {});
		return saved;
	}, []);

	// ── Remove ────────────────────────────────────────────────────────────────
	// When removing an Account or Loan → also remove its AccountHead mirror.
	const remove = useCallback(async (entity: EntityName, id: string) => {
		await Repos[entity].delete(id);
		dispatch({ type: 'REMOVE', payload: { entity, id } });

		if (entity === 'accounts' || entity === 'loans') {
			await Repos.accountHeads.delete(id);
			dispatch({ type: 'REMOVE', payload: { entity: 'accountHeads', id } });
		}
	}, []);

	// ── Clear data ────────────────────────────────────────────────────────────
	const clearData = useCallback(
		async (opts: { local: boolean; cloud: boolean; entities: EntityName[] }) => {
			const { local, cloud, entities } = opts;
			if (local) {
				for (const entity of entities) {
					await dbClear(entity);
					dispatch({ type: 'RELOAD_ENTITY', payload: { entity, records: [] } });
				}
				await dbClear('syncQueue');
				if (entities.includes('accountHeads') || entities.length === 0)
					await seedAccountHeads([]);
			}
			if (cloud) {
				const adapter = getAdapter();
				if (adapter && adapter instanceof FirebaseSyncAdapter) {
					await adapter.clearCollections(entities as string[]);
				}
			}
		},
		[seedAccountHeads]
	);

	// ── syncNow ───────────────────────────────────────────────────────────────
	const syncNow = useCallback(async () => {
		if (!getAdapter()) return;
		const pending = await getPendingCount();
		dispatch({
			type: 'SET_SYNC_STATE',
			payload: { phase: 'syncing', pendingCount: pending, lastError: null },
		});
		await flush();
	}, []);

	const connectFirebase = useCallback(
		async (config: FirebaseConfig) => {
			localStorage.setItem('ft_firebase_config', JSON.stringify(config));
			const adapter = new FirebaseSyncAdapter(config);
			registerSyncAdapter(adapter, reloadEntity);
			dispatch({ type: 'SET_SYNC', payload: 'firebase' });
		},
		[reloadEntity]
	);

	return (
		<AppCtx.Provider value={{ state, save, remove, clearData, syncNow, connectFirebase }}>
			{children}
		</AppCtx.Provider>
	);
}

export function useApp(): AppContextValue {
	const ctx = useContext(AppCtx);
	if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
	return ctx;
}
