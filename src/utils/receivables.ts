import type { JournalEntry, Receivable } from '@/types';

export interface ReceivableJournalStats {
	openingBalance: number;
	totalDisbursed: number;
	totalRepaid: number;
	outstanding: number;
	isSettled: boolean;
}

export interface PersonNetStats {
	openingBalance: number;
	netLent: number;
	netBorrowed: number;
	netBalance: number;
	totalDisbursed: number;
	totalRepaid: number;
	outstanding: number;
	isSettled: boolean;
}

export function getPersonNetStats(receivable: Receivable, entries: JournalEntry[]): PersonNetStats {
	const openingBalance = Math.max(0, receivable.openingBalance ?? 0);
	let netLent = 0;
	let netBorrowed = 0;
	let totalDisbursed = openingBalance;
	let totalRepaid = 0;

	if (!receivable.receivableHeadId && !receivable.payableHeadId) {
		netLent = Math.max(0, receivable.amountLent ?? 0);
		totalDisbursed += netLent;
		const netBalance = netLent;
		return {
			openingBalance,
			netLent,
			netBorrowed,
			netBalance,
			totalDisbursed,
			totalRepaid,
			outstanding: Math.max(0, totalDisbursed - totalRepaid),
			isSettled: netBalance === 0,
		};
	}

	for (const entry of entries) {
		if (receivable.receivableHeadId) {
			if (entry.debitAccountHeadId === receivable.receivableHeadId) {
				netLent += entry.amount ?? 0;
				totalDisbursed += entry.amount ?? 0;
			}
			if (entry.creditAccountHeadId === receivable.receivableHeadId) {
				totalRepaid += entry.amount ?? 0;
			}
		}
		if (receivable.payableHeadId) {
			if (entry.creditAccountHeadId === receivable.payableHeadId) {
				netBorrowed += entry.amount ?? 0;
				totalDisbursed += entry.amount ?? 0;
			}
			if (entry.debitAccountHeadId === receivable.payableHeadId) {
				netBorrowed -= entry.amount ?? 0;
				totalRepaid += entry.amount ?? 0;
			}
		}
	}

	netBorrowed = Math.max(0, netBorrowed);
	const outstanding = Math.max(0, totalDisbursed - totalRepaid);
	const netBalance = netLent - netBorrowed;
	return {
		openingBalance,
		netLent,
		netBorrowed,
		netBalance,
		totalDisbursed,
		totalRepaid,
		outstanding,
		isSettled: netBalance === 0,
	};
}

export function getReceivableJournalStats(
	receivable: Receivable,
	entries: JournalEntry[]
): ReceivableJournalStats {
	const stats = getPersonNetStats(receivable, entries);
	return {
		openingBalance: stats.openingBalance,
		totalDisbursed: stats.totalDisbursed,
		totalRepaid: stats.totalRepaid,
		outstanding: stats.outstanding,
		isSettled: stats.isSettled,
	};
}
