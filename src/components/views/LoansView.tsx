import { useApp } from "@/context/AppContext";
import { fmt } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Btn, EmptyState, ProgressBar } from "@/components/ui/primitives";
import { EntityView } from "./EntityView";
import { LoanForm } from "@/components/forms";

export function LoansView() {
  const { state, remove } = useApp();
  const totalDebt = state.loans.reduce(
    (s, l) => s + Math.max(0, (l.totalAmount ?? 0) - (l.emi ?? 0) * (l.paidMonths ?? 0)), 0,
  );

  return (
    <EntityView
      title="Loans & EMIs"
      sub={`Outstanding: ${fmt(totalDebt)}`}
      entity="loans"
      FormComp={LoanForm}
      formProps={{ accounts: state.accounts }}
    >
      {state.loans.length === 0 ? (
        <EmptyState icon="🏠" title="No loans" subtitle="Home loan, personal loan, car loan…" />
      ) : (
        state.loans.map(l => {
          const outstanding = Math.max(0, (l.totalAmount ?? 0) - (l.emi ?? 0) * (l.paidMonths ?? 0));
          const progress    = Math.min(100, ((l.paidMonths ?? 0) / Math.max(l.tenure ?? 1, 1)) * 100);
          const monthsLeft  = Math.max(0, (l.tenure ?? 0) - (l.paidMonths ?? 0));

          return (
            <Card key={l.id}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{l.name}</div>
                  <div style={{ fontSize:12, color:T.textDim, marginTop:2 }}>
                    EMI: {fmt(l.emi)} · {monthsLeft} months left
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:T.mono, color:T.red, fontWeight:700 }}>{fmt(outstanding)}</div>
                    <div style={{ fontSize:11, color:T.textDim }}>outstanding</div>
                  </div>
                  <Btn variant="danger" small onClick={() => remove("loans", l.id)}>✕</Btn>
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:T.textDim, marginBottom:4 }}>
                <span>{l.paidMonths} of {l.tenure} paid</span>
                <span>{progress.toFixed(0)}%</span>
              </div>
              <ProgressBar value={progress} color={progress > 75 ? T.green : T.cyan} />
            </Card>
          );
        })
      )}
    </EntityView>
  );
}
