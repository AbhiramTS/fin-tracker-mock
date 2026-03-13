import { useEffect, type ReactNode } from "react";
import { T } from "./tokens";

interface ModalProps { title: string; onClose: () => void; children: ReactNode; }

export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)",
          zIndex: 200, animation: "fadeIn .15s",
        }}
      />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
        background: T.card, borderRadius: "20px 20px 0 0",
        border: `1px solid ${T.border}`,
        maxHeight: "93vh", overflowY: "auto",
        animation: "sheetUp .22s ease",
        paddingBottom: "env(safe-area-inset-bottom,16px)",
      }}>
        {/* drag handle */}
        <div style={{
          width: 32, height: 3, background: T.border, borderRadius: 2,
          position: "absolute", top: 7, left: "50%", transform: "translateX(-50%)",
        }} />
        {/* header */}
        <div style={{
          position: "sticky", top: 0, background: T.card, zIndex: 1,
          padding: "14px 18px 12px", borderBottom: `1px solid ${T.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: T.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px 18px" }}>{children}</div>
      </div>
    </>
  );
}
