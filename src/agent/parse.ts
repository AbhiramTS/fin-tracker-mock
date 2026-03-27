/**
 * Parses raw AI text response into structured entity previews.
 * Extracts the fenced ```json block and resolves account-name references
 * to existing account IDs from the app state.
 */
import { format, parseISO } from 'date-fns';
import type { AppState, AccountHead, Frequency, MonthScheduleRule } from '@/types';
import type {
	AgentParsedResponse,
	MissingDataField,
	MissingDataRequest,
	ParsedEntities,
} from './types';

const ROOT_HEAD_IDS = new Set([
	'head_income',
	'head_expense',
	'head_asset',
	'head_liability',
	'head_equity',
]);

const MONTH_BASED_FREQUENCIES = new Set<Frequency>(['monthly', 'quarterly', 'yearly']);
const PREVIEW_CURRENCY = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 0,
	maximumFractionDigits: 0,
});

function normalizeMonthScheduleRule(value: unknown): MonthScheduleRule | undefined {
	return value === 'same_day' || value === 'last_day' || value === 'last_working_day'
		? value
		: undefined;
}

function inferMonthScheduleRule(
	nextDate: string,
	frequency: string,
	monthScheduleRule?: MonthScheduleRule
): MonthScheduleRule | undefined {
	if (monthScheduleRule) return monthScheduleRule;
	if (!MONTH_BASED_FREQUENCIES.has(frequency as Frequency)) return undefined;

	const parsedDate = parseISO(nextDate);
	if (Number.isNaN(parsedDate.getTime())) return undefined;

	return format(parsedDate, 'yyyy-MM-dd') === format(new Date(parsedDate.getFullYear(), parsedDate.getMonth() + 1, 0), 'yyyy-MM-dd')
		? 'last_day'
		: undefined;
}

function buildSummary(entities: ParsedEntities, fallback: string): string {
	const totalCount = Object.values(entities).reduce(
		(sum, value) => sum + (Array.isArray(value) ? value.length : 0),
		0
	);
	if (totalCount !== 1 || (entities.recurringIncomes?.length ?? 0) !== 1) return fallback;

	const recurringIncome = entities.recurringIncomes?.[0];
	if (!recurringIncome?.nextDate) return fallback;

	const parsedDate = parseISO(recurringIncome.nextDate);
	if (Number.isNaN(parsedDate.getTime())) return fallback;

	const destination = recurringIncome.accountName?.trim()
		? ` to ${recurringIncome.accountName.trim()}`
		: '';
	return `Recording ${recurringIncome.name} of ${PREVIEW_CURRENCY.format(recurringIncome.amount)}${destination}, with the next payment due on ${format(parsedDate, 'MMMM d, yyyy')}.`;
}

function resolveAccountHeadId(nameOrId: string, state: AppState): string {
	if (!nameOrId) return nameOrId;
	// System heads pass through unchanged
	if (ROOT_HEAD_IDS.has(nameOrId)) return nameOrId;
	// Match by account name (case-insensitive)
	const acct = state.accounts.find(
		(a) => a.name.toLowerCase() === nameOrId.toLowerCase()
	);
	if (acct) return acct.id;
	// Match by account head name
	const head = (state.accountHeads as AccountHead[]).find(
		(h) => h.name.toLowerCase() === nameOrId.toLowerCase()
	);
	if (head) return head.id;
	// Return as-is — might already be an ID
	return nameOrId;
}

export function resolveAccountId(
	nameOrId: string | undefined,
	state: AppState
): string | undefined {
	if (!nameOrId) return undefined;
	const found = state.accounts.find(
		(a) => a.name.toLowerCase() === nameOrId.toLowerCase()
	);
	return found?.id ?? (nameOrId || undefined);
}

export function parseAgentResponse(
	text: string,
	state: AppState
): AgentParsedResponse | null {
	const parseMissingDataRequest = (value: unknown): MissingDataRequest | undefined => {
		if (!value || typeof value !== 'object') return undefined;
		const record = value as Record<string, unknown>;
		if (typeof record.title !== 'string' || !Array.isArray(record.fields)) return undefined;

		const fields = record.fields
			.filter((field) => typeof field === 'object' && field !== null)
			.map((field) => {
				const item = field as Record<string, unknown>;
				const type = String(item.type ?? 'text');
				if (!['text', 'number', 'date', 'account'].includes(type)) return null;
				const key = String(item.key ?? '').trim();
				const label = String(item.label ?? '').trim();
				if (!key || !label) return null;
				return {
					key,
					label,
					type: type as MissingDataField['type'],
					placeholder:
						typeof item.placeholder === 'string' ? String(item.placeholder) : undefined,
					required: item.required !== false,
					helpText:
						typeof item.helpText === 'string' ? String(item.helpText) : undefined,
				};
			})
			.filter((field): field is MissingDataField => Boolean(field));

		if (!fields.length) return undefined;

		return {
			title: record.title,
			description:
				typeof record.description === 'string' ? String(record.description) : undefined,
			fields,
			allowDoLater: record.allowDoLater !== false,
		};
	};

	const extractJsonCandidate = (rawText: string): string | null => {
		// Preferred: complete fenced block
		const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
		if (fenced?.[1]) return fenced[1].trim();

		// Fallback: started fenced block but missing trailing ```
		const openFence = rawText.match(/```(?:json)?\s*([\s\S]*)$/i);
		if (openFence?.[1]) return openFence[1].trim();

		// Last fallback: raw text might be pure JSON
		const firstBrace = rawText.indexOf('{');
		if (firstBrace >= 0) return rawText.slice(firstBrace).trim();
		return null;
	};

	const candidate = extractJsonCandidate(text);
	if (!candidate) return null;

	let raw: unknown;
	try {
		raw = JSON.parse(candidate);
	} catch {
		return null;
	}

	if (typeof raw !== 'object' || raw === null) return null;
	const root = raw as Record<string, unknown>;
	const missingDataRequest = parseMissingDataRequest(root.missingData);
	if ((!root.entities || typeof root.entities !== 'object') && !missingDataRequest) return null;

	const rawEntities = (root.entities as Record<string, unknown[]>) ?? {};
	const summary =
		typeof root.summary === 'string' ? root.summary : 'Entities ready to save';

	const entities: ParsedEntities = {};

	// ── Journal Entries ──────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.journalEntries)) {
		entities.journalEntries = rawEntities.journalEntries
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const entry = e as Record<string, unknown>;
				return {
					description: String(entry.description ?? ''),
					amount: Number(entry.amount ?? 0),
					date: String(entry.date ?? new Date().toISOString().slice(0, 10)),
					type: String(entry.type ?? 'expense'),
					debitAccountHeadId: resolveAccountHeadId(
						String(entry.debitAccountHeadId ?? 'head_expense'),
						state
					),
					creditAccountHeadId: resolveAccountHeadId(
						String(entry.creditAccountHeadId ?? 'head_income'),
						state
					),
					notes: entry.notes ? String(entry.notes) : undefined,
					tags: Array.isArray(entry.tags) ? entry.tags.map(String) : undefined,
				};
			});
	}

	// ── Accounts ─────────────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.accounts)) {
		entities.accounts = rawEntities.accounts
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const acc = e as Record<string, unknown>;
				const isCreditCard = String(acc.type ?? 'bank') === 'credit_card';
				return {
					name: String(acc.name ?? ''),
					type: String(acc.type ?? 'bank'),
					openingBalance:
						acc.openingBalance !== undefined ? Number(acc.openingBalance) : 0,
					color: acc.color ? String(acc.color) : undefined,
					currency: acc.currency ? String(acc.currency) : undefined,
					...(isCreditCard && {
						creditLimit: acc.creditLimit !== undefined ? Number(acc.creditLimit) : undefined,
						outstanding: acc.outstanding !== undefined ? Number(acc.outstanding) : undefined,
						statementDay: acc.statementDay !== undefined ? Number(acc.statementDay) : undefined,
						billingCycleDays: acc.billingCycleDays !== undefined ? Number(acc.billingCycleDays) : undefined,
						gracePeriodDays: acc.gracePeriodDays !== undefined ? Number(acc.gracePeriodDays) : undefined,
						dueDate: acc.dueDate ? String(acc.dueDate) : undefined,
						statementDate: acc.statementDate ? String(acc.statementDate) : undefined,
						taxRate: acc.taxRate !== undefined ? Number(acc.taxRate) : undefined,
					}),
				};
			});
	}

	// ── Loans ─────────────────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.loans)) {
		entities.loans = rawEntities.loans
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const loan = e as Record<string, unknown>;
				return {
					name: String(loan.name ?? ''),
					principalAmount: Number(loan.principalAmount ?? 0),
					interestRate: Number(loan.interestRate ?? 0),
					tenureMonths: Number(loan.tenureMonths ?? 12),
					startDate: String(
						loan.startDate ?? new Date().toISOString().slice(0, 10)
					),
					account: loan.account ? String(loan.account) : undefined,
					paidMonths:
						loan.paidMonths !== undefined ? Number(loan.paidMonths) : 0,
					emi: loan.emi !== undefined ? Number(loan.emi) : undefined,
					loanType: loan.loanType ? String(loan.loanType) : 'normal',
				};
			});
	}

	// ── Investments ───────────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.investments)) {
		entities.investments = rawEntities.investments
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const inv = e as Record<string, unknown>;
				return {
					name: String(inv.name ?? ''),
					type: String(inv.type ?? 'other'),
					value: Number(inv.value ?? 0),
					costBasis:
						inv.costBasis !== undefined ? Number(inv.costBasis) : undefined,
					accountName: inv.accountName ? String(inv.accountName) : undefined,
					notes: inv.notes ? String(inv.notes) : undefined,
				};
			});
	}

	// ── Goals ─────────────────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.goals)) {
		entities.goals = rawEntities.goals
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const goal = e as Record<string, unknown>;
				return {
					name: String(goal.name ?? ''),
					type: String(goal.type ?? 'custom'),
					targetAmount: Number(goal.targetAmount ?? 0),
					currentAmount:
						goal.currentAmount !== undefined ? Number(goal.currentAmount) : 0,
					targetDate: goal.targetDate ? String(goal.targetDate) : undefined,
					status: String(goal.status ?? 'active'),
					monthlyContribution: goal.monthlyContribution
						? Number(goal.monthlyContribution)
						: undefined,
					notes: goal.notes ? String(goal.notes) : undefined,
				};
			});
	}

	// ── Receivables ───────────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.receivables)) {
		entities.receivables = rawEntities.receivables
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const rec = e as Record<string, unknown>;
				return {
					personName: String(rec.personName ?? ''),
					amountLent: Number(rec.amountLent ?? 0),
					dateLent: String(rec.dateLent ?? new Date().toISOString().slice(0, 10)),
					accountName: rec.accountName ? String(rec.accountName) : undefined,
					description: rec.description ? String(rec.description) : undefined,
					expectedRepaymentDate: rec.expectedRepaymentDate
						? String(rec.expectedRepaymentDate)
						: undefined,
				};
			});
	}

	// ── Recurring Payments ────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.recurringPayments)) {
		entities.recurringPayments = rawEntities.recurringPayments
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const rp = e as Record<string, unknown>;
				const nextDate = String(rp.nextDate ?? new Date().toISOString().slice(0, 10));
				const frequency = String(rp.frequency ?? 'monthly');
				return {
					name: String(rp.name ?? ''),
					amount: Number(rp.amount ?? 0),
					frequency,
					nextDate,
					monthScheduleRule: inferMonthScheduleRule(
						nextDate,
						frequency,
						normalizeMonthScheduleRule(rp.monthScheduleRule)
					),
					category: String(rp.category ?? 'Other'),
					accountName: rp.accountName ? String(rp.accountName) : undefined,
					isActive: rp.isActive !== false,
					notes: rp.notes ? String(rp.notes) : undefined,
				};
			});
	}

	// ── Recurring Incomes ─────────────────────────────────────────────────────
	if (Array.isArray(rawEntities.recurringIncomes)) {
		entities.recurringIncomes = rawEntities.recurringIncomes
			.filter((e) => typeof e === 'object' && e !== null)
			.map((e) => {
				const ri = e as Record<string, unknown>;
				const nextDate = String(ri.nextDate ?? new Date().toISOString().slice(0, 10));
				const frequency = String(ri.frequency ?? 'monthly');
				return {
					name: String(ri.name ?? ''),
					amount: Number(ri.amount ?? 0),
					frequency,
					nextDate,
					monthScheduleRule: inferMonthScheduleRule(
						nextDate,
						frequency,
						normalizeMonthScheduleRule(ri.monthScheduleRule)
					),
					accountName: ri.accountName ? String(ri.accountName) : undefined,
					isActive: ri.isActive !== false,
					notes: ri.notes ? String(ri.notes) : undefined,
				};
			});
	}

	// Only return if at least one entity type has data
	const hasEntities = Object.values(entities).some(
		(arr) => Array.isArray(arr) && arr.length > 0
	);
	if (!hasEntities && !missingDataRequest) return null;

	return { entities, summary: buildSummary(entities, summary), missingDataRequest };
}
