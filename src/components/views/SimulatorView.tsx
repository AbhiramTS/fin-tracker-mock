import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { fmt } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, FInput, Btn } from "@/components/ui/primitives";

interface SimResult {
  safe: boolean;
  newMonthly?: number;
  bufferMonths?: number;
  balanceAfter?: number;
  monthsCovered?: number;
}

export function SimulatorView() {
  const { state } = useApp();
  const [mode, setMode]     = useState<"loan" | "purchase">("loan");
  const [emi, setEmi]       = useState("");
  const [months, setMonths] = useState("");
  const [purchase, setPurchase] = useState("");
  const [result, setResult] = useState<SimResult | null>(null);

  const totalBalance = state.accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
  const monthlyOut   = state.recurringPayments.reduce((s, r) => s + (r.amount ?? 0), 0)
                     + state.loans.reduce((s, l) => s + (l.emi ?? 0), 0);

  const simulate = () => {
    if (mode === "loan") {
      const emiVal = parseFloat(emi) || 0;
      setResult({
        newMonthly:   monthlyOut + emiVal,
        bufferMonths: Math.floor(totalBalance / Math.max(emiVal, 1)),
        safe:         emiVal < totalBalance * 0.15,
      });
    } else {
      const spend = parseFloat(purchase) || 0;
      const after = totalBalance - spend;
      setResult({
        balanceAfter:  after,
        monthsCovered: Math.floor(after / Math.max(monthlyOut, 1)),
        safe:          after > monthlyOut * 2,
      });
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <h2 style={{ margin:0, fontSize:19, fontWeight:800, color:T.text }}>Simulator</h2>

      <Card>
        <div style={{ fontSize:13, color:T.textMuted, marginBottom:14 }}>
          Model a financial decision before you commit to it.
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {(["loan","purchase"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setResult(null); }} style={{
              background: mode === m ? T.cyan : "transparent",
              color:      mode === m ? T.bg   : T.textMuted,
              border: `1px solid ${mode === m ? T.cyan : T.border}`,
              borderRadius:100, padding:"5px 14px", fontSize:12, fontWeight:600, cursor:"pointer",
            }}>
              {m === "loan" ? "Take a Loan" : "Big Purchase"}
            </button>
          ))}
        </div>

        {mode === "loan" ? (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <FInput label="Monthly EMI (₹)" type="number" value={emi} onChange={e => setEmi(e.target.value)} />
            <FInput label="Tenure (months)" type="number" value={months} onChange={e => setMonths(e.target.value)} />
          </div>
        ) : (
          <FInput label="Purchase Amount (₹)" type="number" value={purchase} onChange={e => setPurchase(e.target.value)} />
        )}

        <Btn onClick={simulate} style={{ marginTop:14 }} full>🔮 Simulate</Btn>
      </Card>

      {result && (
        <Card style={{ border: `2px solid ${result.safe ? T.green : T.red}` }}>
          <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:14 }}>
            <span style={{ fontSize:28 }}>{result.safe ? "✅" : "⚠️"}</span>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color: result.safe ? T.green : T.red }}>
                {result.safe ? "Looks manageable" : "High risk"}
              </div>
              <div style={{ fontSize:12, color:T.textMuted }}>Based on your current data</div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {mode === "loan" ? (
              <>
                <div style={{ background:T.surface, borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", marginBottom:3 }}>New Monthly Out</div>
                  <div style={{ fontFamily:T.mono, fontSize:16, fontWeight:800, color:T.yellow }}>{fmt(result.newMonthly)}</div>
                </div>
                <div style={{ background:T.surface, borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", marginBottom:3 }}>Buffer Months</div>
                  <div style={{ fontFamily:T.mono, fontSize:16, fontWeight:800, color: (result.bufferMonths ?? 0) > 3 ? T.green : T.red }}>{result.bufferMonths}</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ background:T.surface, borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", marginBottom:3 }}>Balance After</div>
                  <div style={{ fontFamily:T.mono, fontSize:16, fontWeight:800, color: (result.balanceAfter ?? 0) < 0 ? T.red : T.green }}>{fmt(result.balanceAfter)}</div>
                </div>
                <div style={{ background:T.surface, borderRadius:10, padding:12 }}>
                  <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", marginBottom:3 }}>Months Covered</div>
                  <div style={{ fontFamily:T.mono, fontSize:16, fontWeight:800, color: (result.monthsCovered ?? 0) > 2 ? T.green : T.red }}>{result.monthsCovered}</div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
