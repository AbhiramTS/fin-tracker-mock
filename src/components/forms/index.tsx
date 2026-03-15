import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormGrid, FormActions } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { todayStr } from "@/utils/format";
import { calculateEMI } from "@/utils/amortisation";
import type {
  Account, Expense, Income, Transfer, RecurringPayment, RecurringIncome,
  Loan, CreditCard, Receivable, RepaymentRecord, Investment, Reconciliation,
  Goal, Frequency, LoanType, InvestmentType, GoalType, AccountType,
} from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────
export const ACCOUNT_COLORS = ["#00d4f5","#00e5a0","#a78bfa","#ffb020","#ff3d5e","#fb923c","#06d6a0","#e879f9"];
export const EXPENSE_CATS   = ["Food","Transport","Subscriptions","Health","Shopping","Bills","Entertainment","Education","Travel","Other"];
export const RECUR_CATS     = ["Housing","Subscriptions","Investment","Health","Insurance","Utilities","Education","Salary","Other"];
export const FREQS: Frequency[] = ["daily","weekly","fortnightly","monthly","quarterly","yearly"];
export const INV_TYPES: InvestmentType[] = ["stocks","mutual_fund","ppf","fd","nps","crypto","real_estate","gold","other"];
export const GOAL_TYPES: GoalType[] = ["savings","debt_payoff","investment","emergency_fund","purchase","custom"];
export const GOAL_ICONS: Record<GoalType, string> = {
  savings: "💰", debt_payoff: "💸", investment: "📈",
  emergency_fund: "🛡️", purchase: "🛍️", custom: "🎯",
};

// ── Generic form props ────────────────────────────────────────────────────────
type FP<T> = { initialData?: Partial<T>; onSave: (d: Partial<T>) => void; onCancel: () => void; };
type WithAccounts<T> = FP<T> & { accounts: Account[] };

// ── AccountForm ───────────────────────────────────────────────────────────────
export function AccountForm({ initialData, onSave, onCancel }: FP<Account>) {
  const [f, setF] = useState<Partial<Account>>({ name:"", type:"bank", balance:0, color:ACCOUNT_COLORS[0], currency:"INR", ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Account Name" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. HDFC Savings" required /></FormField>
        <FormField label="Type">
          <Select value={f.type??"bank"} onValueChange={v=>setF({...f,type:v as AccountType})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              {(["bank","cash","credit_card","loan","investment","receivable"] as AccountType[]).map(t=><SelectItem key={t} value={t}>{t.replace("_"," ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Balance (₹)"><Input type="number" value={f.balance??""} onChange={e=>setF({...f,balance:parseFloat(e.target.value)||0})} /></FormField>
      </FormGrid>
      <div>
        <Label className="mb-2 block">Colour</Label>
        <div className="flex gap-2 flex-wrap">
          {ACCOUNT_COLORS.map(c=><button key={c} type="button" onClick={()=>setF({...f,color:c})} className="h-7 w-7 rounded-full transition-transform hover:scale-110" style={{background:c,outline:f.color===c?"3px solid white":"3px solid transparent",outlineOffset:2}}/>)}
        </div>
      </div>
      <FormField label="Notes (optional)"><Textarea value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})} rows={2}/></FormField>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── ExpenseForm ───────────────────────────────────────────────────────────────
export function ExpenseForm({ initialData, onSave, onCancel, accounts }: WithAccounts<Expense>) {
  const [f, setF] = useState<Partial<Expense>>({ name:"", amount:undefined, date:todayStr(), category:"Food", accountId:accounts[0]?.id??"", ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.amount) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Description" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Swiggy lunch" required/></FormField>
        <FormField label="Amount (₹)"><Input type="number" min="0" step="0.01" value={f.amount??""} onChange={e=>setF({...f,amount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Date"><Input type="date" value={f.date??""} onChange={e=>setF({...f,date:e.target.value})} required/></FormField>
        <FormField label="Category">
          <Select value={f.category??"Food"} onValueChange={v=>setF({...f,category:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{EXPENSE_CATS.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Account">
          <Select value={f.accountId??""} onValueChange={v=>setF({...f,accountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Notes (optional)" span={2}><Input value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── IncomeForm ────────────────────────────────────────────────────────────────
export function IncomeForm({ initialData, onSave, onCancel, accounts }: WithAccounts<Income>) {
  const [f, setF] = useState<Partial<Income>>({ name:"", amount:undefined, date:todayStr(), accountId:accounts[0]?.id??"", ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.amount) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Source" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Salary" required/></FormField>
        <FormField label="Amount (₹)"><Input type="number" min="0" value={f.amount??""} onChange={e=>setF({...f,amount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Date"><Input type="date" value={f.date??""} onChange={e=>setF({...f,date:e.target.value})} required/></FormField>
        <FormField label="Into Account" span={2}>
          <Select value={f.accountId??""} onValueChange={v=>setF({...f,accountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Notes (optional)" span={2}><Input value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── TransferForm ──────────────────────────────────────────────────────────────
export function TransferForm({ initialData, onSave, onCancel, accounts }: WithAccounts<Transfer>) {
  const [f, setF] = useState<Partial<Transfer>>({ fromAccountId:accounts[0]?.id??"", toAccountId:accounts[1]?.id??"", amount:undefined, date:todayStr(), ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.fromAccountId && f.toAccountId && f.amount) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="From Account">
          <Select value={f.fromAccountId??""} onValueChange={v=>setF({...f,fromAccountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="To Account">
          <Select value={f.toAccountId??""} onValueChange={v=>setF({...f,toAccountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Amount (₹)"><Input type="number" min="0" value={f.amount??""} onChange={e=>setF({...f,amount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Date"><Input type="date" value={f.date??""} onChange={e=>setF({...f,date:e.target.value})} required/></FormField>
        <FormField label="Notes (optional)" span={2}><Input value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── RecurringPaymentForm ──────────────────────────────────────────────────────
export function RecurringPaymentForm({ initialData, onSave, onCancel, accounts }: WithAccounts<RecurringPayment>) {
  const [f, setF] = useState<Partial<RecurringPayment>>({ name:"", amount:undefined, frequency:"monthly", nextDate:todayStr(), category:"Housing", accountId:accounts[0]?.id??"", isActive:true, ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.amount) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Name" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Netflix, Rent, SIP" required/></FormField>
        <FormField label="Amount (₹)"><Input type="number" min="0" value={f.amount??""} onChange={e=>setF({...f,amount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Frequency">
          <Select value={f.frequency??"monthly"} onValueChange={v=>setF({...f,frequency:v as Frequency})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{FREQS.map(fr=><SelectItem key={fr} value={fr}>{fr}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Next Due Date"><Input type="date" value={f.nextDate??""} onChange={e=>setF({...f,nextDate:e.target.value})} required/></FormField>
        <FormField label="Category">
          <Select value={f.category??"Housing"} onValueChange={v=>setF({...f,category:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{RECUR_CATS.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Debit Account" span={2}>
          <Select value={f.accountId??""} onValueChange={v=>setF({...f,accountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── RecurringIncomeForm ───────────────────────────────────────────────────────
export function RecurringIncomeForm({ initialData, onSave, onCancel, accounts }: WithAccounts<RecurringIncome>) {
  const [f, setF] = useState<Partial<RecurringIncome>>({ name:"", amount:undefined, frequency:"monthly", nextDate:todayStr(), accountId:accounts[0]?.id??"", isActive:true, ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.amount) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Source Name" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Salary, Freelance" required/></FormField>
        <FormField label="Amount (₹)"><Input type="number" min="0" value={f.amount??""} onChange={e=>setF({...f,amount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Frequency">
          <Select value={f.frequency??"monthly"} onValueChange={v=>setF({...f,frequency:v as Frequency})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{FREQS.map(fr=><SelectItem key={fr} value={fr}>{fr}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Next Date"><Input type="date" value={f.nextDate??""} onChange={e=>setF({...f,nextDate:e.target.value})} required/></FormField>
        <FormField label="Credit Account">
          <Select value={f.accountId??""} onValueChange={v=>setF({...f,accountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Notes (optional)" span={2}><Input value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── LoanForm ──────────────────────────────────────────────────────────────────
export function LoanForm({ initialData, onSave, onCancel, accounts }: WithAccounts<Loan>) {
  const [f, setF] = useState<Partial<Loan>>({
    name:"", loanType:"normal", principalAmount:undefined, interestRate:undefined,
    tenureMonths:undefined, paidMonths:0, startDate:todayStr(),
    accountId:accounts[0]?.id??"", emi:0, ...initialData,
  });
  const computedEMI = (f.principalAmount && f.interestRate !== undefined && f.tenureMonths)
    ? calculateEMI(f.principalAmount, f.interestRate, f.tenureMonths) : 0;
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.principalAmount && f.tenureMonths) onSave({...f, emi: f.emi || computedEMI}); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Loan Name" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Home Loan" required/></FormField>
        <FormField label="Type">
          <Select value={f.loanType??"normal"} onValueChange={v=>setF({...f,loanType:v as LoanType})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="normal">Normal Loan</SelectItem><SelectItem value="credit_card">Credit Card Loan</SelectItem></SelectContent>
          </Select>
        </FormField>
        <FormField label="Principal (₹)"><Input type="number" min="0" value={f.principalAmount??""} onChange={e=>setF({...f,principalAmount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Interest Rate (% p.a.)"><Input type="number" min="0" step="0.01" value={f.interestRate??""} onChange={e=>setF({...f,interestRate:parseFloat(e.target.value)||undefined})}/></FormField>
        <FormField label="Tenure (months)"><Input type="number" min="1" value={f.tenureMonths??""} onChange={e=>setF({...f,tenureMonths:parseInt(e.target.value)||undefined})} required/></FormField>
        <FormField label={`EMI (₹) — Auto: ₹${computedEMI.toLocaleString("en-IN")}`}>
          <Input type="number" min="0" value={f.emi||""} onChange={e=>setF({...f,emi:parseFloat(e.target.value)||0})} placeholder={computedEMI ? String(computedEMI) : "auto-calculated"}/>
        </FormField>
        <FormField label="Months Paid"><Input type="number" min="0" value={f.paidMonths??0} onChange={e=>setF({...f,paidMonths:parseInt(e.target.value)||0})}/></FormField>
        <FormField label="Start Date"><Input type="date" value={f.startDate??""} onChange={e=>setF({...f,startDate:e.target.value})} required/></FormField>
        <FormField label="Debit Account" span={2}>
          <Select value={f.accountId??""} onValueChange={v=>setF({...f,accountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Notes (optional)" span={2}><Textarea value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})} rows={2}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── CreditCardForm ────────────────────────────────────────────────────────────
export function CreditCardForm({ initialData, onSave, onCancel }: FP<CreditCard>) {
  const [f, setF] = useState<Partial<CreditCard>>({ name:"", limit:undefined, outstanding:0, dueDate:todayStr(), statementDate:todayStr(), billingDay:1, ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.limit) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Card Name" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. HDFC Regalia" required/></FormField>
        <FormField label="Credit Limit (₹)"><Input type="number" min="0" value={f.limit??""} onChange={e=>setF({...f,limit:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Outstanding (₹)"><Input type="number" min="0" value={f.outstanding??""} onChange={e=>setF({...f,outstanding:parseFloat(e.target.value)||0})}/></FormField>
        <FormField label="Due Date"><Input type="date" value={f.dueDate??""} onChange={e=>setF({...f,dueDate:e.target.value})} required/></FormField>
        <FormField label="Statement Date"><Input type="date" value={f.statementDate??""} onChange={e=>setF({...f,statementDate:e.target.value})}/></FormField>
        <FormField label="Billing Day (1–28)"><Input type="number" min="1" max="28" value={f.billingDay??1} onChange={e=>setF({...f,billingDay:parseInt(e.target.value)||1})}/></FormField>
        <FormField label="Notes (optional)"><Input value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── ReceivableForm ────────────────────────────────────────────────────────────
export function ReceivableForm({ initialData, onSave, onCancel, accounts }: WithAccounts<Receivable>) {
  const [f, setF] = useState<Partial<Receivable>>({ personName:"", amountLent:undefined, amountRepaid:0, dateLent:todayStr(), accountId:accounts[0]?.id??"", isSettled:false, ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.personName && f.amountLent) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Person / Entity" span={2}><Input value={f.personName??""} onChange={e=>setF({...f,personName:e.target.value})} placeholder="Who did you lend to?" required/></FormField>
        <FormField label="Amount Lent (₹)"><Input type="number" min="0" value={f.amountLent??""} onChange={e=>setF({...f,amountLent:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Date Lent"><Input type="date" value={f.dateLent??""} onChange={e=>setF({...f,dateLent:e.target.value})} required/></FormField>
        <FormField label="Expected Repayment"><Input type="date" value={f.expectedRepaymentDate??""} onChange={e=>setF({...f,expectedRepaymentDate:e.target.value})}/></FormField>
        <FormField label="From Account">
          <Select value={f.accountId??""} onValueChange={v=>setF({...f,accountId:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Description" span={2}><Input value={f.description??""} onChange={e=>setF({...f,description:e.target.value})} placeholder="What was it for?"/></FormField>
        <FormField label="Notes (optional)" span={2}><Textarea value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})} rows={2}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── RepaymentForm ─────────────────────────────────────────────────────────────
export function RepaymentForm({ receivableId, onSave, onCancel }: { receivableId:string; onSave:(d:Partial<RepaymentRecord>)=>void; onCancel:()=>void }) {
  const [f, setF] = useState<Partial<RepaymentRecord>>({ receivableId, amount:undefined, date:todayStr() });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.amount) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Amount Received (₹)"><Input type="number" min="0" value={f.amount??""} onChange={e=>setF({...f,amount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Date"><Input type="date" value={f.date??""} onChange={e=>setF({...f,date:e.target.value})} required/></FormField>
        <FormField label="Notes (optional)" span={2}><Input value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel} saveLabel="Record Repayment"/>
    </form>
  );
}

// ── InvestmentForm ────────────────────────────────────────────────────────────
export function InvestmentForm({ initialData, onSave, onCancel }: FP<Investment>) {
  const [f, setF] = useState<Partial<Investment>>({ name:"", value:undefined, type:"stocks", ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.value) onSave(f); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Name" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Zerodha Portfolio" required/></FormField>
        <FormField label="Current Value (₹)"><Input type="number" min="0" value={f.value??""} onChange={e=>setF({...f,value:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Cost Basis (₹)"><Input type="number" min="0" value={f.costBasis??""} onChange={e=>setF({...f,costBasis:parseFloat(e.target.value)||undefined})}/></FormField>
        <FormField label="Type" span={2}>
          <Select value={f.type??"stocks"} onValueChange={v=>setF({...f,type:v as InvestmentType})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{INV_TYPES.map(t=><SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Notes (optional)" span={2}><Input value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}

// ── ReconciliationForm ────────────────────────────────────────────────────────
export function ReconciliationForm({ account, trackedBalance, onSave, onCancel }: {
  account: Account; trackedBalance: number;
  onSave: (d: Partial<Reconciliation>) => void; onCancel: () => void;
}) {
  const [actual, setActual] = useState("");
  const [notes,  setNotes]  = useState("");
  const actualNum = parseFloat(actual) || 0;
  const diff = actualNum - trackedBalance;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!actual) return;
    onSave({
      accountId: account.id, reconciledDate: todayStr(),
      trackedBalance, actualBalance: actualNum,
      difference: diff, status: "completed", notes,
    });
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <p className="text-muted-foreground">Account: <span className="font-semibold text-foreground">{account.name}</span></p>
        <p className="text-muted-foreground mt-1">Tracked balance: <span className="font-mono font-bold text-foreground">₹{trackedBalance.toLocaleString("en-IN")}</span></p>
      </div>
      <FormField label="Actual Balance (₹) — from your bank statement">
        <Input type="number" step="0.01" value={actual} onChange={e=>setActual(e.target.value)} placeholder="Enter actual balance" required autoFocus/>
      </FormField>
      {actual && (
        <div className={`rounded-lg p-3 text-sm font-semibold ${diff===0 ? "bg-profit/10 text-profit" : "bg-warning/10 text-warning"}`}>
          {diff === 0 ? "✓ Balanced — no difference" : `Difference: ₹${Math.abs(diff).toLocaleString("en-IN")} ${diff > 0 ? "(actual is higher)" : "(actual is lower)"}`}
        </div>
      )}
      <FormField label="Notes (optional)"><Textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="e.g. bank charges not recorded"/></FormField>
      <FormActions onCancel={onCancel} saveLabel="Reconcile"/>
    </form>
  );
}

// ── GoalForm ──────────────────────────────────────────────────────────────────
export function GoalForm({ initialData, onSave, onCancel }: FP<Goal>) {
  const [f, setF] = useState<Partial<Goal>>({ name:"", type:"savings", targetAmount:undefined, currentAmount:0, status:"active", icon:"🎯", ...initialData });
  const submit = (e: FormEvent) => { e.preventDefault(); if (f.name && f.targetAmount) onSave({...f, icon: GOAL_ICONS[f.type as GoalType] ?? "🎯"}); };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5 pt-2">
      <FormGrid>
        <FormField label="Goal Name" span={2}><Input value={f.name??""} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Emergency Fund" required/></FormField>
        <FormField label="Goal Type" span={2}>
          <Select value={f.type??"savings"} onValueChange={v=>setF({...f,type:v as GoalType})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{GOAL_TYPES.map(t=><SelectItem key={t} value={t}>{GOAL_ICONS[t]} {t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Target Amount (₹)"><Input type="number" min="0" value={f.targetAmount??""} onChange={e=>setF({...f,targetAmount:parseFloat(e.target.value)||undefined})} required/></FormField>
        <FormField label="Current Amount (₹)"><Input type="number" min="0" value={f.currentAmount??""} onChange={e=>setF({...f,currentAmount:parseFloat(e.target.value)||0})}/></FormField>
        <FormField label="Monthly Contribution (₹)"><Input type="number" min="0" value={f.monthlyContribution??""} onChange={e=>setF({...f,monthlyContribution:parseFloat(e.target.value)||undefined})}/></FormField>
        <FormField label="Target Date"><Input type="date" value={f.targetDate??""} onChange={e=>setF({...f,targetDate:e.target.value})}/></FormField>
        <FormField label="Notes (optional)" span={2}><Textarea value={f.notes??""} onChange={e=>setF({...f,notes:e.target.value})} rows={2}/></FormField>
      </FormGrid>
      <FormActions onCancel={onCancel}/>
    </form>
  );
}
