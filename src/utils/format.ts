import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

const INR = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	maximumFractionDigits: 0,
});
const INR_DEC = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export const fmt = (n?: number) => INR.format(n ?? 0);
export const fmtDec = (n?: number) => INR_DEC.format(n ?? 0);
export const fmtDate = (d?: string) => (d ? format(parseISO(d), 'd MMM') : '—');
export const fmtDateFull = (d?: string) => (d ? format(parseISO(d), 'd MMM yyyy') : '—');
export const fmtMonth = (d?: string) => (d ? format(parseISO(d), 'MMM yyyy') : '—');
export const fmtShort = (d?: string) => (d ? format(parseISO(d), 'd MMM') : '');
export const todayStr = () => format(new Date(), 'yyyy-MM-dd');
export const daysFromNow = (ds?: string) => (ds ? differenceInDays(parseISO(ds), new Date()) : 999);
export const timeAgo = (ds?: string) =>
	ds ? formatDistanceToNow(parseISO(ds), { addSuffix: true }) : '—';

export const addMonths = (date: Date, n: number) => {
	const d = new Date(date);
	d.setMonth(d.getMonth() + n);
	return d;
};
export const addDays = (date: Date, n: number) => {
	const d = new Date(date);
	d.setDate(d.getDate() + n);
	return d;
};

/** Format a percentage with 1 decimal place */
export const fmtPct = (n: number) => `${n.toFixed(1)}%`;

/** Abbreviate large numbers: 1,20,000 → ₹1.2L */
export const fmtCompact = (n: number): string => {
	const abs = Math.abs(n);
	const sign = n < 0 ? '−' : '';
	if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`;
	if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
	if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(0)}K`;
	return fmt(n);
};
