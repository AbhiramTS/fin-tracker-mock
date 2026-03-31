// ─────────────────────────────────────────────────────────────────────────────
//  balanceWorker.ts
//  Computes per-account balance from journal entries using double-entry rules:
//
//   Asset / Expense accounts:   balance increases on DEBIT,  decreases on CREDIT
//   Income / Liability accounts: balance increases on CREDIT, decreases on DEBIT
//
//  For balance sheet purposes we track the NET position of each account head
//  that corresponds to a real account (bank, cash, credit card, loan):
//    balance = openingBalance + Σ debits - Σ credits   (for asset accounts)
//    balance = openingBalance + Σ credits - Σ debits   (for liability accounts)
// ─────────────────────────────────────────────────────────────────────────────

import type { Account, AccountHead, JournalEntry, ComputedBalances } from '@/types';

export interface BalanceWorkerInput {
	accounts: Account[];
	accountHeads: AccountHead[];
	journalEntries: JournalEntry[];
}

export function computeBalances(input: BalanceWorkerInput): ComputedBalances {
	const { accounts, accountHeads, journalEntries } = input;
	const balances: ComputedBalances = {};

	// Seed with opening balances
	for (const acc of accounts) {
		balances[acc.id] = acc.openingBalance ?? 0;
	}

	// Build a set of account ids that map to real accounts
	const accountIds = new Set(accounts.map((a) => a.id));

	// Credit card accounts store openingBalance as -(outstanding), i.e. always negative.
	// The display formula is: outstanding = Max(0, -balance).
	// To keep that convention correct when transactions are applied, credit cards must
	// follow asset-style rules (debit increases balance, credit decreases), even though
	// their account head sits under the liability root.
	const creditCardIds = new Set(
		accounts.filter((a) => a.type === 'credit_card').map((a) => a.id)
	);

	// Find the root type for an account head
	const headMap = new Map(accountHeads.map((h) => [h.id, h]));
	function getRootType(headId: string): string | null {
		let h = headMap.get(headId);
		while (h) {
			if (h.parentId === null) return h.type;
			h = headMap.get(h.parentId ?? '');
		}
		return null;
	}

	for (const entry of journalEntries) {
		const { debitAccountHeadId: debit, creditAccountHeadId: credit, amount } = entry;

		// Apply to debit side if it maps to a real account
		if (accountIds.has(debit)) {
			// Credit cards use asset-style convention regardless of their head root type.
			const rootType = creditCardIds.has(debit) ? 'asset' : getRootType(debit);
			// Asset/Expense: debit increases balance
			// Liability/Income/Equity: debit decreases balance
			if (rootType === 'asset' || rootType === 'expense') {
				balances[debit] = (balances[debit] ?? 0) + amount;
			} else {
				balances[debit] = (balances[debit] ?? 0) - amount;
			}
		}

		// Apply to credit side if it maps to a real account
		if (accountIds.has(credit)) {
			// Credit cards use asset-style convention regardless of their head root type.
			const rootType = creditCardIds.has(credit) ? 'asset' : getRootType(credit);
			// Asset/Expense: credit decreases balance
			// Liability/Income/Equity: credit increases balance
			if (rootType === 'asset' || rootType === 'expense') {
				balances[credit] = (balances[credit] ?? 0) - amount;
			} else {
				balances[credit] = (balances[credit] ?? 0) + amount;
			}
		}
	}

	return balances;
}

// Worker message handler
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
	self.onmessage = (e: MessageEvent<BalanceWorkerInput>) => {
		try {
			(self as unknown as Worker).postMessage(computeBalances(e.data));
		} catch (err) {
			(self as unknown as Worker).postMessage({ error: String(err) });
		}
	};
}
