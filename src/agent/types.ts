// ── Agent config (stored in localStorage) ────────────────────────────────────
export type AgentProvider = 'openai-compatible' | 'gemini';

export interface AgentConfig {
	provider?: AgentProvider;
	baseUrl?: string; // required for openai-compatible, ignored for gemini
	apiKey: string;
	model: string; // e.g. "gpt-4o"
}

// ── Save lifecycle ────────────────────────────────────────────────────────────
export type SaveStatus = 'pending' | 'saving' | 'saved' | 'dismissed';

// ── Parsed entity shapes (account names as strings, pre-ID-resolution) ────────
export interface ParsedJournalEntry {
	description: string;
	amount: number;
	date: string; // YYYY-MM-DD
	type: string;
	debitAccountHeadId: string; // account name or head_* constant
	creditAccountHeadId: string;
	notes?: string;
	tags?: string[];
}

export interface ParsedAccount {
	name: string;
	type: string; // bank | cash | credit_card | loan | investment | receivable
	openingBalance?: number;
	color?: string;
	currency?: string;
}

export interface ParsedLoan {
	name: string;
	principalAmount: number;
	interestRate: number;
	tenureMonths: number;
	startDate: string;
	account?: string; // account name → resolved to accountId at save time
	paidMonths?: number;
	emi?: number;
	loanType?: string;
}

export interface ParsedInvestment {
	name: string;
	type: string; // stocks | mutual_fund | ppf | fd | nps | crypto | real_estate | gold | other
	value: number;
	costBasis?: number;
	accountName?: string; // resolved to accountId at save time
	notes?: string;
}

export interface ParsedGoal {
	name: string;
	type: string; // savings | debt_payoff | investment | emergency_fund | purchase | custom
	targetAmount: number;
	currentAmount?: number;
	targetDate?: string;
	status?: string; // active | completed | paused
	monthlyContribution?: number;
	notes?: string;
}

export interface ParsedReceivable {
	personName: string;
	amountLent: number;
	dateLent: string;
	accountName?: string; // resolved to accountId at save time
	description?: string;
	expectedRepaymentDate?: string;
}

export interface ParsedRecurringPayment {
	name: string;
	amount: number;
	frequency: string; // daily | weekly | fortnightly | monthly | quarterly | yearly
	nextDate: string;
	category: string;
	accountName?: string; // resolved to accountId at save time
	isActive?: boolean;
	notes?: string;
}

export interface ParsedRecurringIncome {
	name: string;
	amount: number;
	frequency: string;
	nextDate: string;
	accountName?: string; // resolved to accountId at save time
	isActive?: boolean;
	notes?: string;
}

export interface ParsedEntities {
	journalEntries?: ParsedJournalEntry[];
	accounts?: ParsedAccount[];
	loans?: ParsedLoan[];
	investments?: ParsedInvestment[];
	goals?: ParsedGoal[];
	receivables?: ParsedReceivable[];
	recurringPayments?: ParsedRecurringPayment[];
	recurringIncomes?: ParsedRecurringIncome[];
}

export interface AgentParsedResponse {
	entities: ParsedEntities;
	summary: string;
}

// ── Chat message ──────────────────────────────────────────────────────────────
export interface EntityPreview {
	entities: ParsedEntities;
	summary: string;
	saveStatus: SaveStatus;
	errorMessage?: string;
}

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: string; // ISO 8601
	preview?: EntityPreview;
}

// ── Chat session ──────────────────────────────────────────────────────────────
export interface ChatSession {
	id: string;
	title: string; // auto-derived from first user message
	messages: ChatMessage[];
	createdAt: string;
	updatedAt: string;
}

export interface ChatSessionSummary {
	id: string;
	title: string;
	messageCount: number;
	createdAt: string;
	updatedAt: string;
}
