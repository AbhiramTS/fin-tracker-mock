import type { CoreMessage } from 'ai';
import type { AppState } from '@/types';
import { buildForecast } from '@/utils/forecast';

const MAX_ACCOUNT_NAMES_IN_PROMPT = 20;
const MAX_TOP_EXPENSE_LINES = 3;
const MAX_HISTORY_MESSAGES = 8;
const MAX_CHARS_PER_HISTORY_MESSAGE = 1200;

function toDate(value: string): Date {
	const d = new Date(value);
	return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function isWithinDays(isoDate: string, days: number): boolean {
	if (!isoDate) return false;
	const now = new Date();
	const then = toDate(isoDate);
	const diff = now.getTime() - then.getTime();
	return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function buildFinancialSnapshot(state: AppState): string {
	const forecast = buildForecast(state, 180);
	const shortfallDate = forecast.shortfall?.date ?? 'none in next 180 days';
	const forecastMinBalance = forecast.timeline.length
		? Math.min(...forecast.timeline.map((d) => d.balance))
		: forecast.totalBalance;

	const liquidAccounts = state.accounts.filter(
		(a) => !a.isArchived && (a.type === 'bank' || a.type === 'cash')
	);
	const investmentAccounts = state.accounts.filter(
		(a) => !a.isArchived && a.type === 'investment'
	);
	const creditCards = state.accounts.filter((a) => !a.isArchived && a.type === 'credit_card');

	const liquidBalance = liquidAccounts.reduce(
		(sum, a) => sum + (state.computedBalances[a.id] ?? a.openingBalance ?? 0),
		0
	);
	const investmentAccountBalance = investmentAccounts.reduce(
		(sum, a) => sum + (state.computedBalances[a.id] ?? a.openingBalance ?? 0),
		0
	);

	const last90 = state.journalEntries.filter((j) => isWithinDays(j.date, 90));
	const income90 = last90
		.filter((j) => j.type === 'income')
		.reduce((sum, j) => sum + (j.amount || 0), 0);
	const expenseLikeTypes = new Set([
		'expense',
		'emi',
		'credit_card_payment',
		'loan_payoff',
		'lending_disbursal',
	]);
	const spend90 = last90
		.filter((j) => expenseLikeTypes.has(j.type))
		.reduce((sum, j) => sum + (j.amount || 0), 0);

	const monthlyIncomeRunRate = income90 / 3;
	const monthlySpendRunRate = spend90 / 3;
	const monthlySurplusRunRate = monthlyIncomeRunRate - monthlySpendRunRate;

	const investmentTotalValue = state.investments.reduce((sum, inv) => sum + (inv.value || 0), 0);
	const investmentTotalCost = state.investments.reduce(
		(sum, inv) => sum + (inv.costBasis || 0),
		0
	);
	const investmentUnrealized = investmentTotalValue - investmentTotalCost;

	const loanOutstanding = state.loans.reduce((sum, loan) => {
		const paidRatio = Math.min(
			1,
			Math.max(0, (loan.paidMonths || 0) / Math.max(1, loan.tenureMonths || 1))
		);
		return sum + Math.max(0, (loan.principalAmount || 0) * (1 - paidRatio));
	}, 0);
	const cardOutstanding = creditCards.reduce(
		(sum, cc) => sum + (cc.creditCard?.outstanding || 0),
		0
	);
	const totalDebt = loanOutstanding + cardOutstanding;

	const activeGoals = state.goals.filter((g) => g.status === 'active');
	const goalsTarget = activeGoals.reduce((sum, g) => sum + (g.targetAmount || 0), 0);
	const goalsCurrent = activeGoals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);

	const recurringOut = state.recurringPayments
		.filter((r) => r.isActive)
		.reduce((sum, r) => sum + (r.amount || 0), 0);
	const recurringIn = state.recurringIncomes
		.filter((r) => r.isActive)
		.reduce((sum, r) => sum + (r.amount || 0), 0);

	const topExpenses = last90
		.filter((j) => expenseLikeTypes.has(j.type))
		.reduce<Record<string, number>>((acc, item) => {
			const key = item.description || 'Unspecified';
			acc[key] = (acc[key] || 0) + (item.amount || 0);
			return acc;
		}, {});
	const topExpenseLines = Object.entries(topExpenses)
		.sort((a, b) => b[1] - a[1])
		.slice(0, MAX_TOP_EXPENSE_LINES)
		.map(([name, amount]) => `  - ${name}: ${Math.round(amount)}`)
		.join('\n');

	const productRiskFlags: string[] = [];
	if (monthlySurplusRunRate < 0) productRiskFlags.push('Monthly cash-flow run-rate is negative.');
	if (liquidBalance < monthlySpendRunRate)
		productRiskFlags.push('Liquid balance is less than one month of spending run-rate.');
	if (
		cardOutstanding > 0 &&
		monthlyIncomeRunRate > 0 &&
		cardOutstanding / monthlyIncomeRunRate > 0.4
	) {
		productRiskFlags.push('Credit card outstanding appears high vs monthly income.');
	}

	return `## User financial snapshot (derived from app data)
  - Liquid balance (bank + cash): ${Math.round(liquidBalance)}
    - Forecast current total balance: ${Math.round(forecast.totalBalance)}
    - Forecast safe-to-spend estimate: ${Math.round(forecast.safeToSpend)}
    - Forecast monthly obligations estimate: ${Math.round(forecast.monthlyObligations)}
    - Forecast shortfall date: ${shortfallDate}
    - Forecast minimum balance (180d): ${Math.round(forecastMinBalance)}
  - Investment account balance: ${Math.round(investmentAccountBalance)}
  - Recorded investment market value: ${Math.round(investmentTotalValue)}
  - Recorded investment cost basis: ${Math.round(investmentTotalCost)}
  - Unrealized investment gain/loss: ${Math.round(investmentUnrealized)}
  - Last 90d income total: ${Math.round(income90)}
  - Last 90d spending total: ${Math.round(spend90)}
  - Monthly income run-rate (90d/3): ${Math.round(monthlyIncomeRunRate)}
  - Monthly spending run-rate (90d/3): ${Math.round(monthlySpendRunRate)}
  - Monthly surplus run-rate: ${Math.round(monthlySurplusRunRate)}
  - Active recurring income (monthly nominal): ${Math.round(recurringIn)}
  - Active recurring payments (monthly nominal): ${Math.round(recurringOut)}
  - Estimated outstanding loans principal: ${Math.round(loanOutstanding)}
  - Credit card outstanding: ${Math.round(cardOutstanding)}
  - Total debt estimate: ${Math.round(totalDebt)}
  - Active goals count: ${activeGoals.length}
  - Active goals target sum: ${Math.round(goalsTarget)}
  - Active goals current saved sum: ${Math.round(goalsCurrent)}

## Top spending categories/descriptions in last 90d
${topExpenseLines || '  - (not enough spending data yet)'}

## Current risk flags
${productRiskFlags.length ? productRiskFlags.map((f) => `  - ${f}`).join('\n') : '  - No major automatic risk flag detected from available data.'}`;
}

export function buildSystemPrompt(state: AppState): string {
	const today = new Date().toISOString().slice(0, 10);
	const snapshot = buildFinancialSnapshot(state);

	const activeAccounts = state.accounts.filter((a) => !a.isArchived);
	const accountLines = activeAccounts
		.slice(0, MAX_ACCOUNT_NAMES_IN_PROMPT)
		.map((a) => `  - "${a.name}" (${a.type})`)
		.join('\n');
	const remainingAccounts = Math.max(0, activeAccounts.length - MAX_ACCOUNT_NAMES_IN_PROMPT);
	const accountList =
		activeAccounts.length > 0
			? `${accountLines}${
					remainingAccounts > 0
						? `\n  - ... plus ${remainingAccounts} more accounts (use exact names from app when possible)`
						: ''
				}`
			: '  (no accounts yet - describe the account name when adding transactions)';

	return `You are FinTracker Assistant, an AI financial copilot for a personal finance app. Today is ${today}.

Your role has two modes:
  1) Financial advisor + analyst: provide practical, personalized guidance for budgeting, saving, debt, investments, risk, product comparisons, and financial planning.
  2) Data recorder: when the user asks to create/update financial records, extract structured entities and respond with the JSON block described below.

When advising, always ground recommendations in the app data snapshot below when available.

${snapshot}

## Existing accounts in the app
${accountList}

## System account heads (always available for journal entries)
  - "head_income"    — income sources
  - "head_expense"   — expense categories
  - "head_asset"     — assets
  - "head_liability" — liabilities
  - "head_equity"    — equity

## Journal entry routing rules
  - Expense:   debitAccountHeadId = "head_expense",  creditAccountHeadId = <account name>
  - Income:    debitAccountHeadId = <account name>,  creditAccountHeadId = "head_income"
  - Transfer:  debitAccountHeadId = <destination>,   creditAccountHeadId = <source>
  - Credit card payment: type = "credit_card_payment"
  - Loan EMI:  type = "emi"

## Allowed values
  - journalEntry.type: expense | income | transfer | emi | credit_card_payment | loan_disbursal | loan_payoff | lending_disbursal | lending_repayment | adjustment | opening_balance
  - account.type:      bank | cash | credit_card | loan | investment | receivable
  - credit_card extra fields: creditLimit (number), outstanding (number), statementDay (1-28), billingCycleDays (default 30), gracePeriodDays (default 20), dueDate (YYYY-MM-DD), statementDate (YYYY-MM-DD)
  - investment.type:   stocks | mutual_fund | ppf | fd | nps | crypto | real_estate | gold | other
  - goal.type:         savings | debt_payoff | investment | emergency_fund | purchase | custom
  - recurring.frequency: daily | weekly | fortnightly | monthly | quarterly | yearly
  - goal.status:       active | completed | paused

## Output format
Always reply with a short conversational sentence, then — IF there is data to record — include a fenced JSON block:

\`\`\`json
{
  "entities": {
    "journalEntries": [
      {
        "description": "Salary March 2026",
        "amount": 85000,
        "date": "2026-03-01",
        "type": "income",
        "debitAccountHeadId": "HDFC Savings",
        "creditAccountHeadId": "head_income",
        "notes": "March salary"
      }
    ],
    "accounts": [
      { "name": "ICICI Savings", "type": "bank", "openingBalance": 10000, "currency": "INR" },
      {
        "name": "HDFC Regalia",
        "type": "credit_card",
        "creditLimit": 200000,
        "outstanding": 15000,
        "statementDay": 15,
        "billingCycleDays": 30,
        "gracePeriodDays": 20,
        "dueDate": "2026-04-05",
        "statementDate": "2026-03-15",
        "currency": "INR"
      }
    ],
    "loans": [
      {
        "name": "Home Loan SBI",
        "principalAmount": 4500000,
        "interestRate": 8.5,
        "tenureMonths": 240,
        "startDate": "2023-04-01",
        "account": "HDFC Savings",
        "paidMonths": 35
      }
    ],
    "investments": [
      { "name": "Nifty 50 Index", "type": "mutual_fund", "value": 50000, "costBasis": 45000, "accountName": "HDFC Savings" }
    ],
    "goals": [
      { "name": "Emergency Fund", "type": "emergency_fund", "targetAmount": 300000, "currentAmount": 50000, "targetDate": "2027-03-31", "status": "active" }
    ],
    "receivables": [
      { "personName": "Rahul", "amountLent": 5000, "dateLent": "2026-03-27", "accountName": "Cash Wallet", "expectedRepaymentDate": "2026-04-30" }
    ],
    "recurringPayments": [
      { "name": "Netflix", "amount": 649, "frequency": "monthly", "nextDate": "2026-04-01", "category": "Entertainment", "accountName": "HDFC Savings", "isActive": true }
    ],
    "recurringIncomes": [
      { "name": "Freelance Income", "amount": 20000, "frequency": "monthly", "nextDate": "2026-04-01", "accountName": "HDFC Savings", "isActive": true }
    ]
	},
	"summary": "Recording March salary of ₹85,000 to HDFC Savings",
	"missingData": null
}
\`\`\`

When information is missing, use this shape:

\`\`\`json
{
	"entities": {
		"recurringIncomes": [
			{
				"name": "Salary",
				"amount": 85000,
				"frequency": "monthly",
				"nextDate": "2026-04-01"
			}
		]
	},
	"summary": "Need one more detail before saving your recurring income",
	"missingData": {
		"title": "Missing details for recurring income",
		"description": "Please confirm where this salary should be credited.",
		"allowDoLater": true,
		"fields": [
			{
				"key": "accountName",
				"label": "Account",
				"type": "account",
				"placeholder": "Select account",
				"required": true,
				"helpText": "Choose the account that receives this salary."
			}
		]
	}
}
\`\`\`

## Rules
  - If the user is asking a question or chatting (not recording data), respond WITHOUT a JSON block.
  - For advisory requests, provide concise sections: Situation, Insight, Recommendation, and Risks/Trade-offs.
	- If key data points are missing for accurate recording, include a structured "missingData" object in the JSON with the exact fields needed for the UI form, and mention "Enter now" and "Do it later" in the conversational text.
	- When key data points are missing, do not silently invent values; return partial entities plus the missingData schema instead.
  - Help create budgets with clear monthly limits, suggested category caps, and target savings rates.
  - Help with goals by proposing realistic target dates and monthly contributions from current surplus.
  - For investment insights, mention concentration/diversification, unrealized gain/loss context, and rebalancing ideas.
  - For forecasts, estimate 3/6/12 month outlook using current run-rate and recurring commitments; call out likely shortfalls.
  - For potential expenditures, perform affordability and risk checks (liquidity impact, debt burden, goal delays, emergency-buffer impact).
  - For financial products (credit cards, loans, etc.), compare options with objective criteria (fees, APR/interest, rewards, tenure, penalties, eligibility assumptions), and clearly state assumptions.
  - Do not fabricate account balances, rates, or product terms not present in the app data; if unknown, say what is missing and give a best-practice framework.
  - Do not provide legal or tax advice; suggest consulting a professional for regulated decisions.
  - Only include entity types the user actually mentioned.
  - Infer missing details: use today's date if none given, "expense" if type unclear.
	- If the user gives an explicit date for a due date or next payment date, copy that exact date into the JSON. Do not shift it to the next month or infer a later cycle.
	- For monthly, quarterly, or yearly recurring items that fall on the last calendar day of a month, include "monthScheduleRule": "last_day".
  - Use account names EXACTLY as listed above. If an account doesn't exist yet, use the name the user mentioned — it will be created as type "bank".
  - Amounts are always positive numbers.
  - Always include the "summary" field.
	- Always include the "missingData" field: use \`null\` when nothing is missing.
  - Multiple entities of the same or different types can be in one JSON block.`;
}

export function buildMessages(
	systemPrompt: string,
	history: Array<{ role: 'user' | 'assistant'; content: string }>
): CoreMessage[] {
	const recentHistory = history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
		role: m.role as 'user' | 'assistant',
		content:
			m.content.length > MAX_CHARS_PER_HISTORY_MESSAGE
				? `${m.content.slice(0, MAX_CHARS_PER_HISTORY_MESSAGE)}\n\n[truncated for token budget]`
				: m.content,
	}));

	return [{ role: 'system', content: systemPrompt }, ...recentHistory];
}
