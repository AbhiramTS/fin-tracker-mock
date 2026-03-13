import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { buildForecast } from "@/utils/forecast";
import { fmt, fmtDate, fmtDateFull } from "@/utils/format";
import { T } from "@/components/ui/tokens";
import { Card, Badge, EmptyState } from "@/components/ui/primitives";
import { ForecastChart } from "@/components/charts";

export function ForecastView() {
  const { state } = useApp();
  const { timeline, shortfall } = useMemo(() => buildForecast(state, 90), [state]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <h2 style={{ margin:0, fontSize:19, fontWeight:800, color:T.text }}>Forecast</h2>
        <Badge color={shortfall ? T.red : T.green}>
          {shortfall ? `⚠ Shortfall ${fmtDate(shortfall.date)}` : "✓ 90d Stable"}
        </Badge>
      </div>

      {timeline.length > 0 && (
        <Card>
          <ForecastChart timeline={timeline} height={150} />
        </Card>
      )}

      {timeline.length === 0 ? (
        <EmptyState icon="🔮" title="Nothing to forecast yet" subtitle="Add income, loans, or recurring payments" />
      ) : (
        timeline.map((t, i) => (
          <Card key={i} style={{ borderLeft: `3px solid ${t.balance < 0 ? T.red : T.cyan}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:13, color:T.textMuted, fontWeight:600 }}>{fmtDateFull(t.date)}</span>
              <span style={{ fontFamily:T.mono, fontWeight:700, color: t.balance < 0 ? T.red : T.green, fontSize:14 }}>
                {fmt(t.balance)}
              </span>
            </div>
            {t.events.map((e, j) => (
              <div key={j} style={{ display:"flex", alignItems:"center", gap:6, marginTop:5, fontSize:12, color: e.amount > 0 ? T.green : T.red }}>
                <span>{e.amount > 0 ? "▲" : "▼"}</span>
                <span style={{ color:T.textMuted }}>{e.label}</span>
                <span style={{ fontFamily:T.mono, marginLeft:"auto" }}>{fmt(Math.abs(e.amount))}</span>
              </div>
            ))}
          </Card>
        ))
      )}
    </div>
  );
}
