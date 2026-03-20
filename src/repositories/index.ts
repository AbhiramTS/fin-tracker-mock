import { BaseRepository } from './BaseRepository';
import type {
	Account,
	AccountHead,
	JournalEntry,
	RecurringPayment,
	RecurringIncome,
	Loan,
	Receivable,
	RepaymentRecord,
	Investment,
	Reconciliation,
	Goal,
	PaymentOccurrence,
	ImportReview,
	BaseRecord,
	EntityName,
} from '@/types';

type LegacyCreditCardRecord = BaseRecord & {
	name: string;
	limit: number;
	outstanding: number;
	statementDay: number;
	billingCycleDays: number;
	gracePeriodDays: number;
	dueDate: string;
	statementDate: string;
	taxRate?: number;
	notes?: string;
};

export const accountRepo = new BaseRepository<Account>('accounts');
export const accountHeadRepo = new BaseRepository<AccountHead>('accountHeads');
export const journalEntryRepo = new BaseRepository<JournalEntry>('journalEntries');
export const recurringPaymentRepo = new BaseRepository<RecurringPayment>('recurringPayments');
export const recurringIncomeRepo = new BaseRepository<RecurringIncome>('recurringIncomes');
export const loanRepo = new BaseRepository<Loan>('loans');
export const legacyCreditCardRepo = new BaseRepository<LegacyCreditCardRecord>('creditCards');
export const receivableRepo = new BaseRepository<Receivable>('receivables');
export const repaymentRecordRepo = new BaseRepository<RepaymentRecord>('repaymentRecords');
export const investmentRepo = new BaseRepository<Investment>('investments');
export const reconciliationRepo = new BaseRepository<Reconciliation>('reconciliations');
export const goalRepo = new BaseRepository<Goal>('goals');
export const paymentOccurrenceRepo = new BaseRepository<PaymentOccurrence>('paymentOccurrences');
export const importReviewRepo = new BaseRepository<ImportReview>('importReviews');

export const Repos: Record<EntityName, BaseRepository<BaseRecord>> = {
	accounts: accountRepo as BaseRepository<BaseRecord>,
	accountHeads: accountHeadRepo as BaseRepository<BaseRecord>,
	journalEntries: journalEntryRepo as BaseRepository<BaseRecord>,
	recurringPayments: recurringPaymentRepo as BaseRepository<BaseRecord>,
	recurringIncomes: recurringIncomeRepo as BaseRepository<BaseRecord>,
	loans: loanRepo as BaseRepository<BaseRecord>,
	receivables: receivableRepo as BaseRepository<BaseRecord>,
	repaymentRecords: repaymentRecordRepo as BaseRepository<BaseRecord>,
	investments: investmentRepo as BaseRepository<BaseRecord>,
	reconciliations: reconciliationRepo as BaseRepository<BaseRecord>,
	goals: goalRepo as BaseRepository<BaseRecord>,
	paymentOccurrences: paymentOccurrenceRepo as BaseRepository<BaseRecord>,
	importReviews: importReviewRepo as BaseRepository<BaseRecord>,
};
