import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';
import { addMonths } from './format';
import type { Loan, AmortisationRow } from '@/types';

/**
 * Calculate EMI using standard formula:
 *   EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * where r = monthly rate, n = tenure months.
 * Returns the base EMI (principal + interest) — tax is computed separately.
 */
export function calculateEMI(
	principal: number,
	annualRatePercent: number,
	tenureMonths: number
): number {
	if (annualRatePercent === 0) return Math.round(principal / tenureMonths);
	const r = annualRatePercent / 12 / 100;
	const emi =
		(principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
	return Math.round(emi);
}

/**
 * Compute the effective monthly interest rate after stripping embedded tax.
 * If taxIncludedInRate = true, the stated annualRate already bakes in tax,
 * so the pure interest rate is: r_pure = r_stated / (1 + taxRate/100).
 * Otherwise the pure rate equals the stated rate.
 */
function effectiveMonthlyRate(loan: Loan): number {
	let annualRate = loan.interestRate;
	if (loan.taxIncludedInRate && loan.taxRate && loan.taxRate > 0) {
		annualRate = annualRate / (1 + loan.taxRate / 100);
	}
	return annualRate / 12 / 100;
}

/**
 * Calculate the tax amount on an interest figure.
 * Returns 0 if no taxRate is set.
 */
export function interestTax(interest: number, loan: Loan): number {
	if (!loan.taxRate || loan.taxRate <= 0) return 0;
	if (loan.taxIncludedInRate) {
		// Tax is already embedded in the interest figure; back it out.
		// interest_with_tax = interest_pure × (1 + t)
		// tax = interest_with_tax × t / (1 + t)
		return Math.round((interest * (loan.taxRate / 100)) / (1 + loan.taxRate / 100));
	}
	// Tax is charged on top of the interest.
	return Math.round(interest * (loan.taxRate / 100));
}

/**
 * Generate a full amortisation schedule for a loan.
 * Each row includes the base EMI, principal, interest, tax on interest,
 * and totalPayable (EMI + tax) — the actual cash outflow per period.
 */
export function generateAmortisation(loan: Loan): AmortisationRow[] {
	const rows: AmortisationRow[] = [];
	const r = effectiveMonthlyRate(loan);
	let balance = loan.principalAmount;
	const start = new Date(loan.startDate);

	for (let month = 1; month <= loan.tenureMonths; month++) {
		const interest = Math.round(balance * r);
		const principal = Math.min(
			Math.round(loan.emi - interest),
			Math.round(balance) // last EMI clears remainder
		);
		const closing = Math.max(0, balance - principal);
		const tax = interestTax(interest, loan);
		const dueDate = addMonths(start, month - 1);

		rows.push({
			month,
			date: format(dueDate, 'yyyy-MM-dd'),
			openingBalance: Math.round(balance),
			emi: loan.emi,
			principal,
			interest,
			tax,
			totalPayable: loan.emi + tax,
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

/** Total base interest payable over life of loan (excluding tax) */
export function totalInterest(loan: Loan): number {
	return generateAmortisation(loan).reduce((s, r) => s + r.interest, 0);
}

/** Total tax on interest over life of loan */
export function totalTax(loan: Loan): number {
	return generateAmortisation(loan).reduce((s, r) => s + r.tax, 0);
}

/** Total actual cash outflow over life of loan (principal + interest + tax) */
export function totalCost(loan: Loan): number {
	return generateAmortisation(loan).reduce((s, r) => s + r.totalPayable, 0);
}

// ── Credit card billing cycle helpers ─────────────────────────────────────────

type CreditCardCycleInput = {
	statementDay?: number;
	billingCycleDays: number;
	statementDate?: string | Date;
	gracePeriodDays?: number;
};

function toStartOfDay(d: Date): Date {
	return startOfDay(d);
}

function parseStatementAnchor(card: CreditCardCycleInput, referenceDate: Date): Date {
	if (card.statementDate instanceof Date && isValid(card.statementDate)) {
		return toStartOfDay(card.statementDate);
	}
	if (typeof card.statementDate === 'string') {
		const parsed = parseISO(card.statementDate);
		if (isValid(parsed)) return toStartOfDay(parsed);
	}

	const day = Math.max(1, Math.min(31, card.statementDay ?? 1));
	return toStartOfDay(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), day));
}

function cycleDays(card: Pick<CreditCardCycleInput, 'billingCycleDays'>): number {
	return Math.max(1, Math.round(card.billingCycleDays || 30));
}

/** Latest statement date on or before the reference date. */
export function statementDateOnOrBefore(
	card: CreditCardCycleInput,
	referenceDate: Date = new Date()
): Date {
	const ref = toStartOfDay(referenceDate);
	const anchor = parseStatementAnchor(card, ref);
	const step = cycleDays(card);

	const diff = differenceInCalendarDays(ref, anchor);
	const cycles = Math.floor(diff / step);
	let candidate = addDays(anchor, cycles * step);

	if (candidate > ref) candidate = addDays(candidate, -step);
	return toStartOfDay(candidate);
}

/** Earliest statement date on or after the reference date. */
export function statementDateOnOrAfter(
	card: CreditCardCycleInput,
	referenceDate: Date = new Date()
): Date {
	const ref = toStartOfDay(referenceDate);
	const prev = statementDateOnOrBefore(card, ref);
	if (prev >= ref) return prev;
	return toStartOfDay(addDays(prev, cycleDays(card)));
}

/**
 * Compute current cycle details from any one known statement date.
 */
export function currentCreditCardCycle(
	card: CreditCardCycleInput,
	referenceDate: Date = new Date()
) {
	const ref = toStartOfDay(referenceDate);
	const currentStatementDate = statementDateOnOrBefore(card, ref);
	const nextStatementDate = addDays(currentStatementDate, cycleDays(card));
	const cycleEndDate = addDays(nextStatementDate, -1);
	const graceDays = Math.max(0, Math.round(card.gracePeriodDays ?? 20));
	const dueDate = dueFromStatement(currentStatementDate, graceDays);
	const nextDueDate = dueDate >= ref ? dueDate : dueFromStatement(nextStatementDate, graceDays);

	return {
		currentStatementDate,
		nextStatementDate,
		cycleStartDate: currentStatementDate,
		cycleEndDate,
		dueDate,
		nextDueDate,
	};
}

/**
 * Given a credit card, compute the next statement date on or after today.
 * The statement is generated on `statementDay` of each month.
 */
export function nextStatementDate(card: {
	statementDay?: number;
	billingCycleDays: number;
	statementDate?: string | Date;
}): Date {
	return statementDateOnOrAfter(card, new Date());
}

/**
 * Given a statement date, compute the payment due date
 * by adding gracePeriodDays.
 */
export function dueFromStatement(statementDate: Date, gracePeriodDays: number): Date {
	const d = new Date(statementDate);
	d.setDate(d.getDate() + gracePeriodDays);
	return d;
}

/**
 * Compute the next due date for a credit card from its settings.
 */
export function nextCreditCardDueDate(card: {
	statementDay: number;
	billingCycleDays: number;
	gracePeriodDays: number;
}): Date {
	return dueFromStatement(nextStatementDate(card), card.gracePeriodDays);
}

/**
 * The total amount due on a credit card including tax on charges (if any).
 * outstanding = spend + CC-EMI principal portions billed this cycle
 * tax applies to the interest/finance charges component (not the spend principal).
 */
export function creditCardTotalDue(
	outstanding: number,
	financeCharges: number,
	taxRate?: number
): number {
	const tax = taxRate ? Math.round(financeCharges * (taxRate / 100)) : 0;
	return outstanding + financeCharges + tax;
}
