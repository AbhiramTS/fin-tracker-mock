import type { JournalEntry, Receivable } from '@/types';

export interface ReceivableJournalStats {
	openingBalance: number;
	totalDisbursed: number;
	totalRepaid: number;
	outstanding: number;
	isSettled: boolean;
}

export function getReceivableJournalStats(
	receivable: Receivable,
	entries: JournalEntry[]
): ReceivableJournalStats {
	const openingBalance = Math.max(0, receivable.openingBalance ?? 0);
	if (!receivable.receivableHeadId) {
		const totalDisbursed = openingBalance + (receivable.amountLent ?? 0);
		const outstanding = totalDisbursed;
		return {
			openingBalance,
			totalDisbursed,
			totalRepaid: 0,
			outstanding,
			isSettled: outstanding <= 0,
		};
	}

	let totalDisbursed = openingBalance;
	let totalRepaid = 0;

	for (const entry of entries) {
		if (entry.debitAccountHeadId === receivable.receivableHeadId) {
			totalDisbursed += entry.amount ?? 0;
		}
		if (entry.creditAccountHeadId === receivable.receivableHeadId) {
			totalRepaid += entry.amount ?? 0;
		}
	}

	const outstanding = Math.max(0, totalDisbursed - totalRepaid);
	return {
		openingBalance,
		totalDisbursed,
		totalRepaid,
		outstanding,
		isSettled: outstanding <= 0,
	};
}
