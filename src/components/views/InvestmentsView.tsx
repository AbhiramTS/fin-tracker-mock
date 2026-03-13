import { useApp } from "@/context/AppContext";
import { fmt } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Badge, Btn, EmptyState } from "@/components/ui/primitives";
import { PortfolioDonut } from "@/components/charts";
import { EntityView } from "./EntityView";
import { InvestmentForm } from "@/components/forms";
import type { InvestmentType } from "@/types";

const TYPE_COLORS: Record<InvestmentType, string> = {
  stocks:      T.cyan,
  mutual_fund: T.green,
  ppf:         T.purple,
  fd:          T.yellow,
  crypto:      T.red,
  real_estate: T.textMuted,
  other:       T.textDim,
};

export function InvestmentsView() {
  const { state, remove } = useApp();
  const total = state.investments.reduce((s, i) => s + (i.value ?? 0), 0);

  return (
    <EntityView
      title="Investments"
      sub={`Portfolio: ${fmt(total)}`}
      entity="investments"
      FormComp={InvestmentForm}
    >
      {state.investments.length > 1 && (
        <Card>
          <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:12 }}>Portfolio Mix</div>
          <PortfolioDonut investments={state.investments} height={130} />
        </Card>
      )}

      {state.investments.length === 0 ? (
        <EmptyState icon="📊" title="No investments" subtitle="Stocks, mutual funds, PPF, FDs…" />
      ) : (
        state.investments.map(inv => (
          <Card key={inv.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background: TYPE_COLORS[inv.type] ?? T.cyan, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{inv.name}</div>
                <Badge color={TYPE_COLORS[inv.type] ?? T.cyan}>{inv.type.replace("_", " ")}</Badge>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontFamily:T.mono, fontWeight:700, color:T.green, fontSize:14 }}>{fmt(inv.value)}</span>
              <Btn variant="danger" small onClick={() => remove("investments", inv.id)}>✕</Btn>
            </div>
          </Card>
        ))
      )}
    </EntityView>
  );
}
