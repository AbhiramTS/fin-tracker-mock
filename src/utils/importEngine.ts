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
	JournalEntry,
	JournalEntryType,
	Loan,
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
		journalEntries?: RawJournalEntry[];
		expenses?: RawExpense[];
		incomes?: RawIncome[];
		loans?: RawLoan[];
		creditCards?: RawCreditCard[];
	};
	// Also accept flat (no wrapper)
	accounts?: RawAccount[];
	journalEntries?: RawJournalEntry[];
	expenses?: RawExpense[];
	incomes?: RawIncome[];
	loans?: RawLoan[];
	creditCards?: RawCreditCard[];
}

export interface RawJournalEntry {
	description: string;
	amount: number;
	date: string;
	type?: JournalEntryType;
	debitAccountHeadId: string; // account name or head id
	creditAccountHeadId: string; // account name or head id
	notes?: string;
	tags?: string[];
	id?: string;
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

/** A transaction that matches an existing one (same description+date+amount) */
export interface TransactionDuplicate {
	entity: 'journalEntries';
	incoming: Record<string, unknown>;
	existing: Record<string, unknown>;
}

export interface ImportPlan {
	resolvedAccounts: Map<string, string>;
	cleanAccounts: Partial<Account>[];
	cleanLoans: Partial<Loan>[];
	cleanJournalEntries: Partial<JournalEntry>[];
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
		cleanJournalEntries: [],
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
		const existing = state.accounts.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
		if (existing) {
			plan.existingDuplicates.push({
				kind: 'creditCard',
				incoming: c as unknown as Record<string, unknown>,
				existing: existing as unknown as Record<string, unknown>,
			});
			plan.resolvedAccounts.set(c.name.toLowerCase(), existing.id);
			continue;
		}

		const statDay = c.statementDay ?? 1;
		const cycDays = c.billingCycleDays ?? 30;
		const graceDays = c.gracePeriodDays ?? 20;
		const stmtDate = nextStatementDate({ statementDay: statDay, billingCycleDays: cycDays });
		const dueDate = dueFromStatement(stmtDate, graceDays);

		const id = c.id ?? generateId();
		plan.cleanAccounts.push({
			id,
			name: c.name.trim(),
			type: 'credit_card',
			openingBalance: -(c.outstanding ?? 0),
			creditCard: {
				limit: c.limit,
				outstanding: c.outstanding ?? 0,
				statementDay: statDay,
				billingCycleDays: cycDays,
				gracePeriodDays: graceDays,
				statementDate: stmtDate.toISOString().split('T')[0],
				dueDate: dueDate.toISOString().split('T')[0],
				taxRate: c.taxRate,
			},
			color: '#00d4f5',
			currency: 'INR',
			notes: c.notes,
			createdAt: now,
			updatedAt: now,
		});
		plan.resolvedAccounts.set(c.name.toLowerCase(), id);
	}

	// ── 4. Journal Entries (ledger-based) ──────────────────────────────────────
	const rawJournalEntries: RawJournalEntry[] = file.journalEntries ?? [];
	for (const je of rawJournalEntries) {
		if (!je.description || je.amount === undefined || !je.date) {
			plan.errors.push(`Journal entry "${je.description}" missing required fields`);
			continue;
		}

		const txType = (je.type as JournalEntryType) ?? 'expense';
		const debitRef = je.debitAccountHeadId?.trim();
		const creditRef = je.creditAccountHeadId?.trim();

		if (
			debitRef &&
			shouldAutoCreateMissingAccount(txType, 'debit', debitRef) &&
			!resolveAccountHead(debitRef, plan.resolvedAccounts, state)
		) {
			ensureAutoAccountForImport(debitRef, plan, state, now);
		}

		if (
			creditRef &&
			shouldAutoCreateMissingAccount(txType, 'credit', creditRef) &&
			!resolveAccountHead(creditRef, plan.resolvedAccounts, state)
		) {
			ensureAutoAccountForImport(creditRef, plan, state, now);
		}

		// Resolve debit account (can be account name or head id)
		const debitId = resolveAccountHead(debitRef, plan.resolvedAccounts, state);
		if (!debitId) {
			plan.errors.push(
				`Journal entry "${je.description}": debit account "${je.debitAccountHeadId}" not found`
			);
			continue;
		}

		// Resolve credit account (can be account name or head id)
		const creditId = resolveAccountHead(creditRef, plan.resolvedAccounts, state);
		if (!creditId) {
			plan.errors.push(
				`Journal entry "${je.description}": credit account "${je.creditAccountHeadId}" not found`
			);
			continue;
		}

		// Check for duplicate
		const existing = state.journalEntries.find(
			(x) =>
				x.description === je.description &&
				x.date === je.date &&
				x.amount === je.amount &&
				x.debitAccountHeadId === debitId &&
				x.creditAccountHeadId === creditId
		);
		if (existing) {
			plan.txDuplicates.push({
				entity: 'journalEntries',
				incoming: {
					...je,
					debitAccountHeadId: debitId,
					creditAccountHeadId: creditId,
				} as unknown as Record<string, unknown>,
				existing: existing as unknown as Record<string, unknown>,
			});
			continue;
		}

		plan.cleanJournalEntries.push({
			id: je.id ?? generateId(),
			description: je.description,
			amount: je.amount,
			date: je.date,
			type: txType,
			debitAccountHeadId: debitId,
			creditAccountHeadId: creditId,
			notes: je.notes,
			tags: je.tags,
			createdAt: now,
			updatedAt: now,
		});
	}

	// ── 5. Expenses → JournalEntries (backward compatibility) ────────────────────
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

		// Duplicate: same description + date + amount + credit account
		const existing = state.journalEntries.find(
			(x) =>
				x.type === 'expense' &&
				x.description === e.name &&
				x.date === e.date &&
				x.amount === e.amount &&
				x.creditAccountHeadId === acctId
		);
		if (existing) {
			plan.txDuplicates.push({
				entity: 'journalEntries',
				incoming: { ...e, creditAccountHeadId: acctId } as unknown as Record<
					string,
					unknown
				>,
				existing: existing as unknown as Record<string, unknown>,
			});
			continue;
		}

		plan.cleanJournalEntries.push({
			id: e.id ?? generateId(),
			description: e.name,
			amount: e.amount,
			date: e.date,
			type: 'expense',
			debitAccountHeadId: e.accountHeadId ?? 'head_expense', // expense head (Dr)
			creditAccountHeadId: acctId, // asset account (Cr)
			notes: e.notes,
			createdAt: now,
			updatedAt: now,
		});
	}

	// ── 6. Incomes → JournalEntries (backward compatibility) ─────────────────────
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

		const existing = state.journalEntries.find(
			(x) =>
				x.type === 'income' &&
				x.description === i.name &&
				x.date === i.date &&
				x.amount === i.amount &&
				x.debitAccountHeadId === acctId
		);
		if (existing) {
			plan.txDuplicates.push({
				entity: 'journalEntries',
				incoming: { ...i, debitAccountHeadId: acctId } as unknown as Record<
					string,
					unknown
				>,
				existing: existing as unknown as Record<string, unknown>,
			});
			continue;
		}

		plan.cleanJournalEntries.push({
			id: i.id ?? generateId(),
			description: i.name,
			amount: i.amount,
			date: i.date,
			type: 'income',
			debitAccountHeadId: acctId, // asset account (Dr)
			creditAccountHeadId: i.accountHeadId ?? 'head_income', // income head (Cr)
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

function resolveAccountHead(
	nameOrHeadId: string | undefined,
	resolvedMap: Map<string, string>,
	state: AppState
): string | null {
	if (!nameOrHeadId) return null;
	const key = nameOrHeadId.trim();
	const keyLc = key.toLowerCase();

	// If it's already a root head id, return it
	if (key.startsWith('head_')) {
		return key;
	}

	// Try by account name (case-insensitive)
	const byName = resolvedMap.get(keyLc);
	if (byName) return byName;

	// Try any existing account head by id or name (supports user-created heads)
	const existingHead = state.accountHeads.find(
		(h) => h.id === key || h.name.toLowerCase() === keyLc
	);
	if (existingHead) return existingHead.id;

	// Try exact match on existing accounts
	const existing = state.accounts.find((a) => a.name.toLowerCase() === keyLc || a.id === key);
	return existing?.id ?? null;
}

function shouldAutoCreateMissingAccount(
	txType: JournalEntryType,
	side: 'debit' | 'credit',
	nameOrHeadId: string
): boolean {
	if (!nameOrHeadId || nameOrHeadId.startsWith('head_')) return false;

	switch (txType) {
		case 'expense':
			return side === 'credit';
		case 'income':
			return side === 'debit';
		default:
			return true;
	}
}

function inferAccountTypeFromLabel(name: string): Account['type'] {
	const n = name.toLowerCase();
	if (n.includes('credit') && n.includes('card')) return 'credit_card';
	if (n.includes('loan') || n.includes('finance')) return 'loan';
	if (n.includes('cash') || n.includes('wallet')) return 'cash';
	if (
		n.includes('invest') ||
		n.includes('mutual') ||
		n.includes('stock') ||
		n.includes('demat')
	) {
		return 'investment';
	}
	if (n.includes('receivable') || n.includes('due')) return 'receivable';
	return 'bank';
}

function ensureAutoAccountForImport(
	name: string,
	plan: ImportPlan,
	state: AppState,
	now: string
): string {
	const trimmed = name.trim();
	const key = trimmed.toLowerCase();

	const mapped = plan.resolvedAccounts.get(key);
	if (mapped) return mapped;

	const existingAccount = state.accounts.find(
		(a) => a.name.toLowerCase() === key || a.id === trimmed
	);
	if (existingAccount) {
		plan.resolvedAccounts.set(key, existingAccount.id);
		return existingAccount.id;
	}

	const existingPlanned = plan.cleanAccounts.find(
		(a) =>
			typeof a.name === 'string' && a.name.toLowerCase() === key && typeof a.id === 'string'
	);
	if (existingPlanned?.id) {
		plan.resolvedAccounts.set(key, existingPlanned.id);
		return existingPlanned.id;
	}

	const id = generateId();
	plan.cleanAccounts.push({
		id,
		name: trimmed,
		type: inferAccountTypeFromLabel(trimmed),
		openingBalance: 0,
		color: '#00d4f5',
		currency: 'INR',
		createdAt: now,
		updatedAt: now,
	});
	plan.resolvedAccounts.set(key, id);
	return id;
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
