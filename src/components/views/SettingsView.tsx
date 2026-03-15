import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { renderQR } from "@/qr/qrcode";
import type { FirebaseConfig } from "@/types";

function QRCanvas({ data, size = 220 }: { data: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current && data) renderQR(ref.current, data, size).catch(console.error);
  }, [data, size]);
  return <canvas ref={ref} className="rounded-xl block"/>;
}

function FirebaseSetup({ onConnect }: { onConnect: (cfg: FirebaseConfig) => void }) {
  const [raw, setRaw] = useState("");
  const [cfg, setCfg] = useState<Partial<FirebaseConfig>>({ apiKey:"", authDomain:"", projectId:"", appId:"" });
  const [err, setErr] = useState("");
  const [mode, setMode] = useState<"fields"|"paste">("fields");

  const connect = () => {
    try {
      let parsed: Partial<FirebaseConfig> = cfg;
      if (mode==="paste") {
        const clean = raw.trim().replace(/^const\s+\w+\s*=\s*/,"").replace(/;$/,"")
          .replace(/(\w+)\s*:/g,'"$1":').replace(/'/g,'"');
        parsed = JSON.parse(clean);
      }
      if (!parsed.apiKey || !parsed.projectId) { setErr("apiKey and projectId are required"); return; }
      setErr(""); onConnect(parsed as FirebaseConfig);
    } catch { setErr("Could not parse config — try the Paste tab and paste the raw object."); }
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={mode} onValueChange={v=>setMode(v as "fields"|"paste")}>
        <TabsList className="w-full"><TabsTrigger value="fields" className="flex-1">Fields</TabsTrigger><TabsTrigger value="paste" className="flex-1">Paste JSON</TabsTrigger></TabsList>
        <TabsContent value="fields">
          <div className="flex flex-col gap-2">
            <FormField label="API Key"><Input value={cfg.apiKey??""} onChange={e=>setCfg({...cfg,apiKey:e.target.value})} placeholder="AIzaSy..."/></FormField>
            <FormField label="Auth Domain"><Input value={cfg.authDomain??""} onChange={e=>setCfg({...cfg,authDomain:e.target.value})} placeholder="app.firebaseapp.com"/></FormField>
            <FormField label="Project ID"><Input value={cfg.projectId??""} onChange={e=>setCfg({...cfg,projectId:e.target.value})}/></FormField>
            <FormField label="App ID"><Input value={cfg.appId??""} onChange={e=>setCfg({...cfg,appId:e.target.value})} placeholder="1:123:web:abc"/></FormField>
          </div>
        </TabsContent>
        <TabsContent value="paste">
          <Textarea value={raw} onChange={e=>setRaw(e.target.value)} rows={6} placeholder={'{\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "..."\n}'}/>
        </TabsContent>
      </Tabs>
      {err && <p className="text-xs text-destructive">{err}</p>}
      <Button variant="firebase" onClick={connect} className="w-full">🔥 Connect Firebase</Button>
      <p className="text-xs text-muted-foreground">Firebase Console → Project Settings → Your apps → SDK setup</p>
    </div>
  );
}

export function SettingsView() {
  const { state, connectFirebase } = useApp();
  const [connected, setConnected]  = useState(()=>!!localStorage.getItem("ft_firebase_config"));
  const [showQR,    setShowQR]     = useState(false);
  const [qrData,    setQrData]     = useState("");

  const showQRModal = () => {
    const cfg = localStorage.getItem("ft_firebase_config");
    if (!cfg) return;
    setQrData(`${window.location.href.split("?")[0]}?fbc=${btoa(cfg)}`);
    setShowQR(true);
  };

  const disconnect = () => { localStorage.removeItem("ft_firebase_config"); setConnected(false); window.location.reload(); };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold">Settings</h2>

      {/* Firebase */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>🔥 Firebase Sync</CardTitle>
            {connected && <Badge variant="profit">Live</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          {connected ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Real-time sync is active. Changes propagate to all connected devices instantly.</p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={showQRModal}>📱 QR Sync Code</Button>
                <Button variant="destructive" onClick={disconnect}>Disconnect</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Connect Firestore for real-time sync across all your devices. Data lives in IndexedDB first — Firebase is the cloud layer only.</p>
              <FirebaseSetup onConnect={async cfg=>{await connectFirebase(cfg);setConnected(true);}}/>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Modal */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent>
          <DialogHeader><DialogTitle>Scan on Your Phone</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 p-5">
            <div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/20">
              <QRCanvas data={qrData} size={220}/>
            </div>
            <div className="text-sm text-muted-foreground text-center space-y-2">
              <p>Scan this QR to open FinTracker on your phone with Firebase already connected.</p>
              <p className="text-warning font-semibold">⚠ Contains your Firebase config. Only scan on your own devices.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PWA */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>📱 Install as App</CardTitle></CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p><span className="font-semibold text-foreground">iOS Safari:</span> Share → Add to Home Screen</p>
            <p><span className="font-semibold text-foreground">Android Chrome:</span> ⋮ → Add to Home Screen</p>
            <p><span className="font-semibold text-foreground">Desktop Chrome / Edge:</span> Install icon in address bar</p>
          </div>
        </CardContent>
      </Card>

      {/* Architecture */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>💾 Data & Storage</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">All data is stored in <span className="text-cyan font-semibold">IndexedDB</span> on your device first. The app works fully offline. Firebase is an optional sync layer.</p>
          <code className="text-xs text-cyan bg-muted rounded-md px-2 py-1 block font-mono">IDB → Repository → SyncQueue → Firebase</code>
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader className="pb-2"><CardTitle>📊 Data Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["Accounts", state.accounts.length],
              ["Expenses", state.expenses.length],
              ["Incomes", state.incomes.length],
              ["Transfers", state.transfers.length],
              ["Recurring Payments", state.recurringPayments.length],
              ["Recurring Incomes", state.recurringIncomes.length],
              ["Loans", state.loans.length],
              ["Credit Cards", state.creditCards.length],
              ["Receivables", state.receivables.length],
              ["Investments", state.investments.length],
              ["Goals", state.goals.length],
              ["Reconciliations", state.reconciliations.length],
            ].map(([label,count])=>(
              <div key={label as string} className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className="font-mono font-semibold text-xs">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
