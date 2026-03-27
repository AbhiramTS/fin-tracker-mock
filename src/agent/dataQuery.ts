import type { AppState, JournalEntry } from '@/types';
import { buildForecast } from '@/utils/forecast';

type QueryTopic =
	| 'balances'
	| 'cashflow'
	| 'expenses'
	| 'income'
	| 'investments'
	| 'goals'
	| 'debt'
	| 'forecast'
	| 'recurring'
	| 'accounts'
	| 'credit_cards'
	| 'loans';

export interface QueryDataMetric {
	key: string;
	label: string;
	value: number | string;
}

export interface QueryDataResult {
	generatedAt: string;
	query: string;
	windowDays: number;
	topics: QueryTopic[];
	metrics: QueryDataMetric[];
	highlights: string[];
}

const TOPIC_KEYWORDS: Array<{ topic: QueryTopic; terms: string[] }> = [
	{ topic: 'balances', terms: ['balance', 'cash', 'money left', 'liquid', 'bank'] },
	{ topic: 'cashflow', terms: ['cashflow', 'cash flow', 'run rate', 'surplus', 'deficit'] },
	{ topic: 'expenses', terms: ['expense', 'spend', 'spent', 'cost', 'outflow'] },
	{ topic: 'income', terms: ['income', 'salary', 'earn', 'revenue', 'inflow'] },
	{
		topic: 'investments',
		terms: ['investment', 'portfolio', 'mutual fund', 'stocks', 'returns'],
	},
	{ topic: 'goals', terms: ['goal', 'target', 'emergency fund', 'debt payoff', 'milestone'] },
	{ topic: 'debt', terms: ['debt', 'liability', 'loan', 'emi', 'credit due'] },
	{ topic: 'forecast', terms: ['forecast', 'future', 'next month', 'projection', 'shortfall'] },
	{ topic: 'recurring', terms: ['recurring', 'subscription', 'monthly payment', 'autopay'] },
	{ topic: 'accounts', terms: ['account', 'wallet', 'bank account'] },
	{ topic: 'credit_cards', terms: ['credit card', 'card due', 'utilization', 'apr'] },
	{ topic: 'loans', terms: ['loan', 'emi', 'interest rate', 'tenure'] },
];

function toDate(value: string): Date {
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function isWithinDays(isoDate: string, days: number): boolean {
	if (!isoDate) return false;
	const now = Date.now();
	const then = toDate(isoDate).getTime();
	const diff = now - then;
	return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function extractWindowDays(query: string): number {
	const q = query.toLowerCase();
	if (q.includes('last 7')) return 7;
	if (q.includes('last week')) return 7;
	if (q.includes('last 30') || q.includes('this month')) return 30;
	if (q.includes('last 60')) return 60;
	if (q.includes('last 90')) return 90;
	if (q.includes('last 180') || q.includes('6 month')) return 180;
	if (q.includes('12 month') || q.includes('1 year') || q.includes('yearly')) return 365;
	return 90;
}

function detectTopics(query: string): QueryTopic[] {
	const q = query.toLowerCase();
	const topics: QueryTopic[] = [];
	for (const rule of TOPIC_KEYWORDS) {
		if (rule.terms.some((term) => q.includes(term))) topics.push(rule.topic);
	}
	if (topics.length === 0) {
		return [
			'balances',
			'cashflow',
			'expenses',
			'income',
			'investments',
			'goals',
			'debt',
			'forecast',
			'recurring',
		];
	}
	return [...new Set(topics)];
}

function findMentionedAccountIds(query: string, state: AppState): string[] {
	const q = query.toLowerCase();
	return state.accounts
		.filter((a) => !a.isArchived && q.includes(a.name.toLowerCase()))
		.map((a) => a.id);
}

function sumAmounts(entries: JournalEntry[], predicate: (entry: JournalEntry) => boolean): number {
	return entries.filter(predicate).reduce((sum, e) => sum + (e.amount || 0), 0);
}

function buildHighlights(
	monthlyIncome: number,
	monthlySpend: number,
	liquidBalance: number,
	safeToSpend: number,
	shortfallDate: string | null,
	goalGap: number,
	cardOutstanding: number
): string[] {
	const highlights: string[] = [];
	if (monthlyIncome - monthlySpend < 0) {
		highlights.push('Monthly run-rate is negative; spending currently exceeds income.');
	}
	if (liquidBalance < monthlySpend) {
		highlights.push('Liquid funds are below one month of current spending run-rate.');
	}
	if (shortfallDate) {
		highlights.push(`Forecast indicates a potential shortfall by ${shortfallDate}.`);
	}
	if (goalGap > 0 && safeToSpend > 0) {
		highlights.push(
			'There is a goal funding gap; allocate part of safe-to-spend toward active goals.'
		);
	}
	if (cardOutstanding > 0) {
		highlights.push(
			'Credit card outstanding exists; compare payoff priority against investment returns.'
		);
	}
	if (highlights.length === 0) {
		highlights.push('No immediate risk flag from current data snapshot.');
	}
	return highlights;
}

function selectMetricsByTopics(
	metrics: QueryDataMetric[],
	topics: QueryTopic[]
): QueryDataMetric[] {
	const include = new Set<string>();

	if (topics.includes('balances') || topics.includes('accounts')) {
		include.add('liquid_balance');
		include.add('net_worth_estimate');
		include.add('accounts_count');
	}
	if (topics.includes('income')) {
		include.add('income_window_total');
		include.add('monthly_income_run_rate');
	}
	if (topics.includes('expenses') || topics.includes('cashflow')) {
		include.add('spend_window_total');
		include.add('monthly_spend_run_rate');
		include.add('monthly_surplus_run_rate');
	}
	if (topics.includes('investments')) {
		include.add('investment_value');
		include.add('investment_cost_basis');
		include.add('investment_unrealized');
	}
	if (topics.includes('goals')) {
		include.add('active_goals');
		include.add('goals_target');
		include.add('goals_saved');
		include.add('goals_gap');
	}
	if (topics.includes('debt') || topics.includes('loans') || topics.includes('credit_cards')) {
		include.add('loan_outstanding_estimate');
		include.add('card_outstanding');
		include.add('total_debt_estimate');
	}
	if (topics.includes('forecast')) {
		include.add('forecast_safe_to_spend');
		include.add('forecast_monthly_obligations');
		include.add('forecast_shortfall_date');
	}
	if (topics.includes('recurring')) {
		include.add('recurring_income_monthly');
		include.add('recurring_payments_monthly');
	}

	if (include.size === 0) return metrics;
	return metrics.filter((m) => include.has(m.key));
}

export function fetchFinancialDataForQuery(query: string, state: AppState): QueryDataResult {
	const windowDays = extractWindowDays(query);
	const topics = detectTopics(query);
	const mentionedAccountIds = findMentionedAccountIds(query, state);
	const scopedEntries = state.journalEntries.filter((j) => isWithinDays(j.date, windowDays));
	const scopedAccountEntries =
		mentionedAccountIds.length > 0
			? scopedEntries.filter((j) =>
					mentionedAccountIds.some(
						(id) => j.debitAccountHeadId === id || j.creditAccountHeadId === id
					)
				)
			: scopedEntries;

	const incomeWindowTotal = sumAmounts(scopedAccountEntries, (j) => j.type === 'income');
	const expenseTypes = new Set([
		'expense',
		'emi',
		'credit_card_payment',
		'loan_payoff',
		'lending_disbursal',
	]);
	const spendWindowTotal = sumAmounts(scopedAccountEntries, (j) => expenseTypes.has(j.type));
	const monthlyFactor = 30 / windowDays;
	const monthlyIncomeRunRate = incomeWindowTotal * monthlyFactor;
	const monthlySpendRunRate = spendWindowTotal * monthlyFactor;
	const monthlySurplusRunRate = monthlyIncomeRunRate - monthlySpendRunRate;

	const liquidBalance = state.accounts
		.filter((a) => !a.isArchived && (a.type === 'bank' || a.type === 'cash'))
		.reduce((sum, a) => sum + (state.computedBalances[a.id] ?? a.openingBalance ?? 0), 0);

	const investmentValue = state.investments.reduce((sum, inv) => sum + (inv.value || 0), 0);
	const investmentCostBasis = state.investments.reduce(
		(sum, inv) => sum + (inv.costBasis || 0),
		0
	);
	const investmentUnrealized = investmentValue - investmentCostBasis;

	const loanOutstandingEstimate = state.loans.reduce((sum, loan) => {
		const paidRatio = Math.min(
			1,
			Math.max(0, (loan.paidMonths || 0) / Math.max(1, loan.tenureMonths || 1))
		);
		return sum + Math.max(0, (loan.principalAmount || 0) * (1 - paidRatio));
	}, 0);
	const cardOutstanding = state.accounts
		.filter((a) => !a.isArchived && a.type === 'credit_card')
		.reduce((sum, a) => sum + (a.creditCard?.outstanding || 0), 0);
	const totalDebtEstimate = loanOutstandingEstimate + cardOutstanding;

	const activeGoals = state.goals.filter((g) => g.status === 'active');
	const goalsTarget = activeGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
	const goalsSaved = activeGoals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
	const goalsGap = Math.max(0, goalsTarget - goalsSaved);

	const recurringIncomeMonthly = state.recurringIncomes
		.filter((r) => r.isActive)
		.reduce((sum, r) => sum + (r.amount || 0), 0);
	const recurringPaymentsMonthly = state.recurringPayments
		.filter((r) => r.isActive)
		.reduce((sum, r) => sum + (r.amount || 0), 0);

	const forecast = buildForecast(state, 180);
	const forecastShortfallDate = forecast.shortfall?.date ?? 'none';

	const assetsEstimate = liquidBalance + investmentValue;
	const liabilitiesEstimate = totalDebtEstimate;
	const netWorthEstimate = assetsEstimate - liabilitiesEstimate;

	const allMetrics: QueryDataMetric[] = [
		{
			key: 'accounts_count',
			label: 'Accounts count',
			value: state.accounts.filter((a) => !a.isArchived).length,
		},
		{ key: 'liquid_balance', label: 'Liquid balance', value: Math.round(liquidBalance) },
		{
			key: 'net_worth_estimate',
			label: 'Net worth estimate',
			value: Math.round(netWorthEstimate),
		},
		{
			key: 'income_window_total',
			label: `Income total (last ${windowDays}d)`,
			value: Math.round(incomeWindowTotal),
		},
		{
			key: 'spend_window_total',
			label: `Spending total (last ${windowDays}d)`,
			value: Math.round(spendWindowTotal),
		},
		{
			key: 'monthly_income_run_rate',
			label: 'Monthly income run-rate',
			value: Math.round(monthlyIncomeRunRate),
		},
		{
			key: 'monthly_spend_run_rate',
			label: 'Monthly spend run-rate',
			value: Math.round(monthlySpendRunRate),
		},
		{
			key: 'monthly_surplus_run_rate',
			label: 'Monthly surplus run-rate',
			value: Math.round(monthlySurplusRunRate),
		},
		{
			key: 'investment_value',
			label: 'Investment market value',
			value: Math.round(investmentValue),
		},
		{
			key: 'investment_cost_basis',
			label: 'Investment cost basis',
			value: Math.round(investmentCostBasis),
		},
		{
			key: 'investment_unrealized',
			label: 'Investment unrealized gain/loss',
			value: Math.round(investmentUnrealized),
		},
		{ key: 'active_goals', label: 'Active goals', value: activeGoals.length },
		{ key: 'goals_target', label: 'Goals total target', value: Math.round(goalsTarget) },
		{ key: 'goals_saved', label: 'Goals total saved', value: Math.round(goalsSaved) },
		{ key: 'goals_gap', label: 'Goals funding gap', value: Math.round(goalsGap) },
		{
			key: 'loan_outstanding_estimate',
			label: 'Loan outstanding estimate',
			value: Math.round(loanOutstandingEstimate),
		},
		{
			key: 'card_outstanding',
			label: 'Credit card outstanding',
			value: Math.round(cardOutstanding),
		},
		{
			key: 'total_debt_estimate',
			label: 'Total debt estimate',
			value: Math.round(totalDebtEstimate),
		},
		{
			key: 'recurring_income_monthly',
			label: 'Recurring income (monthly nominal)',
			value: Math.round(recurringIncomeMonthly),
		},
		{
			key: 'recurring_payments_monthly',
			label: 'Recurring payments (monthly nominal)',
			value: Math.round(recurringPaymentsMonthly),
		},
		{
			key: 'forecast_safe_to_spend',
			label: 'Forecast safe-to-spend',
			value: Math.round(forecast.safeToSpend),
		},
		{
			key: 'forecast_monthly_obligations',
			label: 'Forecast monthly obligations',
			value: Math.round(forecast.monthlyObligations),
		},
		{
			key: 'forecast_shortfall_date',
			label: 'Forecast shortfall date',
			value: forecastShortfallDate,
		},
	];

	const metrics = selectMetricsByTopics(allMetrics, topics);
	const highlights = buildHighlights(
		monthlyIncomeRunRate,
		monthlySpendRunRate,
		liquidBalance,
		forecast.safeToSpend,
		forecast.shortfall?.date ?? null,
		goalsGap,
		cardOutstanding
	);

	return {
		generatedAt: new Date().toISOString(),
		query,
		windowDays,
		topics,
		metrics,
		highlights,
	};
}

export function buildRealtimeQueryContext(query: string, state: AppState): string {
	const data = fetchFinancialDataForQuery(query, state);
	const metricsText = data.metrics.map((m) => `  - ${m.label}: ${m.value}`).join('\n');
	const highlightsText = data.highlights.map((h) => `  - ${h}`).join('\n');

	return `## Real-time query data
Generated at: ${data.generatedAt}
Query window: last ${data.windowDays} days
Detected topics: ${data.topics.join(', ')}

### Metrics
${metricsText}

### Highlights
${highlightsText}

Use this real-time data to answer the current user query. If the query asks for a metric not listed here, infer from app state rules and explicitly mention assumptions.`;
}
