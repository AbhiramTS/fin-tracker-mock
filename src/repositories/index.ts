import { BaseRepository } from './BaseRepository';
import type {
	Account,
	Expense,
	Income,
	Transfer,
	RecurringPayment,
	RecurringIncome,
	Loan,
	CreditCard,
	Receivable,
	RepaymentRecord,
	Investment,
	Reconciliation,
	Goal,
	PaymentOccurrence,
	BaseRecord,
	EntityName,
} from '@/types';

export const accountRepo = new BaseRepository<Account>('accounts');
export const expenseRepo = new BaseRepository<Expense>('expenses');
export const incomeRepo = new BaseRepository<Income>('incomes');
export const transferRepo = new BaseRepository<Transfer>('transfers');
export const recurringPaymentRepo = new BaseRepository<RecurringPayment>('recurringPayments');
export const recurringIncomeRepo = new BaseRepository<RecurringIncome>('recurringIncomes');
export const loanRepo = new BaseRepository<Loan>('loans');
export const creditCardRepo = new BaseRepository<CreditCard>('creditCards');
export const receivableRepo = new BaseRepository<Receivable>('receivables');
export const repaymentRecordRepo = new BaseRepository<RepaymentRecord>('repaymentRecords');
export const investmentRepo = new BaseRepository<Investment>('investments');
export const reconciliationRepo = new BaseRepository<Reconciliation>('reconciliations');
export const goalRepo = new BaseRepository<Goal>('goals');
export const paymentOccurrenceRepo = new BaseRepository<PaymentOccurrence>('paymentOccurrences');

export const Repos: Record<EntityName, BaseRepository<BaseRecord>> = {
	accounts: accountRepo as BaseRepository<BaseRecord>,
	expenses: expenseRepo as BaseRepository<BaseRecord>,
	incomes: incomeRepo as BaseRepository<BaseRecord>,
	transfers: transferRepo as BaseRepository<BaseRecord>,
	recurringPayments: recurringPaymentRepo as BaseRepository<BaseRecord>,
	recurringIncomes: recurringIncomeRepo as BaseRepository<BaseRecord>,
	loans: loanRepo as BaseRepository<BaseRecord>,
	creditCards: creditCardRepo as BaseRepository<BaseRecord>,
	receivables: receivableRepo as BaseRepository<BaseRecord>,
	repaymentRecords: repaymentRecordRepo as BaseRepository<BaseRecord>,
	investments: investmentRepo as BaseRepository<BaseRecord>,
	reconciliations: reconciliationRepo as BaseRepository<BaseRecord>,
	goals: goalRepo as BaseRepository<BaseRecord>,
	paymentOccurrences: paymentOccurrenceRepo as BaseRepository<BaseRecord>,
};
