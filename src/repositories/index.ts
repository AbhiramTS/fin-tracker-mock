import { BaseRepository } from "./BaseRepository";
import type {
  Account, Expense, Income, RecurringPayment,
  Loan, CreditCard, Investment, BaseRecord, EntityName,
} from "@/types";

export const accountRepo          = new BaseRepository<Account>("accounts");
export const expenseRepo          = new BaseRepository<Expense>("expenses");
export const incomeRepo           = new BaseRepository<Income>("incomes");
export const recurringPaymentRepo = new BaseRepository<RecurringPayment>("recurringPayments");
export const loanRepo             = new BaseRepository<Loan>("loans");
export const creditCardRepo       = new BaseRepository<CreditCard>("creditCards");
export const investmentRepo       = new BaseRepository<Investment>("investments");

export const Repos: Record<EntityName, BaseRepository<BaseRecord>> = {
  accounts:          accountRepo          as BaseRepository<BaseRecord>,
  expenses:          expenseRepo          as BaseRepository<BaseRecord>,
  incomes:           incomeRepo           as BaseRepository<BaseRecord>,
  recurringPayments: recurringPaymentRepo as BaseRepository<BaseRecord>,
  loans:             loanRepo             as BaseRepository<BaseRecord>,
  creditCards:       creditCardRepo       as BaseRepository<BaseRecord>,
  investments:       investmentRepo       as BaseRepository<BaseRecord>,
};
