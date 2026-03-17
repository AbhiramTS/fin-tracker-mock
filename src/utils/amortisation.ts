import { format } from 'date-fns';
import { addMonths } from './format';
import type { Loan, AmortisationRow } from '@/types';

/**
 * Calculate EMI using standard formula:
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * where r = monthly rate, n = tenure months
 */
export function calculateEMI(
	principal: number,
	annualRatePercent: number,
	tenureMonths: number
): number {
	if (annualRatePercent === 0) return principal / tenureMonths;
	const r = annualRatePercent / 12 / 100;
	const emi =
		(principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
	return Math.round(emi);
}

/**
 * Generate a full amortisation schedule for a loan.
 * Returns one row per EMI period from the very beginning (paid + future).
 */
export function generateAmortisation(loan: Loan): AmortisationRow[] {
	const rows: AmortisationRow[] = [];
	const r = loan.interestRate / 12 / 100;
	let balance = loan.principalAmount;
	const start = new Date(loan.startDate);

	for (let month = 1; month <= loan.tenureMonths; month++) {
		const interest = Math.round(balance * r);
		const principal = Math.round(loan.emi - interest);
		const closing = Math.max(0, balance - principal);
		const dueDate = addMonths(start, month - 1);

		rows.push({
			month,
			date: format(dueDate, 'yyyy-MM-dd'),
			openingBalance: Math.round(balance),
			emi: loan.emi,
			principal: Math.min(principal, Math.round(balance)), // last EMI may differ
			interest,
			closingBalance: Math.round(closing),
			isPaid: month <= (loan.paidMonths ?? 0),
		});

		balance = closing;
		if (balance <= 0) break;
	}

	return rows;
}

/** Outstanding principal remaining on a loan */
export function outstandingPrincipal(loan: Loan): number {
	const rows = generateAmortisation(loan);
	const paidRows = rows.filter((r) => r.isPaid);
	if (!paidRows.length) return loan.principalAmount;
	return paidRows[paidRows.length - 1].closingBalance;
}

/** Next EMI due date as yyyy-MM-dd */
export function nextEMIDate(loan: Loan): string {
	const rows = generateAmortisation(loan);
	const next = rows.find((r) => !r.isPaid);
	return next?.date ?? '';
}

/** Total interest payable over life of loan */
export function totalInterest(loan: Loan): number {
	const schedule = generateAmortisation(loan);
	return schedule.reduce((s, r) => s + r.interest, 0);
}
