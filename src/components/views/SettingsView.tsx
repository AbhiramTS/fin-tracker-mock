import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { T } from "@/components/ui/tokens";
import { Card, Badge, Btn, FInput, QRCodeCanvas } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import type { FirebaseConfig } from "@/types";

// ── Firebase config form ──────────────────────────────────────────────────────
function FirebaseConfigForm({ onConnect }: { onConnect: (cfg: FirebaseConfig) => void }) {
  const [pasting, setPasting] = useState(false);
  const [raw, setRaw]         = useState("");
  const [cfg, setCfg]         = useState<Partial<FirebaseConfig>>({ apiKey:"", authDomain:"", projectId:"", appId:"" });
  const [err, setErr]         = useState("");

  const go = () => {
    try {
      let parsed: Partial<FirebaseConfig> = cfg;
      if (pasting) {
        // Accept both JSON and JS object literal (e.g. copied from Firebase console)
        const cleaned = raw.trim()
          .replace(/^const\s+\w+\s*=\s*/, "").replace(/;$/, "")
          .replace(/(\w+)\s*:/g, '"$1":').replace(/'/g, '"');
        parsed = JSON.parse(cleaned) as Partial<FirebaseConfig>;
      }
      if (!parsed.apiKey || !parsed.projectId) { setErr("apiKey and projectId are required"); return; }
      setErr("");
      onConnect(parsed as FirebaseConfig);
    } catch {
      setErr("Parse error — paste the raw config object from Firebase Console.");
    }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:11 }}>
      <div style={{ display:"flex", gap:8, marginBottom:2 }}>
        {(["Fields", "Paste JSON"] as const).map((label, i) => (
          <button key={label} onClick={() => setPasting(i === 1)} style={{
            flex:1, background: pasting === (i===1) ? T.cyan : "transparent",
            color: pasting === (i===1) ? T.bg : T.textMuted,
            border: `1px solid ${pasting === (i===1) ? T.cyan : T.border}`,
            borderRadius:8, padding:"6px", fontSize:12, fontWeight:700, cursor:"pointer",
          }}>{label}</button>
        ))}
      </div>

      {pasting ? (
        <div>
          <label style={{ fontSize:11, color:T.textMuted, fontWeight:700, letterSpacing:.6, textTransform:"uppercase", display:"block", marginBottom:5 }}>
            Paste Firebase Config Object
          </label>
          <textarea
            value={raw}
            onChange={e => setRaw(e.target.value)}
            placeholder={'{\n  apiKey: "...",\n  authDomain: "...",\n  projectId: "..."\n}'}
            style={{
              background:T.surface, border:`1px solid ${T.border}`, borderRadius:8,
              padding:"9px 11px", color:T.text, fontSize:12, outline:"none",
              fontFamily:T.mono, width:"100%", boxSizing:"border-box", minHeight:120, resize:"vertical",
            }}
          />
        </div>
      ) : (
        <>
          <FInput label="API Key"      value={cfg.apiKey ?? ""}      onChange={e => setCfg({ ...cfg, apiKey: e.target.value })}      placeholder="AIzaSy..." />
          <FInput label="Auth Domain"  value={cfg.authDomain ?? ""}  onChange={e => setCfg({ ...cfg, authDomain: e.target.value })}  placeholder="app.firebaseapp.com" />
          <FInput label="Project ID"   value={cfg.projectId ?? ""}   onChange={e => setCfg({ ...cfg, projectId: e.target.value })}   placeholder="your-project-id" />
          <FInput label="App ID"       value={cfg.appId ?? ""}       onChange={e => setCfg({ ...cfg, appId: e.target.value })}       placeholder="1:123:web:abc" />
        </>
      )}

      {err && <div style={{ fontSize:12, color:T.red }}>{err}</div>}
      <Btn variant="firebase" onClick={go} full>🔥 Connect Firebase</Btn>
      <div style={{ fontSize:11, color:T.textDim, lineHeight:1.6 }}>
        Firebase Console → Project Settings → Your apps → SDK setup &amp; configuration
      </div>
    </div>
  );
}

// ── SettingsView ──────────────────────────────────────────────────────────────
export function SettingsView() {
  const { state, connectFirebase } = useApp();
  const [connected, setConnected] = useState(() => !!localStorage.getItem("ft_firebase_config"));
  const [showQR, setShowQR]       = useState(false);
  const [qrData, setQrData]       = useState("");

  // On initial load, handle ?fbc= QR param (mobile auto-connect)
  // (AppContext also handles this; this is just the UI feedback)
  useEffect(() => {
    if (localStorage.getItem("ft_firebase_config")) setConnected(true);
  }, [state.syncStatus]);

  const showQRModal = () => {
    const cfg = localStorage.getItem("ft_firebase_config");
    if (!cfg) return;
    const base = window.location.href.split("?")[0];
    setQrData(`${base}?fbc=${btoa(cfg)}`);
    setShowQR(true);
  };

  const disconnect = () => {
    localStorage.removeItem("ft_firebase_config");
    setConnected(false);
    window.location.reload();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <h2 style={{ margin:0, fontSize:19, fontWeight:800, color:T.text }}>Settings</h2>

      {/* Firebase section */}
      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>🔥 Firebase Sync</div>
          {connected && <Badge color={T.green}>Live</Badge>}
        </div>

        {connected ? (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:13, color:T.textMuted }}>
              Real-time sync is active. Changes propagate to all devices instantly.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn variant="primary" onClick={showQRModal} style={{ flex:1 }}>📱 Sync QR Code</Btn>
              <Btn variant="danger"  onClick={disconnect}>Disconnect</Btn>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize:13, color:T.textMuted, marginBottom:14, lineHeight:1.6 }}>
              Connect Firestore to sync across devices in real-time.
              Data is saved to IndexedDB first — Firebase is the cloud layer only.
            </div>
            <FirebaseConfigForm
              onConnect={async cfg => { await connectFirebase(cfg); setConnected(true); }}
            />
          </>
        )}
      </Card>

      {/* QR modal */}
      {showQR && (
        <Modal title="Scan on Mobile" onClose={() => setShowQR(false)}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"8px 0" }}>
            <div style={{ background:"#fff", padding:16, borderRadius:16, boxShadow:`0 0 40px ${T.cyan}30` }}>
              <QRCodeCanvas data={qrData} size={220} />
            </div>
            <div style={{ fontSize:13, color:T.textMuted, textAlign:"center", lineHeight:1.7 }}>
              Scan with your phone to open FinTracker with Firebase already connected.
              <br /><br />
              <strong style={{ color:T.yellow }}>⚠ Contains your Firebase config.</strong>
              <br />Only share with your own devices.
            </div>
          </div>
        </Modal>
      )}

      {/* PWA install hints */}
      <Card>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:8 }}>📱 Install as PWA</div>
        <div style={{ fontSize:13, color:T.textMuted, lineHeight:1.8 }}>
          <strong style={{ color:T.text }}>iOS Safari:</strong> Share → Add to Home Screen<br />
          <strong style={{ color:T.text }}>Android Chrome:</strong> ⋮ → Add to Home Screen<br />
          <strong style={{ color:T.text }}>Desktop Chrome/Edge:</strong> Install icon in address bar
        </div>
      </Card>

      {/* Architecture note */}
      <Card>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:8 }}>💾 Architecture</div>
        <div style={{ fontSize:13, color:T.textMuted, lineHeight:1.8 }}>
          All data lives in <strong style={{ color:T.cyan }}>IndexedDB</strong> first.
          Firebase is the sync layer — not the primary store. Fully offline-capable.
          <br /><br />
          <code style={{ fontSize:11, color:T.cyan, background:T.surface, padding:"3px 7px", borderRadius:5 }}>
            IDB → Repository → SyncQueue → Firebase
          </code>
        </div>
      </Card>
    </div>
  );
}
