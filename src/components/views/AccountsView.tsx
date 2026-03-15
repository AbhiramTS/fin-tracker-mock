import { useState } from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { fmt, todayStr } from "@/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityView } from "./EntityView";
import { AccountForm, ReconciliationForm } from "@/components/forms";

export function AccountsView() {
  const { state, save, remove } = useApp();
  const total = state.accounts.reduce((s,a)=>s+(a.balance??0),0);
  const [reconAccount, setReconAccount] = useState<string|null>(null);

  const account = state.accounts.find(a=>a.id===reconAccount);

  return (
    <EntityView title="Accounts" subtitle={`Total tracked: ${fmt(total)}`} entity="accounts" FormComp={AccountForm}>
      {state.accounts.length===0
        ? <EmptyState icon="🏦" title="No accounts yet" description="Add bank accounts, cash wallets, credit cards…"/>
        : state.accounts.map(a=>(
          <Card key={a.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full shrink-0" style={{background:a.color??"hsl(191 100% 47%)"}}/>
                <div>
                  <p className="font-semibold">{a.name}</p>
                  <Badge variant="muted" className="mt-0.5 text-[10px]">{a.type.replace("_"," ")}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-cyan">{fmt(a.balance)}</span>
                <Button size="icon-sm" variant="ghost" onClick={()=>setReconAccount(a.id)} title="Reconcile">
                  <RefreshCw className="h-3.5 w-3.5"/>
                </Button>
                <Button size="icon-sm" variant="destructive" onClick={()=>remove("accounts",a.id)}>
                  <Trash2 className="h-3.5 w-3.5"/>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      }

      {/* Reconciliation dialog */}
      <Dialog open={!!reconAccount} onOpenChange={o=>!o&&setReconAccount(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reconcile Account</DialogTitle></DialogHeader>
          {account && (
            <ReconciliationForm
              account={account}
              trackedBalance={account.balance}
              onSave={async(d)=>{
                await save("reconciliations",d);
                // If there's a difference, update account balance to actual
                if (d.difference && d.difference!==0) {
                  await save("accounts",{...account, balance:(d.actualBalance??account.balance)});
                }
                setReconAccount(null);
              }}
              onCancel={()=>setReconAccount(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </EntityView>
  );
}
