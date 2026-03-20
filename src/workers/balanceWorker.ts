// ─────────────────────────────────────────────────────────────────────────────
//  balanceWorker.ts
//  Runs in a Web Worker. Receives account + transaction data and returns
//  a ComputedBalances map.  Posted from AppContext whenever transactions change.
// ─────────────────────────────────────────────────────────────────────────────

import type { Account, Expense, Income, Transfer, ComputedBalances } from '@/types';

export interface BalanceWorkerInput {
	accounts: Account[];
	expenses: Expense[];
	incomes: Income[];
	transfers: Transfer[];
}

export function computeBalances(input: BalanceWorkerInput): ComputedBalances {
	const { accounts, expenses, incomes, transfers } = input;
	const balances: ComputedBalances = {};

	// Seed with opening balances
	for (const acc of accounts) {
		balances[acc.id] = acc.openingBalance ?? 0;
	}

	// Income → credit the account
	for (const inc of incomes) {
		if (balances[inc.accountId] !== undefined) {
			balances[inc.accountId] += inc.amount;
		}
	}

	// Expense → debit the account
	for (const exp of expenses) {
		if (balances[exp.accountId] !== undefined) {
			balances[exp.accountId] -= exp.amount;
		}
	}

	// Transfer → debit from, credit to
	for (const tr of transfers) {
		if (balances[tr.fromAccountId] !== undefined) {
			balances[tr.fromAccountId] -= tr.amount;
		}
		if (balances[tr.toAccountId] !== undefined) {
			balances[tr.toAccountId] += tr.amount;
		}
	}

	return balances;
}

// Worker message handler — only active when running inside a Worker context
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
	self.onmessage = (e: MessageEvent<BalanceWorkerInput>) => {
		try {
			const result = computeBalances(e.data);
			(self as unknown as Worker).postMessage(result);
		} catch (err) {
			(self as unknown as Worker).postMessage({ error: String(err) });
		}
	};
}
