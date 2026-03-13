import { useApp } from "@/context/AppContext";
import { fmt, fmtDate } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Btn, EmptyState } from "@/components/ui/primitives";
import { EntityView } from "./EntityView";
import { IncomeForm } from "@/components/forms";

const FREQ_MULTIPLIER: Record<string, number> = {
  daily: 30, weekly: 4.3, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12,
};

export function IncomeView() {
  const { state, remove } = useApp();
  const monthly = state.incomes.reduce(
    (s, i) => s + (i.amount ?? 0) * (FREQ_MULTIPLIER[i.frequency] ?? 1), 0,
  );

  return (
    <EntityView
      title="Income"
      sub={`~${fmt(monthly)}/month`}
      entity="incomes"
      FormComp={IncomeForm}
      formProps={{ accounts: state.accounts }}
    >
      {state.incomes.length === 0 ? (
        <EmptyState icon="💵" title="No income sources" subtitle="Add salary, freelance, rent income, etc." />
      ) : (
        state.incomes.map(inc => (
          <Card key={inc.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{inc.name}</div>
              <div style={{ fontSize:12, color:T.textDim, marginTop:2 }}>
                {inc.frequency} · Next: {fmtDate(inc.nextDate)}
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontFamily:T.mono, fontSize:15, fontWeight:700, color:T.green }}>{fmt(inc.amount)}</span>
              <Btn variant="danger" small onClick={() => remove("incomes", inc.id)}>✕</Btn>
            </div>
          </Card>
        ))
      )}
    </EntityView>
  );
}
