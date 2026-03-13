import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { T } from "@/components/ui/tokens";
import { CHART_TOOLTIP_STYLE, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { fmt, fmtShort } from "@/utils/format";
import type { ForecastDay, Expense, Investment, Account, Loan, CreditCard } from "@/types";

// ── Shared tooltip props ──────────────────────────────────────────────────────
const TIP = {
  contentStyle: CHART_TOOLTIP_STYLE,
  labelStyle:   { color: T.textMuted },
};

// ── 60 / 90-day balance forecast (area chart) ─────────────────────────────────
interface ForecastChartProps { timeline: ForecastDay[]; height?: number; }
export function ForecastChart({ timeline, height = 140 }: ForecastChartProps) {
  if (timeline.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim, fontSize: 12 }}>
        Add income &amp; payments to see forecast
      </div>
    );
  }
  const data = timeline.map((t) => ({ name: fmtShort(t.date), v: Math.round(t.balance / 1000) }));
  const color = timeline.some((t) => t.balance < 0) ? T.red : T.cyan;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fcg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.22} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="name" tick={{ fill: T.textDim, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide />
        <Tooltip {...TIP} formatter={(v: number) => [`₹${v}k`, "Balance"]} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#fcg)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Spending donut ────────────────────────────────────────────────────────────
export function SpendingDonut({ expenses, height = 160 }: { expenses: Expense[]; height?: number }) {
  const totals = expenses.reduce<Record<string, number>>((a, e) => {
    a[e.category] = (a[e.category] ?? 0) + (e.amount ?? 0); return a;
  }, {});
  const data = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([name, value]) => ({ name, value: Math.round(value) }));

  if (!data.length) return <EmptyState icon="🍩" title="No expenses yet" />;

  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ flexShrink: 0 }}>
        <ResponsiveContainer width={height} height={height}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={height * 0.28} outerRadius={height * 0.44} paddingAngle={3} dataKey="value" strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={T.chart[i % T.chart.length]} />)}
            </Pie>
            <Tooltip {...TIP} formatter={(v: number) => [fmt(v), "Spent"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={d.name}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textMuted, marginBottom: 3 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.chart[i % T.chart.length], display: "inline-block" }} />
                {d.name}
              </span>
              <span style={{ fontFamily: T.mono, color: T.text, fontWeight: 700 }}>{((d.value / total) * 100).toFixed(0)}%</span>
            </div>
            <ProgressBar value={(d.value / total) * 100} color={T.chart[i % T.chart.length]} height={3} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Monthly spending bars ────────────────────────────────────────────────────
export function MonthlyBarsChart({ expenses, height = 130 }: { expenses: Expense[]; height?: number }) {
  const months: Record<string, { label: string; v: number }> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months[key] = { label: d.toLocaleDateString("en-IN", { month: "short" }), v: 0 };
  }
  expenses.forEach((e) => { const k = e.date?.slice(0, 7); if (k && months[k]) months[k].v += e.amount ?? 0; });
  const data = Object.values(months).map((m) => ({ ...m, v: Math.round(m.v) }));
  const maxV = Math.max(...data.map((d) => d.v), 1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={22}>
        <XAxis dataKey="label" tick={{ fill: T.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip {...TIP} formatter={(v: number) => [fmt(v), "Spent"]} />
        <Bar dataKey="v" radius={[5, 5, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.v === maxV ? T.cyan : T.cyanDim} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Net worth trend (line) ───────────────────────────────────────────────────
interface NetWorthChartProps {
  accounts:    Account[];
  investments: Investment[];
  loans:       Loan[];
  creditCards: CreditCard[];
  height?:     number;
}
export function NetWorthChart({ accounts, investments, loans, creditCards, height = 120 }: NetWorthChartProps) {
  const bal  = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const inv  = investments.reduce((s, i) => s + (i.value ?? 0), 0);
  const debt = loans.reduce((s, l) => s + Math.max(0, (l.totalAmount ?? 0) - (l.emi ?? 0) * (l.paidMonths ?? 0)), 0)
             + creditCards.reduce((s, c) => s + (c.outstanding ?? 0), 0);
  const nw = bal + inv - debt;

  const data = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - 5 + i);
    return { label: d.toLocaleDateString("en-IN", { month: "short" }), v: Math.round((nw * (0.82 + i * 0.036)) / 1000) };
  });

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fill: T.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip {...TIP} formatter={(v: number) => [`₹${v}k`, "Net Worth"]} />
        <Line type="monotone" dataKey="v" stroke={T.green} strokeWidth={2.5} dot={{ fill: T.green, r: 3, strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Investment portfolio donut ────────────────────────────────────────────────
export function PortfolioDonut({ investments, height = 130 }: { investments: Investment[]; height?: number }) {
  const byType = investments.reduce<Record<string, number>>((a, i) => {
    a[i.type] = (a[i.type] ?? 0) + (i.value ?? 0); return a;
  }, {});
  const data = Object.entries(byType).map(([name, value]) => ({ name: name.replace("_", " "), value: Math.round(value) }));

  if (data.length < 2) return null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <ResponsiveContainer width={180} height={height}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" outerRadius={58} paddingAngle={4} dataKey="value" strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={T.chart[i % T.chart.length]} />)}
            </Pie>
            <Tooltip {...TIP} formatter={(v: number) => [fmt(v), "Value"]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 }}>
        {data.map((d, i) => (
          <span key={d.name} style={{ fontSize: 11, color: T.chart[i % T.chart.length], display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.chart[i % T.chart.length], display: "inline-block" }} />
            {d.name}
          </span>
        ))}
      </div>
    </>
  );
}
