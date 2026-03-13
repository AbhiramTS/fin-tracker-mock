import { useState } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { T } from "@/components/ui/tokens";
import { Spinner } from "@/components/ui/primitives";

import { DashboardView }   from "@/components/views/DashboardView";
import { ExpensesView }    from "@/components/views/ExpensesView";
import { AccountsView }    from "@/components/views/AccountsView";
import { IncomeView }      from "@/components/views/IncomeView";
import { RecurringView }   from "@/components/views/RecurringView";
import { LoansView }       from "@/components/views/LoansView";
import { CreditCardsView } from "@/components/views/CreditCardsView";
import { InvestmentsView } from "@/components/views/InvestmentsView";
import { ForecastView }    from "@/components/views/ForecastView";
import { SimulatorView }   from "@/components/views/SimulatorView";
import { SettingsView }    from "@/components/views/SettingsView";

// ── Nav definitions ───────────────────────────────────────────────────────────
type TabId = "dashboard"|"expenses"|"accounts"|"income"|"recurring"|"loans"|"cards"|"investments"|"forecast"|"simulator"|"settings";

interface NavItem { id: TabId; label: string; icon: string; }

const NAV_ITEMS: NavItem[] = [
  { id:"dashboard",   label:"Home",      icon:"⬡" },
  { id:"expenses",    label:"Expenses",  icon:"🧾" },
  { id:"accounts",    label:"Accounts",  icon:"🏦" },
  { id:"income",      label:"Income",    icon:"💵" },
  { id:"recurring",   label:"Recurring", icon:"🔁" },
  { id:"loans",       label:"Loans",     icon:"📋" },
  { id:"cards",       label:"Cards",     icon:"💳" },
  { id:"investments", label:"Invest",    icon:"📈" },
  { id:"forecast",    label:"Forecast",  icon:"🔮" },
  { id:"simulator",   label:"Simulate",  icon:"⚙" },
  { id:"settings",    label:"Settings",  icon:"⚙" },
];

const BOTTOM_IDS: TabId[] = ["dashboard","expenses","forecast","simulator"];
const MORE_IDS:   TabId[] = ["accounts","income","recurring","loans","cards","investments","settings"];

const VIEWS: Record<TabId, React.ComponentType> = {
  dashboard:   DashboardView,
  expenses:    ExpensesView,
  accounts:    AccountsView,
  income:      IncomeView,
  recurring:   RecurringView,
  loans:       LoansView,
  cards:       CreditCardsView,
  investments: InvestmentsView,
  forecast:    ForecastView,
  simulator:   SimulatorView,
  settings:    SettingsView,
};

// ── Global CSS injected once ──────────────────────────────────────────────────
const GLOBAL_CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { margin: 0; background: ${T.bg}; overscroll-behavior: none; font-family: ${T.sans}; }
  input, select, textarea, button { font-family: ${T.sans}; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }

  @media (min-width: 720px) {
    .ft-sidebar  { display: flex !important; }
    .ft-bottom   { display: none !important; }
    .ft-mob-hdr  { display: none !important; }
    .ft-main     { margin-left: 218px !important; padding-bottom: 28px !important; }
  }

  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sheetUp  { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
`;

// ── Shell (rendered after data loaded) ───────────────────────────────────────
function AppShell() {
  const { state } = useApp();
  const [tab, setTab]   = useState<TabId>("dashboard");
  const [more, setMore] = useState(false);

  if (state.loading) return (
    <div style={{ background:T.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Spinner />
    </div>
  );
  if (state.error) return (
    <div style={{ background:T.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", color:T.red, padding:24 }}>
      Error: {state.error}
    </div>
  );

  const ActiveView  = VIEWS[tab];
  const isFirebase  = state.syncStatus === "firebase";
  const activeLabel = NAV_ITEMS.find(n => n.id === tab)?.label ?? "";

  const NavButton = ({ id, label, icon, onClick }: NavItem & { onClick?: () => void }) => (
    <button onClick={onClick ?? (() => setTab(id))} style={{
      flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      gap:3, padding:"9px 4px", background:"none", border:"none", cursor:"pointer",
      color: tab === id ? T.cyan : T.textDim,
    }}>
      <span style={{ fontSize:19 }}>{icon}</span>
      <span style={{ fontSize:10, fontWeight: tab === id ? 700 : 500 }}>{label}</span>
    </button>
  );

  return (
    <div style={{ background:T.bg, minHeight:"100vh", color:T.text }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Desktop sidebar ── */}
      <div className="ft-sidebar" style={{
        display:"none", position:"fixed", left:0, top:0, bottom:0, width:218,
        background:T.surface, borderRight:`1px solid ${T.border}`,
        flexDirection:"column", zIndex:100, overflowY:"auto",
      }}>
        <div style={{ padding:"20px 18px 14px" }}>
          <div style={{ fontSize:17, fontWeight:900, color:T.cyan, letterSpacing:-.5 }}>FinTracker</div>
          <div style={{ fontSize:9, color:T.textDim, letterSpacing:2, marginTop:1 }}>PERSONAL FINANCE</div>
        </div>
        <div style={{ height:1, background:T.border, margin:"0 14px" }} />
        <nav style={{ padding:"10px 8px", flex:1 }}>
          {NAV_ITEMS.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              display:"flex", alignItems:"center", gap:9, width:"100%",
              padding:"8px 11px", borderRadius:9, marginBottom:2,
              background: tab === n.id ? `${T.cyan}16` : "transparent",
              border:     tab === n.id ? `1px solid ${T.cyan}28` : "1px solid transparent",
              color:      tab === n.id ? T.cyan : T.textMuted,
              fontSize:13, fontWeight: tab === n.id ? 700 : 500,
              cursor:"pointer", textAlign:"left",
            }}>
              <span style={{ fontSize:14, width:20, textAlign:"center" }}>{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:"10px 16px 18px", fontSize:11 }}>
          {isFirebase
            ? <span style={{ color:T.green }}>🔥 Firebase live</span>
            : <span style={{ color:T.textDim }}>● Local only</span>}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="ft-main" style={{ paddingBottom:76 }}>
        {/* Mobile header */}
        <div className="ft-mob-hdr" style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"13px 16px 10px", position:"sticky", top:0, zIndex:50,
          background:`${T.bg}ee`, backdropFilter:"blur(12px)",
          borderBottom:`1px solid ${T.border}`,
        }}>
          <div style={{ fontSize:15, fontWeight:900, color:T.cyan }}>FinTracker</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {isFirebase && <span style={{ fontSize:11, color:T.green }}>🔥 live</span>}
            <div style={{ fontSize:13, color:T.textMuted, fontWeight:700 }}>{activeLabel}</div>
          </div>
        </div>

        <div style={{ padding:"16px 14px" }}><ActiveView /></div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="ft-bottom" style={{
        position:"fixed", bottom:0, left:0, right:0,
        background:`${T.surface}f2`, backdropFilter:"blur(16px)",
        borderTop:`1px solid ${T.border}`, display:"flex",
        paddingBottom:"env(safe-area-inset-bottom,0px)", zIndex:100,
      }}>
        {BOTTOM_IDS.map(id => {
          const item = NAV_ITEMS.find(n => n.id === id)!;
          return <NavButton key={id} {...item} />;
        })}
        <button onClick={() => setMore(true)} style={{
          flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", gap:3, padding:"9px 4px",
          background:"none", border:"none", cursor:"pointer",
          color: MORE_IDS.includes(tab) ? T.cyan : T.textDim,
        }}>
          <span style={{ fontSize:19 }}>⋯</span>
          <span style={{ fontSize:10, fontWeight: MORE_IDS.includes(tab) ? 700 : 500 }}>More</span>
        </button>
      </div>

      {/* ── More drawer ── */}
      {more && (
        <>
          <div onClick={() => setMore(false)} style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,.65)",
            zIndex:150, backdropFilter:"blur(4px)", animation:"fadeIn .15s",
          }} />
          <div style={{
            position:"fixed", bottom:0, left:0, right:0,
            background:T.card, borderRadius:"18px 18px 0 0",
            border:`1px solid ${T.border}`, zIndex:151,
            padding:"16px 14px calc(env(safe-area-inset-bottom,0px) + 20px)",
            animation:"sheetUp .2s ease",
          }}>
            <div style={{ width:32, height:3, background:T.border, borderRadius:2, margin:"0 auto 16px" }} />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:9 }}>
              {MORE_IDS.map(id => {
                const item = NAV_ITEMS.find(n => n.id === id)!;
                return (
                  <button key={id} onClick={() => { setTab(id); setMore(false); }} style={{
                    background: tab === id ? `${T.cyan}18` : T.surface,
                    border: `1px solid ${tab === id ? T.cyan : T.border}`,
                    borderRadius:11, padding:"12px 6px",
                    display:"flex", flexDirection:"column", alignItems:"center", gap:5, cursor:"pointer",
                  }}>
                    <span style={{ fontSize:20 }}>{item.icon}</span>
                    <span style={{ fontSize:10, color: tab === id ? T.cyan : T.textMuted, fontWeight:600 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
