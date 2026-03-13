import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { fmt, fmtDate } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, EmptyState, ListRow, ProgressBar } from "@/components/ui/primitives";
import { MonthlyBarsChart } from "@/components/charts";
import { EntityView } from "./EntityView";
import { ExpenseForm } from "@/components/forms";

export function ExpensesView() {
  const { state, remove } = useApp();
  const [cat, setCat] = useState("all");

  const allCats   = ["all", ...new Set(state.expenses.map(e => e.category))];
  const filtered  = cat === "all" ? state.expenses : state.expenses.filter(e => e.category === cat);
  const sorted    = [...filtered].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const total     = filtered.reduce((s, e) => s + (e.amount ?? 0), 0);
  const grandTotal = state.expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  const catTotals = state.expenses.reduce<Record<string, number>>((a, e) => {
    a[e.category] = (a[e.category] ?? 0) + (e.amount ?? 0); return a;
  }, {});
  const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const CHART_COLORS = ["#00d4f5","#00e5a0","#a78bfa","#ffb020","#ff3d5e"];

  return (
    <EntityView
      title="Expenses"
      sub={`${filtered.length} records · ${fmt(total)}`}
      entity="expenses"
      FormComp={ExpenseForm}
      formProps={{ accounts: state.accounts }}
    >
      {state.expenses.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>Monthly Spending</div>
          <MonthlyBarsChart expenses={state.expenses} height={110} />
        </Card>
      )}

      {topCats.length > 0 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:10 }}>By Category</div>
          {topCats.map(([c, amt], i) => (
            <div key={c} style={{ marginBottom:9 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:T.textMuted, marginBottom:4 }}>
                <span style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:7, height:7, borderRadius:"50%", background:CHART_COLORS[i % CHART_COLORS.length], display:"inline-block" }} />
                  {c}
                </span>
                <span style={{ fontFamily:T.mono, color:T.text }}>{fmt(amt)}</span>
              </div>
              <ProgressBar value={(amt / Math.max(grandTotal, 1)) * 100} color={CHART_COLORS[i % CHART_COLORS.length]} />
            </div>
          ))}
        </Card>
      )}

      {/* Category filter pills */}
      <div style={{ display:"flex", gap:7, overflowX:"auto", paddingBottom:2 }}>
        {allCats.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            background: cat === c ? T.cyan : "transparent",
            color: cat === c ? T.bg : T.textMuted,
            border: `1px solid ${cat === c ? T.cyan : T.border}`,
            borderRadius:100, padding:"4px 13px", fontSize:12, fontWeight:600,
            cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
          }}>{c}</button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon="🧾" title="No expenses" subtitle="Tap + Add to log your first expense" />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
          {sorted.map(e => (
            <ListRow
              key={e.id}
              left={e.name}
              sub={`${e.category} · ${fmtDate(e.date)} · ${state.accounts.find(a => a.id === e.accountId)?.name ?? "?"}`}
              right={fmt(e.amount)}
              color={T.red}
              onDelete={() => remove("expenses", e.id)}
            />
          ))}
        </div>
      )}
    </EntityView>
  );
}
