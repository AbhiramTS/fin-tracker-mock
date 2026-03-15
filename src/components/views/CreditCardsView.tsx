import { Trash2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { fmt, fmtDate, daysFromNow } from "@/utils/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityView } from "./EntityView";
import { CreditCardForm } from "@/components/forms";

export function CreditCardsView() {
  const { state, remove } = useApp();
  const totalDebt = state.creditCards.reduce((s,c)=>s+(c.outstanding??0),0);

  return (
    <EntityView title="Credit Cards" subtitle={`Total outstanding: ${fmt(totalDebt)}`} entity="creditCards" FormComp={CreditCardForm}>
      {state.creditCards.length===0
        ? <EmptyState icon="💳" title="No credit cards" description="Track balances, limits, and due dates"/>
        : state.creditCards.map(c=>{
            const util=((c.outstanding??0)/Math.max(c.limit??1,1))*100;
            const days=daysFromNow(c.dueDate);
            return (
              <Card key={c.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <p className="font-semibold">{c.name}</p>
                    <Button size="icon-sm" variant="destructive" onClick={()=>remove("creditCards",c.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                  </div>
                  <p className="font-mono text-2xl font-bold text-loss">{fmt(c.outstanding)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-3">of {fmt(c.limit)} limit</p>
                  <Progress value={util} className="h-2" indicatorClassName={util>70?"bg-loss":util>40?"bg-warning":"bg-profit"}/>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>{util.toFixed(0)}% utilised</span>
                    <span className={days<=3?"text-loss":"text-muted-foreground"}>
                      Due {days<=0?"today":`in ${days}d`} · {fmtDate(c.dueDate)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
      }
    </EntityView>
  );
}
