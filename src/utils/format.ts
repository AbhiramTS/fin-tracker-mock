import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

const INR = new Intl.NumberFormat('en-IN', {
	style: 'currency',
	currency: 'INR',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

export const fmt = (n?: number) => INR.format(n ?? 0);
export const fmtDec = fmt;
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

/** Show exact INR value up to ₹1Cr; abbreviate only above that. */
export const fmtCompact = (n: number): string => {
	const abs = Math.abs(n);
	const sign = n < 0 ? '−' : '';
	if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
	return fmt(n);
};
