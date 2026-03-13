import { useApp } from "@/context/AppContext";
import { fmt, fmtDate, daysFromNow } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Badge, Btn, EmptyState } from "@/components/ui/primitives";
import { EntityView } from "./EntityView";
import { RecurringPaymentForm } from "@/components/forms";

export function RecurringView() {
  const { state, remove } = useApp();
  const totalMonthly = state.recurringPayments.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <EntityView
      title="Recurring"
      sub={`${fmt(totalMonthly)}/mo · ${fmt(totalMonthly * 12)}/yr`}
      entity="recurringPayments"
      FormComp={RecurringPaymentForm}
      formProps={{ accounts: state.accounts }}
    >
      {state.recurringPayments.length === 0 ? (
        <EmptyState icon="🔁" title="No recurring payments" subtitle="Rent, subscriptions, SIPs, insurance…" />
      ) : (
        state.recurringPayments.map(r => {
          const days = daysFromNow(r.nextDate);
          return (
            <Card key={r.id}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{r.name}</div>
                  <div style={{ display:"flex", gap:5, marginTop:5 }}>
                    <Badge color={T.textMuted}>{r.category}</Badge>
                    <Badge color={T.textMuted}>{r.frequency}</Badge>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:T.mono, fontWeight:700, color:T.yellow, fontSize:14 }}>{fmt(r.amount)}</div>
                    <div style={{ fontSize:11, color: days <= 3 ? T.red : T.textDim }}>
                      {days <= 0 ? "Due today" : `In ${days}d`} · {fmtDate(r.nextDate)}
                    </div>
                  </div>
                  <Btn variant="danger" small onClick={() => remove("recurringPayments", r.id)}>✕</Btn>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </EntityView>
  );
}
