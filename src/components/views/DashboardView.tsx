import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { buildForecast } from "@/utils/forecast";
import { fmt, fmtDate, daysFromNow } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Badge, KpiCard } from "@/components/ui/primitives";
import {
  ForecastChart, SpendingDonut, MonthlyBarsChart, NetWorthChart,
} from "@/components/charts";

export function DashboardView() {
  const { state } = useApp();
  const { timeline, shortfall, safeToSpend, totalBalance } = useMemo(
    () => buildForecast(state, 60), [state],
  );

  const totalInv   = state.investments.reduce((s, i) => s + (i.value ?? 0), 0);
  const totalLoans = state.loans.reduce((s, l) => s + Math.max(0, (l.totalAmount ?? 0) - (l.emi ?? 0) * (l.paidMonths ?? 0)), 0);
  const totalCC    = state.creditCards.reduce((s, c) => s + (c.outstanding ?? 0), 0);
  const netWorth   = totalBalance + totalInv - totalLoans - totalCC;
  const monthlyOut = state.recurringPayments.reduce((s, r) => s + (r.amount ?? 0), 0)
                   + state.loans.reduce((s, l) => s + (l.emi ?? 0), 0);
  const stress     = Math.min(100, Math.round(((totalLoans + totalCC) / Math.max(totalBalance + totalInv, 1)) * 100));
  const nextIncome = [...state.incomes].sort((a, b) => (a.nextDate ?? "").localeCompare(b.nextDate ?? ""))[0];

  const upcoming = [
    ...state.recurringPayments.map(r => ({ name: r.name, date: r.nextDate, amount: r.amount })),
    ...state.creditCards.map(c => ({ name: `${c.name} Bill`, date: c.dueDate, amount: c.outstanding })),
  ].filter(u => u.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* KPI grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <KpiCard icon="💰" label="Balance"     value={fmt(totalBalance)} color={T.cyan} />
        <KpiCard icon="✅" label="Safe Spend"  value={fmt(safeToSpend)}  color={T.green} />
        <KpiCard icon="📈" label="Net Worth"   value={fmt(netWorth)}     color={netWorth >= 0 ? T.green : T.red} />
        <KpiCard icon="📅" label="Monthly Out" value={fmt(monthlyOut)}   color={T.yellow} />
      </div>

      {/* 60-day forecast */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.text }}>60-Day Forecast</span>
          <Badge color={shortfall ? T.red : T.green}>
            {shortfall ? `⚠ Shortfall ${fmtDate(shortfall.date)}` : "✓ Stable"}
          </Badge>
        </div>
        <ForecastChart timeline={timeline} height={130} />
      </Card>

      {/* Spending breakdown */}
      {state.expenses.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>Spending Breakdown</div>
          <SpendingDonut expenses={state.expenses} height={150} />
        </Card>
      )}

      {/* Monthly bars */}
      {state.expenses.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>Monthly Spending</div>
          <MonthlyBarsChart expenses={state.expenses} height={120} />
        </Card>
      )}

      {/* Stress + Next Income */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <Card style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8, padding:14 }}>
          <div style={{ fontSize:10, color:T.textMuted, fontWeight:700, letterSpacing:.5, textTransform:"uppercase" }}>Stress Score</div>
          <div style={{ position:"relative", width:72, height:72 }}>
            <svg viewBox="0 0 36 36" style={{ transform:"rotate(-90deg)", width:"100%", height:"100%" }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={T.border} strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.9" fill="none"
                stroke={stress < 35 ? T.green : stress < 65 ? T.yellow : T.red}
                strokeWidth="3.5" strokeDasharray={`${stress} 100`} strokeLinecap="round" />
            </svg>
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:16, fontWeight:800, fontFamily:T.mono }}>{stress}</span>
            </div>
          </div>
          <div style={{ fontSize:12, fontWeight:700, color: stress < 35 ? T.green : stress < 65 ? T.yellow : T.red }}>
            {stress < 35 ? "Low" : stress < 65 ? "Moderate" : "High"}
          </div>
        </Card>

        <Card style={{ padding:14 }}>
          <div style={{ fontSize:10, color:T.textMuted, fontWeight:700, letterSpacing:.5, textTransform:"uppercase", marginBottom:8 }}>Next Income</div>
          {nextIncome ? (
            <>
              <div style={{ fontFamily:T.mono, fontSize:18, fontWeight:800, color:T.green }}>{fmt(nextIncome.amount)}</div>
              <div style={{ fontSize:12, color:T.textMuted, marginTop:4 }}>{nextIncome.name}</div>
              <div style={{ fontSize:11, color:T.textDim }}>{fmtDate(nextIncome.nextDate)}</div>
            </>
          ) : (
            <div style={{ fontSize:12, color:T.textDim }}>No income set</div>
          )}
        </Card>
      </div>

      {/* Net worth trend */}
      {(state.accounts.length > 0 || state.investments.length > 0) && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:10 }}>Net Worth Trend</div>
          <NetWorthChart
            accounts={state.accounts} investments={state.investments}
            loans={state.loans} creditCards={state.creditCards} height={110}
          />
        </Card>
      )}

      {/* Upcoming payments */}
      {upcoming.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>Upcoming Payments</div>
          {upcoming.map((u, i) => {
            const days = daysFromNow(u.date);
            return (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom: i < upcoming.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{u.name}</div>
                  <div style={{ fontSize:11, color: days <= 3 ? T.red : T.textDim }}>
                    {days <= 0 ? "Today" : `In ${days}d`} · {fmtDate(u.date)}
                  </div>
                </div>
                <span style={{ fontFamily:T.mono, color:T.red, fontWeight:700, fontSize:13 }}>{fmt(u.amount)}</span>
              </div>
            );
          })}
        </Card>
      )}

      {/* Accounts summary */}
      {state.accounts.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:10 }}>Accounts</div>
          {state.accounts.map(a => (
            <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:9, height:9, borderRadius:"50%", background: a.color ?? T.cyan }} />
                <span style={{ fontSize:13, color:T.text }}>{a.name}</span>
              </div>
              <span style={{ fontFamily:T.mono, fontSize:13, fontWeight:700, color:T.text }}>{fmt(a.balance)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
