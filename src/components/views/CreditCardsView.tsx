import { useApp } from "@/context/AppContext";
import { fmt, fmtDate, daysFromNow } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Btn, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { EntityView } from "./EntityView";
import { CreditCardForm } from "@/components/forms";

export function CreditCardsView() {
  const { state, remove } = useApp();
  const totalDebt = state.creditCards.reduce((s, c) => s + (c.outstanding ?? 0), 0);

  return (
    <EntityView
      title="Credit Cards"
      sub={`Total debt: ${fmt(totalDebt)}`}
      entity="creditCards"
      FormComp={CreditCardForm}
    >
      {state.creditCards.length === 0 ? (
        <EmptyState icon="💳" title="No credit cards" subtitle="Track balances, limits, and due dates" />
      ) : (
        state.creditCards.map(c => {
          const util = ((c.outstanding ?? 0) / Math.max(c.limit ?? 1, 1)) * 100;
          const days = daysFromNow(c.dueDate);
          return (
            <Card key={c.id}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{c.name}</div>
                <Btn variant="danger" small onClick={() => remove("creditCards", c.id)}>✕</Btn>
              </div>
              <div style={{ fontFamily:T.mono, fontSize:20, fontWeight:800, color:T.red }}>{fmt(c.outstanding)}</div>
              <div style={{ fontSize:12, color:T.textDim, marginTop:2, marginBottom:10 }}>of {fmt(c.limit)} limit</div>
              <ProgressBar value={util} color={util > 70 ? T.red : util > 40 ? T.yellow : T.green} height={6} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:7, fontSize:12 }}>
                <span style={{ color:T.textDim }}>{util.toFixed(0)}% utilised</span>
                <span style={{ color: days <= 3 ? T.red : T.textMuted }}>
                  Due {days <= 0 ? "today" : `in ${days}d`} · {fmtDate(c.dueDate)}
                </span>
              </div>
            </Card>
          );
        })
      )}
    </EntityView>
  );
}
