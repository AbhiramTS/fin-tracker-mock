import {
	createContext,
	useContext,
	useReducer,
	useEffect,
	useCallback,
	useRef,
	type ReactNode,
} from 'react';
import { openDB } from '@/db/indexedDB';
import { Repos } from '@/repositories';
import { registerSyncAdapter } from '@/sync/syncQueue';
import { FirebaseSyncAdapter } from '@/sync/FirebaseSyncAdapter';
import type {
	AppState,
	AppAction,
	EntityName,
	BaseRecord,
	FirebaseConfig,
	Account,
	Expense,
	Income,
} from '@/types';

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
	paymentOccurrences: [],
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
	save: (entity: EntityName, record: Record<string, unknown>) => Promise<BaseRecord>;
	saveRaw: (entity: EntityName, record: Record<string, unknown>) => Promise<BaseRecord>; // import only — no balance side-effects
	remove: (entity: EntityName, id: string) => Promise<void>;
	connectFirebase: (config: FirebaseConfig) => Promise<void>;
}

const AppCtx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
	const [state, dispatch] = useReducer(reducer, INITIAL);

	// Always-current state so save/remove don't go stale inside useCallback
	const stateRef = useRef(state);
	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	const reloadEntity = useCallback(async (entity: string) => {
		const repo = Repos[entity as EntityName];
		if (!repo) return;
		const records = await repo.getAll();
		dispatch({ type: 'RELOAD_ENTITY', payload: { entity: entity as EntityName, records } });
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

	// ── Balance reconciliation helper ───────────────────────────────────────────
	// Applies `delta` to an account's balance and persists it atomically.
	const adjustBalance = useCallback(async (accountId: string, delta: number) => {
		if (!accountId || delta === 0) return;
		const account = stateRef.current.accounts.find((a) => a.id === accountId) as
			| Account
			| undefined;
		if (!account) return;
		const updated = { ...account, balance: account.balance + delta };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const saved = await Repos.accounts.save(updated as any);
		dispatch({ type: 'UPSERT', payload: { entity: 'accounts', record: saved } });
	}, []);

	// ── Save ────────────────────────────────────────────────────────────────────
	const save = useCallback(
		async (entity: EntityName, record: Record<string, unknown>) => {
			// Auto-update account balance when a transaction is created or edited.
			// Expenses debit the account; incomes credit it.
			if (entity === 'expenses' || entity === 'incomes') {
				const isIncome = entity === 'incomes';
				const newAmount = (record.amount as number) ?? 0;
				const newAccId = record.accountId as string;
				const existingId = record.id as string | undefined;

				if (existingId) {
					// EDIT: undo the old transaction then apply the new one
					const list = isIncome
						? (stateRef.current.incomes as Income[])
						: (stateRef.current.expenses as Expense[]);
					const old = list.find((r) => r.id === existingId);
					if (old) {
						// Reverse the old effect on the old account
						await adjustBalance(old.accountId, isIncome ? -old.amount : old.amount);
						// Apply the new effect on the (possibly different) new account
						await adjustBalance(newAccId, isIncome ? newAmount : -newAmount);
					}
				} else {
					// CREATE: apply the new transaction
					await adjustBalance(newAccId, isIncome ? newAmount : -newAmount);
				}
			}

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const saved = await Repos[entity].save(record as any);
			dispatch({ type: 'UPSERT', payload: { entity, record: saved } });
			return saved;
		},
		[adjustBalance]
	);

	// ── Remove ──────────────────────────────────────────────────────────────────
	const remove = useCallback(
		async (entity: EntityName, id: string) => {
			// Reverse the account balance effect when deleting a transaction
			if (entity === 'expenses' || entity === 'incomes') {
				const isIncome = entity === 'incomes';
				const list = isIncome
					? (stateRef.current.incomes as Income[])
					: (stateRef.current.expenses as Expense[]);
				const record = list.find((r) => r.id === id);
				if (record) {
					// Undo: income credited → debit back; expense debited → credit back
					await adjustBalance(
						record.accountId,
						isIncome ? -record.amount : record.amount
					);
				}
			}

			await Repos[entity].delete(id);
			dispatch({ type: 'REMOVE', payload: { entity, id } });
		},
		[adjustBalance]
	);

	// ── saveRaw — bypasses balance auto-adjustment ──────────────────────────────
	// Use only for bulk import where account balances are imported separately
	// and are already the ground truth.
	const saveRaw = useCallback(async (entity: EntityName, record: Record<string, unknown>) => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const saved = await Repos[entity].save(record as any);
		dispatch({ type: 'UPSERT', payload: { entity, record: saved } });
		return saved;
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
		<AppCtx.Provider value={{ state, save, saveRaw, remove, connectFirebase }}>
			{children}
		</AppCtx.Provider>
	);
}

export function useApp(): AppContextValue {
	const ctx = useContext(AppCtx);
	if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
	return ctx;
}
