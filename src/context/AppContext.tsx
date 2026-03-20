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
import { Repos } from '@/repositories';
import { registerSyncAdapter, getAdapter } from '@/sync/syncQueue';
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
} from '@/types';
import { ROOT_HEADS } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
const INITIAL: AppState = {
	accounts: [],
	accountHeads: [],
	expenses: [],
	incomes: [],
	transfers: [],
	recurringPayments: [],
	recurringIncomes: [],
	loans: [],
	creditCards: [],
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
};

// ─────────────────────────────────────────────────────────────────────────────
//  Entities that affect account balance calculations
// ─────────────────────────────────────────────────────────────────────────────
const BALANCE_ENTITIES = new Set<EntityName>(['accounts', 'expenses', 'incomes', 'transfers']);

function reducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case 'LOAD_ALL':
			return { ...state, ...action.payload, loading: false };
		case 'SET_ERROR':
			return { ...state, error: action.payload, loading: false };
		case 'SET_SYNC':
			return { ...state, syncStatus: action.payload };
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

// ─────────────────────────────────────────────────────────────────────────────
interface AppContextValue {
	state: AppState;
	save: (entity: EntityName, record: Record<string, unknown>) => Promise<BaseRecord>;
	remove: (entity: EntityName, id: string) => Promise<void>;
	clearData: (opts: { local: boolean; cloud: boolean; entities: EntityName[] }) => Promise<void>;
	connectFirebase: (config: FirebaseConfig) => Promise<void>;
}

const AppCtx = createContext<AppContextValue | null>(null);

// ─────────────────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, INITIAL);
	const stateRef = useRef(state);
	const workerRef = useRef<Worker | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	// ── Balance worker setup ──────────────────────────────────────────────────
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

	// ── Trigger balance recalculation (debounced 300 ms) ──────────────────────
	// Reads from stateRef inside the timer so it always uses the latest data,
	// not a stale closure capture from when the effect first scheduled the timer.
	const triggerBalance = useCallback(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			const s = stateRef.current;
			if (s.loading) return;
			const input = {
				accounts: s.accounts,
				expenses: s.expenses,
				incomes: s.incomes,
				transfers: s.transfers,
			};
			if (workerRef.current) {
				workerRef.current.postMessage(input);
			} else {
				const result = computeBalances(input);
				dispatch({ type: 'SET_BALANCES', payload: result });
			}
		}, 300);
	}, []); // stable — no deps needed; reads latest state via stateRef

	// Schedule a recalculation whenever a balance-affecting entity changes.
	// The debounce ensures a burst of rapid saves (e.g. bulk import) results
	// in exactly one computation 300 ms after the last change settles.
	useEffect(() => {
		if (!state.loading) triggerBalance();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.accounts, state.expenses, state.incomes, state.transfers, state.loading]);

	// ── Seed system account heads if they don't exist ─────────────────────────
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

	const reloadEntity = useCallback(async (entity: string) => {
		const repo = Repos[entity as EntityName];
		if (!repo) return;
		const records = await repo.getAll();
		dispatch({ type: 'RELOAD_ENTITY', payload: { entity: entity as EntityName, records } });
	}, []);

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

				// Seed system heads after load
				await seedAccountHeads((payload.accountHeads ?? []) as AccountHead[]);

				// Firebase restore
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
	}, [reloadEntity, seedAccountHeads]);

	// ── Save ──────────────────────────────────────────────────────────────────
	// Balance is now DERIVED — we never mutate account.balance directly.
	// The worker recomputes automatically after every UPSERT to a balance entity.
	const save = useCallback(async (entity: EntityName, record: Record<string, unknown>) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const saved = await Repos[entity].save(record as any);
		dispatch({ type: 'UPSERT', payload: { entity, record: saved } });
		return saved;
	}, []);

	// ── Remove ────────────────────────────────────────────────────────────────
	const remove = useCallback(async (entity: EntityName, id: string) => {
		await Repos[entity].delete(id);
		dispatch({ type: 'REMOVE', payload: { entity, id } });
	}, []);

	// ── Clear data ────────────────────────────────────────────────────────────
	// Wipes selected entities from local IDB and/or Firestore cloud.
	const clearData = useCallback(
		async (opts: { local: boolean; cloud: boolean; entities: EntityName[] }) => {
			const { local, cloud, entities } = opts;

			if (local) {
				for (const entity of entities) {
					await dbClear(entity);
					dispatch({ type: 'RELOAD_ENTITY', payload: { entity, records: [] } });
				}
				// Clear sync queue so stale delete operations don't re-upload to cloud
				await dbClear('syncQueue');
				// Re-seed system account heads if they were cleared
				if (entities.includes('accountHeads') || entities.length === 0) {
					await seedAccountHeads([]);
				}
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
		<AppCtx.Provider value={{ state, save, remove, clearData, connectFirebase }}>
			{children}
		</AppCtx.Provider>
	);
}

export function useApp(): AppContextValue {
	const ctx = useContext(AppCtx);
	if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
	return ctx;
}
