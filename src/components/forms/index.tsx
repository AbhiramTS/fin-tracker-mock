import { useState } from "react";
import { FInput, FSelect, FGrid, FActions } from "@/components/ui/primitives";
import { T } from "@/components/ui/tokens";
import { todayStr } from "@/utils/format";
import type {
  Account, Expense, Income, RecurringPayment,
  Loan, CreditCard, Investment, Frequency, InvestmentType,
} from "@/types";

// ── Constants ─────────────────────────────────────────────────────────────────
export const ACCT_COLORS = [
  "#00d4f5","#00e5a0","#a78bfa","#ffb020",
  "#ff3d5e","#fb923c","#06d6a0","#e879f9",
];
export const EXPENSE_CATS = [
  "Food","Transport","Subscriptions","Health",
  "Shopping","Bills","Entertainment","Education","Travel","Other",
];
export const RECUR_CATS = [
  "Housing","Subscriptions","Investment","Health",
  "Insurance","Utilities","Education","Other",
];
export const FREQS: Frequency[] = ["daily","weekly","monthly","quarterly","yearly"];
export const INV_TYPES: InvestmentType[] = [
  "stocks","mutual_fund","ppf","fd","crypto","real_estate","other",
];

// ── Shared form props ─────────────────────────────────────────────────────────
interface FormProps<T> {
  initialData?: Partial<T>;
  onSave: (data: Partial<T>) => void;
  onCancel: () => void;
}

// ── AccountForm ───────────────────────────────────────────────────────────────
export function AccountForm({ initialData, onSave, onCancel }: FormProps<Account>) {
  const [f, setF] = useState<Partial<Account>>({
    name: "", type: "bank", balance: 0, color: ACCT_COLORS[0], ...initialData,
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <FGrid>
        <div style={{ gridColumn:"span 2" }}>
          <FInput label="Account Name" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. HDFC Savings" />
        </div>
        <FSelect label="Type" value={f.type ?? "bank"} onChange={e => setF({ ...f, type: e.target.value as Account["type"] })}>
          {(["bank","cash","wallet","credit"] as const).map(t => <option key={t}>{t}</option>)}
        </FSelect>
        <FInput label="Balance (₹)" type="number" value={f.balance ?? ""} onChange={e => setF({ ...f, balance: parseFloat(e.target.value) || 0 })} placeholder="0" />
      </FGrid>
      <div>
        <div style={{ fontSize:11, color:T.textMuted, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", marginBottom:7 }}>Colour</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {ACCT_COLORS.map(c => (
            <div key={c} onClick={() => setF({ ...f, color: c })} style={{ width:26, height:26, borderRadius:"50%", background:c, cursor:"pointer", border: f.color === c ? "3px solid #fff" : "3px solid transparent" }} />
          ))}
        </div>
      </div>
      <FActions onSave={() => f.name && onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── ExpenseForm ───────────────────────────────────────────────────────────────
interface ExpenseFormProps extends FormProps<Expense> { accounts: Account[]; }
export function ExpenseForm({ initialData, onSave, onCancel, accounts }: ExpenseFormProps) {
  const [f, setF] = useState<Partial<Expense>>({
    name: "", amount: undefined, date: todayStr(), category: "Food",
    accountId: accounts[0]?.id ?? "", notes: "", ...initialData,
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <FInput label="Description" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Swiggy lunch" />
      <FGrid>
        <FInput label="Amount (₹)" type="number" value={f.amount ?? ""} onChange={e => setF({ ...f, amount: parseFloat(e.target.value) || undefined })} />
        <FInput label="Date" type="date" value={f.date ?? ""} onChange={e => setF({ ...f, date: e.target.value })} />
        <FSelect label="Category" value={f.category ?? "Food"} onChange={e => setF({ ...f, category: e.target.value })}>
          {EXPENSE_CATS.map(c => <option key={c}>{c}</option>)}
        </FSelect>
        <FSelect label="Account" value={f.accountId ?? ""} onChange={e => setF({ ...f, accountId: e.target.value })}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </FSelect>
        <div style={{ gridColumn:"span 2" }}>
          <FInput label="Notes (optional)" value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} />
        </div>
      </FGrid>
      <FActions onSave={() => f.name && f.amount && onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── IncomeForm ────────────────────────────────────────────────────────────────
interface IncomeFormProps extends FormProps<Income> { accounts: Account[]; }
export function IncomeForm({ initialData, onSave, onCancel, accounts }: IncomeFormProps) {
  const [f, setF] = useState<Partial<Income>>({
    name: "", amount: undefined, frequency: "monthly",
    nextDate: todayStr(), accountId: accounts[0]?.id ?? "", ...initialData,
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <FInput label="Income Source" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Salary" />
      <FGrid>
        <FInput label="Amount (₹)" type="number" value={f.amount ?? ""} onChange={e => setF({ ...f, amount: parseFloat(e.target.value) || undefined })} />
        <FSelect label="Frequency" value={f.frequency ?? "monthly"} onChange={e => setF({ ...f, frequency: e.target.value as Frequency })}>
          {FREQS.map(fr => <option key={fr}>{fr}</option>)}
        </FSelect>
        <FInput label="Next Date" type="date" value={f.nextDate ?? ""} onChange={e => setF({ ...f, nextDate: e.target.value })} />
        <FSelect label="Into Account" value={f.accountId ?? ""} onChange={e => setF({ ...f, accountId: e.target.value })}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </FSelect>
      </FGrid>
      <FActions onSave={() => f.name && f.amount && onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── RecurringPaymentForm ──────────────────────────────────────────────────────
interface RecurringFormProps extends FormProps<RecurringPayment> { accounts: Account[]; }
export function RecurringPaymentForm({ initialData, onSave, onCancel, accounts }: RecurringFormProps) {
  const [f, setF] = useState<Partial<RecurringPayment>>({
    name: "", amount: undefined, frequency: "monthly",
    nextDate: todayStr(), category: "Housing", accountId: accounts[0]?.id ?? "", ...initialData,
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <FInput label="Payment Name" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Netflix, Rent, SIP" />
      <FGrid>
        <FInput label="Amount (₹)" type="number" value={f.amount ?? ""} onChange={e => setF({ ...f, amount: parseFloat(e.target.value) || undefined })} />
        <FSelect label="Frequency" value={f.frequency ?? "monthly"} onChange={e => setF({ ...f, frequency: e.target.value as Frequency })}>
          {FREQS.map(fr => <option key={fr}>{fr}</option>)}
        </FSelect>
        <FInput label="Next Due Date" type="date" value={f.nextDate ?? ""} onChange={e => setF({ ...f, nextDate: e.target.value })} />
        <FSelect label="Category" value={f.category ?? "Housing"} onChange={e => setF({ ...f, category: e.target.value })}>
          {RECUR_CATS.map(c => <option key={c}>{c}</option>)}
        </FSelect>
        <FSelect label="Account" value={f.accountId ?? ""} onChange={e => setF({ ...f, accountId: e.target.value })}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </FSelect>
      </FGrid>
      <FActions onSave={() => f.name && f.amount && onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── LoanForm ──────────────────────────────────────────────────────────────────
interface LoanFormProps extends FormProps<Loan> { accounts: Account[]; }
export function LoanForm({ initialData, onSave, onCancel, accounts }: LoanFormProps) {
  const [f, setF] = useState<Partial<Loan>>({
    name: "", totalAmount: undefined, emi: undefined, tenure: undefined,
    paidMonths: 0, startDate: todayStr(), accountId: accounts[0]?.id ?? "", ...initialData,
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <FInput label="Loan Name" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Home Loan" />
      <FGrid>
        <FInput label="Total Amount (₹)" type="number" value={f.totalAmount ?? ""} onChange={e => setF({ ...f, totalAmount: parseFloat(e.target.value) || undefined })} />
        <FInput label="Monthly EMI (₹)" type="number" value={f.emi ?? ""} onChange={e => setF({ ...f, emi: parseFloat(e.target.value) || undefined })} />
        <FInput label="Tenure (months)" type="number" value={f.tenure ?? ""} onChange={e => setF({ ...f, tenure: parseInt(e.target.value) || undefined })} />
        <FInput label="Months Paid" type="number" value={f.paidMonths ?? 0} onChange={e => setF({ ...f, paidMonths: parseInt(e.target.value) || 0 })} />
        <FInput label="Start Date" type="date" value={f.startDate ?? ""} onChange={e => setF({ ...f, startDate: e.target.value })} />
        <FSelect label="Deduct From" value={f.accountId ?? ""} onChange={e => setF({ ...f, accountId: e.target.value })}>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </FSelect>
      </FGrid>
      <FActions onSave={() => f.name && f.emi && onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── CreditCardForm ────────────────────────────────────────────────────────────
export function CreditCardForm({ initialData, onSave, onCancel }: FormProps<CreditCard>) {
  const [f, setF] = useState<Partial<CreditCard>>({
    name: "", limit: undefined, outstanding: 0, dueDate: todayStr(), billingDay: 1, ...initialData,
  });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <FInput label="Card Name" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. HDFC Regalia" />
      <FGrid>
        <FInput label="Limit (₹)" type="number" value={f.limit ?? ""} onChange={e => setF({ ...f, limit: parseFloat(e.target.value) || undefined })} />
        <FInput label="Outstanding (₹)" type="number" value={f.outstanding ?? ""} onChange={e => setF({ ...f, outstanding: parseFloat(e.target.value) || 0 })} />
        <FInput label="Due Date" type="date" value={f.dueDate ?? ""} onChange={e => setF({ ...f, dueDate: e.target.value })} />
        <FInput label="Statement Day" type="number" min={1} max={28} value={f.billingDay ?? 1} onChange={e => setF({ ...f, billingDay: parseInt(e.target.value) || 1 })} />
      </FGrid>
      <FActions onSave={() => f.name && f.limit && onSave(f)} onCancel={onCancel} />
    </div>
  );
}

// ── InvestmentForm ────────────────────────────────────────────────────────────
export function InvestmentForm({ initialData, onSave, onCancel }: FormProps<Investment>) {
  const [f, setF] = useState<Partial<Investment>>({ name: "", value: undefined, type: "stocks", ...initialData });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <FInput label="Investment Name" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Zerodha Portfolio" />
      <FGrid>
        <FInput label="Current Value (₹)" type="number" value={f.value ?? ""} onChange={e => setF({ ...f, value: parseFloat(e.target.value) || undefined })} />
        <FSelect label="Type" value={f.type ?? "stocks"} onChange={e => setF({ ...f, type: e.target.value as InvestmentType })}>
          {INV_TYPES.map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
        </FSelect>
      </FGrid>
      <FActions onSave={() => f.name && f.value && onSave(f)} onCancel={onCancel} />
    </div>
  );
}
