export const fmt = (n?: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(n ?? 0);

export const fmtDate = (d?: string): string =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "–";

export const fmtDateFull = (d?: string): string =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "–";

export const fmtShort = (d?: string): string =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "";

export const todayStr = (): string => new Date().toISOString().split("T")[0];

export const daysFromNow = (ds?: string): number =>
  ds ? Math.ceil((new Date(ds).getTime() - Date.now()) / 86_400_000) : 999;

export const addMonths = (date: Date, n: number): Date => {
  const d = new Date(date); d.setMonth(d.getMonth() + n); return d;
};

export const addDays = (date: Date, n: number): Date => {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
};
