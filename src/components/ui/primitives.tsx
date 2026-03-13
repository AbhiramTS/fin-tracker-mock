import { type CSSProperties, type ReactNode, type ChangeEvent } from "react";
import { T } from "./tokens";

// ── Card ─────────────────────────────────────────────────────────────────────
interface CardProps { children: ReactNode; style?: CSSProperties; onClick?: () => void; }
export function Card({ children, style = {}, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: "16px 18px",
        ...(onClick ? { cursor: "pointer" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function Badge({ children, color = T.cyan }: { children: ReactNode; color?: string }) {
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}28`,
      borderRadius: 100, padding: "2px 8px", fontSize: 11, fontWeight: 700,
    }}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "success" | "danger" | "ghost" | "firebase";

const BTN_STYLES: Record<BtnVariant, CSSProperties> = {
  primary:  { background: T.cyan,    color: T.bg },
  success:  { background: T.green,   color: T.bg },
  danger:   { background: `${T.red}18`, color: T.red, border: `1px solid ${T.red}28` },
  ghost:    { background: "transparent", color: T.textMuted, border: `1px solid ${T.border}` },
  firebase: { background: "linear-gradient(135deg,#f5820d,#ffcd34)", color: "#1a0a00" },
};

interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  small?: boolean;
  full?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
}
export function Btn({ children, onClick, variant = "primary", small, full, disabled, style = {} }: BtnProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        borderRadius: 9,
        padding: small ? "5px 12px" : "9px 18px",
        fontSize: small ? 12 : 14,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        border: "none",
        transition: "all .15s",
        fontFamily: T.sans,
        opacity: disabled ? 0.5 : 1,
        width: full ? "100%" : undefined,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        ...BTN_STYLES[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ── Form inputs ───────────────────────────────────────────────────────────────
const INPUT_BASE: CSSProperties = {
  background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
  padding: "9px 11px", color: T.text, fontSize: 14, outline: "none",
  fontFamily: T.sans, width: "100%", boxSizing: "border-box",
};
const LABEL_STYLE: CSSProperties = {
  fontSize: 11, color: T.textMuted, fontWeight: 700,
  letterSpacing: 0.6, textTransform: "uppercase",
};

interface FInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}
export function FInput({ label, error, ...props }: FInputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={LABEL_STYLE}>{label}</label>}
      <input
        {...props}
        style={{ ...INPUT_BASE, ...(error ? { borderColor: T.red } : {}), ...props.style }}
      />
      {error && <span style={{ fontSize: 11, color: T.red }}>{error}</span>}
    </div>
  );
}

interface FSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}
export function FSelect({ label, children, ...props }: FSelectProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={LABEL_STYLE}>{label}</label>}
      <select {...props} style={{ ...INPUT_BASE, ...props.style }}>{children}</select>
    </div>
  );
}

interface FTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}
export function FTextarea({ label, ...props }: FTextareaProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && <label style={LABEL_STYLE}>{label}</label>}
      <textarea {...props} style={{ ...INPUT_BASE, resize: "vertical", minHeight: 80, ...props.style }} />
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, color = T.cyan, height = 5 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ height, background: T.border, borderRadius: height, overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.min(100, Math.max(0, value))}%`,
        background: color, borderRadius: height, transition: "width .5s",
      }} />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = "📭", title, subtitle }: { icon?: string; title: string; subtitle?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "36px 20px" }}>
      <div style={{ fontSize: 34, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.textMuted }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 48 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: `3px solid ${T.border}`, borderTopColor: T.cyan,
        animation: "spin .7s linear infinite",
      }} />
      <div style={{ fontSize: 13, color: T.textDim }}>Loading your finances…</div>
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────────────────────
interface KpiCardProps { icon: string; label: string; value: string; color?: string; sub?: string; }
export function KpiCard({ icon, label, value, color = T.cyan, sub }: KpiCardProps) {
  return (
    <Card>
      <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
      <div style={{ color, fontSize: 19, fontWeight: 800, marginTop: 2, fontFamily: T.mono, letterSpacing: -0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────
interface ListRowProps { left: ReactNode; right: string; sub?: ReactNode; onDelete?: () => void; color?: string; }
export function ListRow({ left, right, sub, onDelete, color }: ListRowProps) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surface, borderRadius: 10, padding: "10px 13px" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</div>
        {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 10 }}>
        <span style={{ fontFamily: T.mono, fontWeight: 700, color: color ?? T.text, fontSize: 13 }}>{right}</span>
        {onDelete && <Btn variant="danger" small onClick={onDelete}>✕</Btn>}
      </div>
    </div>
  );
}

// ── Form layout helpers ───────────────────────────────────────────────────────
export function FGrid({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10 }}>{children}</div>;
}

export function FActions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", gap: 9, marginTop: 16, justifyContent: "flex-end" }}>
      <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      <Btn onClick={onSave}>Save</Btn>
    </div>
  );
}

// ── QR canvas wrapper ─────────────────────────────────────────────────────────
import { useEffect, useRef } from "react";
import { makeQR } from "@/qr/qrcode";

export function QRCodeCanvas({ data, size = 220 }: { data: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const result = makeQR(data);
    if (!result || !ref.current) return;
    const { matrix, size: qs } = result;
    const canvas = ref.current;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const cell = size / qs;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < qs; r++)
      for (let c = 0; c < qs; c++)
        if (matrix[r][c]) ctx.fillRect(c * cell, r * cell, cell, cell);
  }, [data, size]);
  return <canvas ref={ref} style={{ borderRadius: 12, display: "block" }} />;
}

// ── Tooltip style (shared with Recharts) ─────────────────────────────────────
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: T.card, border: `1px solid ${T.border}`,
  borderRadius: 8, padding: "7px 11px", fontSize: 12, color: T.text,
};
