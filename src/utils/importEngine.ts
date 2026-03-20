// ─────────────────────────────────────────────────────────────────────────────
//  importEngine.ts
//  Parses a FinTracker import JSON file, assigns IDs, detects duplicates,
//  and returns a structured ImportPlan the UI can act on.
// ─────────────────────────────────────────────────────────────────────────────

import { generateId } from './id';
import { todayStr } from './format';
import { calculateEMI, nextStatementDate, dueFromStatement } from './amortisation';
import type {
	Account,
	Expense,
	Income,
	Loan,
	CreditCard,
	AppState,
	ImportReview,
	EntityName,
} from '@/types';

// ── Shape of the import JSON ──────────────────────────────────────────────────
export interface ImportFile {
	version?: string;
	exportedAt?: string;
	data?: {
		accounts?: RawAccount[];
		expenses?: RawExpense[];
		incomes?: RawIncome[];
		loans?: RawLoan[];
		creditCards?: RawCreditCard[];
	};
	// Also accept flat (no wrapper)
	accounts?: RawAccount[];
	expenses?: RawExpense[];
	incomes?: RawIncome[];
	loans?: RawLoan[];
	creditCards?: RawCreditCard[];
}

export interface RawAccount {
	name: string;
	type?: string;
	openingBalance?: number;
	balance?: number; // legacy field — treated as openingBalance
	color?: string;
	currency?: string;
	notes?: string;
	id?: string;
}

export interface RawExpense {
	name: string;
	amount: number;
	date: string;
	category?: string;
	account: string; // account name (resolved to ID)
	accountHeadId?: string;
	notes?: string;
	id?: string;
}

export interface RawIncome {
	name: string;
	amount: number;
	date: string;
	account: string; // account name
	accountHeadId?: string;
	category?: string;
	notes?: string;
	id?: string;
	makeRecurring?: boolean;
	recurringFrequency?: string;
}

export interface RawLoan {
	name: string;
	principalAmount: number;
	interestRate?: number;
	tenureMonths: number;
	startDate?: string;
	emi?: number;
	paidMonths?: number;
	account: string; // account name
	loanType?: string;
	taxRate?: number;
	notes?: string;
	id?: string;
}

export interface RawCreditCard {
	name: string;
	limit: number;
	outstanding?: number;
	statementDay?: number;
	billingCycleDays?: number;
	gracePeriodDays?: number;
	taxRate?: number;
	notes?: string;
	id?: string;
}

// ── Import plan ───────────────────────────────────────────────────────────────

export type DuplicateEntityKind = 'account' | 'loan' | 'creditCard';

/** Two new accounts in the same file that share a name */
export interface IntraFileDuplicate {
	kind: DuplicateEntityKind;
	name: string;
	items: RawAccount[] | RawLoan[] | RawCreditCard[];
}

/** A new record that matches an existing one by name */
export interface ExistingDuplicate {
	kind: DuplicateEntityKind;
	incoming: Record<string, unknown>;
	existing: Record<string, unknown>;
}

/** A transaction that matches an existing one (same name+date+amount+account) */
export interface TransactionDuplicate {
	entity: 'expenses' | 'incomes';
	incoming: Record<string, unknown>;
	existing: Record<string, unknown>;
}

export interface ImportPlan {
	// Accounts resolved by name (includes new ones without duplicates)
	resolvedAccounts: Map<string, string>; // name → final account id
	// Clean records ready to save immediately
	cleanAccounts: Partial<Account>[];
	cleanLoans: Partial<Loan>[];
	cleanCreditCards: Partial<CreditCard>[];
	cleanExpenses: Partial<Expense>[];
	cleanIncomes: Partial<Income>[];
	// Duplicates requiring user decisions
	intraFileDuplicates: IntraFileDuplicate[];
	existingDuplicates: ExistingDuplicate[];
	txDuplicates: TransactionDuplicate[];
	sessionId: string;
	errors: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
export function parseImportFile(raw: unknown, state: AppState): ImportPlan {
	const plan: ImportPlan = {
		resolvedAccounts: new Map(),
		cleanAccounts: [],
		cleanLoans: [],
		cleanCreditCards: [],
		cleanExpenses: [],
		cleanIncomes: [],
		intraFileDuplicates: [],
		existingDuplicates: [],
		txDuplicates: [],
		sessionId: generateId(),
		errors: [],
	};

	// Unwrap { data: ... } or bare object
	const file = (
		raw && typeof raw === 'object' && 'data' in (raw as object) ? (raw as ImportFile).data : raw
	) as ImportFile;

	if (!file || typeof file !== 'object') {
		plan.errors.push('Invalid file structure');
		return plan;
	}

	const now = new Date().toISOString();

	// ── 1. Accounts ─────────────────────────────────────────────────────────────
	const rawAccounts: RawAccount[] = file.accounts ?? [];
	const namesSeen = new Map<string, RawAccount[]>(); // detect intra-file dups

	for (const raw of rawAccounts) {
		if (!raw.name?.trim()) {
			plan.errors.push('Account missing name — skipped');
			continue;
		}
		const n = raw.name.trim();
		if (!namesSeen.has(n)) namesSeen.set(n, []);
		namesSeen.get(n)!.push(raw);
	}

	// Intra-file duplicates (two accounts with same name in the file)
	for (const [name, items] of namesSeen) {
		if (items.length > 1) {
			plan.intraFileDuplicates.push({ kind: 'account', name, items });
			continue;
		}
		const raw = items[0];
		const existing = state.accounts.find(
			(a) => a.name.toLowerCase() === raw.name.toLowerCase()
		);

		if (existing) {
			// Duplicate with existing account
			plan.existingDuplicates.push({
				kind: 'account',
				incoming: raw as unknown as Record<string, unknown>,
				existing: existing as unknown as Record<string, unknown>,
			});
			// Pre-resolve to existing id (can be overridden by user decision)
			plan.resolvedAccounts.set(raw.name.toLowerCase(), existing.id);
		} else {
			// New account
			const id = raw.id ?? generateId();
			const ob = raw.openingBalance ?? raw.balance ?? 0;
			plan.cleanAccounts.push({
				id,
				name: raw.name.trim(),
				type: (raw.type as Account['type']) ?? 'bank',
				openingBalance: ob,
				color: raw.color ?? '#00d4f5',
				currency: raw.currency ?? 'INR',
				notes: raw.notes,
				createdAt: now,
				updatedAt: now,
			});
			plan.resolvedAccounts.set(raw.name.toLowerCase(), id);
		}
	}

	// ── 2. Loans ─────────────────────────────────────────────────────────────────
	const rawLoans: RawLoan[] = file.loans ?? [];
	const loanNamesSeen = new Map<string, RawLoan[]>();
	for (const l of rawLoans) {
		if (!l.name?.trim()) {
			plan.errors.push('Loan missing name — skipped');
			continue;
		}
		const n = l.name.trim().toLowerCase();
		if (!loanNamesSeen.has(n)) loanNamesSeen.set(n, []);
		loanNamesSeen.get(n)!.push(l);
	}

	for (const [, items] of loanNamesSeen) {
		const l = items[0];
		const existing = state.loans.find((x) => x.name.toLowerCase() === l.name.toLowerCase());
		if (existing) {
			plan.existingDuplicates.push({
				kind: 'loan',
				incoming: l as unknown as Record<string, unknown>,
				existing: existing as unknown as Record<string, unknown>,
			});
			continue;
		}

		// Resolve account by name
		const acctId = resolveAccount(l.account, plan.resolvedAccounts, state);
		if (!acctId) {
			plan.errors.push(`Loan "${l.name}": account "${l.account}" not found`);
			continue;
		}

		const emi =
			l.emi ??
			(l.interestRate && l.tenureMonths
				? calculateEMI(l.principalAmount, l.interestRate, l.tenureMonths)
				: 0);

		plan.cleanLoans.push({
			id: l.id ?? generateId(),
			name: l.name.trim(),
			loanType: (l.loanType as Loan['loanType']) ?? 'normal',
			principalAmount: l.principalAmount,
			interestRate: l.interestRate ?? 0,
			tenureMonths: l.tenureMonths,
			startDate: l.startDate ?? todayStr(),
			emi,
			paidMonths: l.paidMonths ?? 0,
			accountId: acctId,
			taxRate: l.taxRate,
			notes: l.notes,
			createdAt: now,
			updatedAt: now,
		});
	}

	// ── 3. Credit Cards ───────────────────────────────────────────────────────────
	const rawCards: RawCreditCard[] = file.creditCards ?? [];
	for (const c of rawCards) {
		if (!c.name?.trim()) {
			plan.errors.push('Credit card missing name — skipped');
			continue;
		}
		const existing = state.creditCards.find(
			(x) => x.name.toLowerCase() === c.name.toLowerCase()
		);
		if (existing) {
			plan.existingDuplicates.push({
				kind: 'creditCard',
				incoming: c as unknown as Record<string, unknown>,
				existing: existing as unknown as Record<string, unknown>,
			});
			continue;
		}

		const statDay = c.statementDay ?? 1;
		const cycDays = c.billingCycleDays ?? 30;
		const graceDays = c.gracePeriodDays ?? 20;
		const stmtDate = nextStatementDate({ statementDay: statDay, billingCycleDays: cycDays });
		const dueDate = dueFromStatement(stmtDate, graceDays);

		plan.cleanCreditCards.push({
			id: c.id ?? generateId(),
			name: c.name.trim(),
			limit: c.limit,
			outstanding: c.outstanding ?? 0,
			statementDay: statDay,
			billingCycleDays: cycDays,
			gracePeriodDays: graceDays,
			statementDate: stmtDate.toISOString().split('T')[0],
			dueDate: dueDate.toISOString().split('T')[0],
			taxRate: c.taxRate,
			notes: c.notes,
			createdAt: now,
			updatedAt: now,
		});
	}

	// ── 4. Expenses ──────────────────────────────────────────────────────────────
	const rawExpenses: RawExpense[] = file.expenses ?? [];
	for (const e of rawExpenses) {
		if (!e.name || !e.amount || !e.date) {
			plan.errors.push(`Expense "${e.name}" missing required fields`);
			continue;
		}
		const acctId = resolveAccount(e.account, plan.resolvedAccounts, state);
		if (!acctId) {
			plan.errors.push(`Expense "${e.name}": account "${e.account}" not found`);
			continue;
		}

		// Duplicate check: same name + date + amount + account
		const existing = state.expenses.find(
			(x) =>
				x.name === e.name &&
				x.date === e.date &&
				x.amount === e.amount &&
				x.accountId === acctId
		);
		if (existing) {
			plan.txDuplicates.push({
				entity: 'expenses',
				incoming: { ...e, accountId: acctId } as unknown as Record<string, unknown>,
				existing: existing as unknown as Record<string, unknown>,
			});
			continue;
		}

		plan.cleanExpenses.push({
			id: e.id ?? generateId(),
			name: e.name,
			amount: e.amount,
			date: e.date,
			category: e.category ?? 'Other',
			accountId: acctId,
			accountHeadId: e.accountHeadId ?? 'head_expense',
			notes: e.notes,
			createdAt: now,
			updatedAt: now,
		});
	}

	// ── 5. Incomes ────────────────────────────────────────────────────────────────
	const rawIncomes: RawIncome[] = file.incomes ?? [];
	for (const i of rawIncomes) {
		if (!i.name || !i.amount || !i.date) {
			plan.errors.push(`Income "${i.name}" missing required fields`);
			continue;
		}
		const acctId = resolveAccount(i.account, plan.resolvedAccounts, state);
		if (!acctId) {
			plan.errors.push(`Income "${i.name}": account "${i.account}" not found`);
			continue;
		}

		const existing = state.incomes.find(
			(x) =>
				x.name === i.name &&
				x.date === i.date &&
				x.amount === i.amount &&
				x.accountId === acctId
		);
		if (existing) {
			plan.txDuplicates.push({
				entity: 'incomes',
				incoming: { ...i, accountId: acctId } as unknown as Record<string, unknown>,
				existing: existing as unknown as Record<string, unknown>,
			});
			continue;
		}

		plan.cleanIncomes.push({
			id: i.id ?? generateId(),
			name: i.name,
			amount: i.amount,
			date: i.date,
			accountId: acctId,
			accountHeadId: i.accountHeadId ?? 'head_income',
			category: i.category,
			notes: i.notes,
			createdAt: now,
			updatedAt: now,
		});
	}

	return plan;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveAccount(
	nameOrId: string | undefined,
	resolvedMap: Map<string, string>,
	state: AppState
): string | null {
	if (!nameOrId) return null;
	// Try by name (case-insensitive)
	const byName = resolvedMap.get(nameOrId.toLowerCase());
	if (byName) return byName;
	// Try exact match on existing accounts
	const existing = state.accounts.find(
		(a) => a.name.toLowerCase() === nameOrId.toLowerCase() || a.id === nameOrId
	);
	return existing?.id ?? null;
}

// ── Build ImportReview records for tx duplicates ───────────────────────────────
export function makeTxReviewRecords(
	duplicates: TransactionDuplicate[],
	sessionId: string
): ImportReview[] {
	const now = new Date().toISOString();
	return duplicates.map((d) => ({
		id: generateId(),
		sessionId,
		entity: d.entity as EntityName,
		incoming: d.incoming,
		existing: d.existing,
		status: 'pending' as const,
		createdAt: now,
		updatedAt: now,
	}));
}
