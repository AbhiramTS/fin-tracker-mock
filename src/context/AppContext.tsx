import {
	createContext,
	useContext,
	useReducer,
	useEffect,
	useCallback,
	type ReactNode,
} from 'react';
import { openDB } from '@/db/indexedDB';
import { Repos } from '@/repositories';
import { registerSyncAdapter } from '@/sync/syncQueue';
import { FirebaseSyncAdapter } from '@/sync/FirebaseSyncAdapter';
import type { AppState, AppAction, EntityName, BaseRecord, FirebaseConfig } from '@/types';

const INITIAL: AppState = {
	accounts: [],
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
	loading: true,
	error: null,
	syncStatus: 'idle',
};

function reducer(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case 'LOAD_ALL':
			return { ...state, ...action.payload, loading: false };
		case 'SET_ERROR':
			return { ...state, error: action.payload, loading: false };
		case 'SET_SYNC':
			return { ...state, syncStatus: action.payload };
		case 'UPSERT': {
			const { entity, record } = action.payload;
			const list = (state[entity] as BaseRecord[]) ?? [];
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
					(state[action.payload.entity] as BaseRecord[]) ?? []
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
	// Record<string, unknown> so callers can pass entity-specific fields without casting
	save: (entity: EntityName, record: Record<string, unknown>) => Promise<BaseRecord>;
	remove: (entity: EntityName, id: string) => Promise<void>;
	connectFirebase: (config: FirebaseConfig) => Promise<void>;
}

const AppCtx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, INITIAL);

	const reloadEntity = useCallback(async (entity: string) => {
		const repo = Repos[entity as EntityName];
		if (!repo) return;
		const records = await repo.getAll();
		dispatch({
			type: 'RELOAD_ENTITY',
			payload: { entity: entity as EntityName, records },
		});
	}, []);

	useEffect(() => {
		(async () => {
			try {
				await openDB();
				const entries = await Promise.all(
					Object.entries(Repos).map(async ([k, r]) => [k, await r.getAll()])
				);
				dispatch({ type: 'LOAD_ALL', payload: Object.fromEntries(entries) });

				// Restore saved Firebase config
				const saved = localStorage.getItem('ft_firebase_config');
				if (saved) {
					const cfg = JSON.parse(saved) as FirebaseConfig;
					const adapter = new FirebaseSyncAdapter(cfg);
					registerSyncAdapter(adapter, reloadEntity);
					dispatch({ type: 'SET_SYNC', payload: 'firebase' });
				}

				// Handle ?fbc= QR param (mobile auto-connect)
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
						/* invalid fbc */
					}
				}
			} catch (err) {
				dispatch({ type: 'SET_ERROR', payload: (err as Error).message });
			}
		})();
	}, [reloadEntity]);

	const save = useCallback(async (entity: EntityName, record: Record<string, unknown>) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const saved = await Repos[entity].save(record as any);
		dispatch({ type: 'UPSERT', payload: { entity, record: saved } });
		return saved;
	}, []);

	const remove = useCallback(async (entity: EntityName, id: string) => {
		await Repos[entity].delete(id);
		dispatch({ type: 'REMOVE', payload: { entity, id } });
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
		<AppCtx.Provider value={{ state, save, remove, connectFirebase }}>
			{children}
		</AppCtx.Provider>
	);
}

export function useApp(): AppContextValue {
	const ctx = useContext(AppCtx);
	if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
	return ctx;
}
