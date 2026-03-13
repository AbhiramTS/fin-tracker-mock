import { useApp } from "@/context/AppContext";
import { fmt } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Badge, Btn, EmptyState } from "@/components/ui/primitives";
import { EntityView } from "./EntityView";
import { AccountForm } from "@/components/forms";

export function AccountsView() {
  const { state, remove } = useApp();
  const total = state.accounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  return (
    <EntityView
      title="Accounts"
      sub={`Total: ${fmt(total)}`}
      entity="accounts"
      FormComp={AccountForm}
    >
      {state.accounts.length === 0 ? (
        <EmptyState icon="🏦" title="No accounts yet" subtitle="Add your bank accounts, cash, and wallets" />
      ) : (
        state.accounts.map(a => (
          <Card key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:11 }}>
              <div style={{ width:13, height:13, borderRadius:"50%", background: a.color ?? T.cyan, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{a.name}</div>
                <Badge color={T.textMuted}>{a.type}</Badge>
              </div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontFamily:T.mono, fontSize:16, fontWeight:800, color:T.cyan }}>{fmt(a.balance)}</span>
              <Btn variant="danger" small onClick={() => remove("accounts", a.id)}>✕</Btn>
            </div>
          </Card>
        ))
      )}
    </EntityView>
  );
}
