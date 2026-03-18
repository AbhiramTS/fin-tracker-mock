import {
	AreaChart,
	Area,
	BarChart,
	Bar,
	PieChart,
	Pie,
	Cell,
	LineChart,
	Line,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
} from 'recharts';
import { fmt, fmtShort } from '@/utils/format';
import type { ForecastDay, Expense, Investment, Account, Loan, CreditCard } from '@/types';

const CHART_COLORS = [
	'#00d4f5',
	'#00e5a0',
	'#a78bfa',
	'#ffb020',
	'#ff3d5e',
	'#fb923c',
	'#06d6a0',
	'#e879f9',
];
const TIP_STYLE = {
	background: 'hsl(222 47% 8%)',
	border: '1px solid hsl(220 35% 16%)',
	borderRadius: 8,
	padding: '6px 10px',
	fontSize: 12,
	color: 'hsl(210 40% 92%)',
};

export function ForecastChart({
	timeline,
	height = 140,
}: {
	timeline: ForecastDay[];
	height?: number;
}) {
	if (timeline.length < 2)
		return (
			<div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
				Add income &amp; recurring payments to see your forecast
			</div>
		);
	const data = timeline.map((t) => ({ name: fmtShort(t.date), v: Math.round(t.balance / 1000) }));
	const hasShortfall = timeline.some((t) => t.balance < 0);
	const color = hasShortfall ? 'hsl(350 85% 60%)' : 'hsl(191 100% 47%)';
	return (
		<ResponsiveContainer
			width="100%"
			height={height}>
			<AreaChart
				data={data}
				margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
				<defs>
					<linearGradient
						id="fcg"
						x1="0"
						y1="0"
						x2="0"
						y2="1">
						<stop
							offset="5%"
							stopColor={color}
							stopOpacity={0.2}
						/>
						<stop
							offset="95%"
							stopColor={color}
							stopOpacity={0}
						/>
					</linearGradient>
				</defs>
				<XAxis
					dataKey="name"
					tick={{ fill: 'hsl(215 25% 45%)', fontSize: 10 }}
					axisLine={false}
					tickLine={false}
					interval="preserveStartEnd"
				/>
				<YAxis hide />
				<Tooltip
					contentStyle={TIP_STYLE}
					formatter={(v: number) => [`₹${v}k`, 'Balance']}
					labelStyle={{ color: 'hsl(215 25% 45%)' }}
				/>
				<Area
					type="monotone"
					dataKey="v"
					stroke={color}
					strokeWidth={2}
					fill="url(#fcg)"
					dot={false}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

export function SpendingDonut({
	expenses,
	height = 160,
}: {
	expenses: Expense[];
	height?: number;
}) {
	const totals = expenses.reduce<Record<string, number>>((a, e) => {
		a[e.category] = (a[e.category] ?? 0) + (e.amount ?? 0);
		return a;
	}, {});
	const data = Object.entries(totals)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 7)
		.map(([name, value]) => ({ name, value: Math.round(value) }));
	if (!data.length) return null;
	return (
		<ResponsiveContainer
			width="100%"
			height={height}>
			<PieChart>
				<Pie
					data={data}
					cx="50%"
					cy="50%"
					innerRadius={height * 0.28}
					outerRadius={height * 0.42}
					paddingAngle={2}
					dataKey="value"
					strokeWidth={0}>
					{data.map((_, i) => (
						<Cell
							key={i}
							fill={CHART_COLORS[i % CHART_COLORS.length]}
						/>
					))}
				</Pie>
				<Tooltip
					contentStyle={TIP_STYLE}
					formatter={(v: number) => [fmt(v), 'Spent']}
				/>
			</PieChart>
		</ResponsiveContainer>
	);
}

export function MonthlyBarsChart({
	expenses,
	height = 120,
}: {
	expenses: Expense[];
	height?: number;
}) {
	const months: Record<string, { label: string; v: number }> = {};
	const now = new Date();
	for (let i = 5; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		months[key] = { label: d.toLocaleDateString('en-IN', { month: 'short' }), v: 0 };
	}
	expenses.forEach((e) => {
		const k = e.date?.slice(0, 7);
		if (k && months[k]) months[k].v += e.amount ?? 0;
	});
	const data = Object.values(months).map((m) => ({ ...m, v: Math.round(m.v) }));
	const maxV = Math.max(...data.map((d) => d.v), 1);
	return (
		<ResponsiveContainer
			width="100%"
			height={height}>
			<BarChart
				data={data}
				margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
				barSize={20}>
				<XAxis
					dataKey="label"
					tick={{ fill: 'hsl(215 25% 45%)', fontSize: 11 }}
					axisLine={false}
					tickLine={false}
				/>
				<YAxis hide />
				<Tooltip
					contentStyle={TIP_STYLE}
					formatter={(v: number) => [fmt(v), 'Spent']}
				/>
				<Bar
					dataKey="v"
					radius={[4, 4, 0, 0]}>
					{data.map((d, i) => (
						<Cell
							key={i}
							fill={d.v === maxV ? 'hsl(191 100% 47%)' : 'hsl(191 100% 47% / 0.35)'}
						/>
					))}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
}

export function NetWorthChart({
	accounts,
	investments,
	loans,
	creditCards,
	height = 110,
}: {
	accounts: Account[];
	investments: Investment[];
	loans: Loan[];
	creditCards: CreditCard[];
	height?: number;
}) {
	const bal = accounts.reduce((s, a) => s + (a.balance ?? 0), 0);
	const inv = investments.reduce((s, i) => s + (i.value ?? 0), 0);
	const debt =
		loans.reduce(
			(s, l) =>
				s + Math.max(0, (l.principalAmount ?? 0) - (l.emi ?? 0) * (l.paidMonths ?? 0)),
			0
		) + creditCards.reduce((s, c) => s + (c.outstanding ?? 0), 0);
	const nw = bal + inv - debt;
	const data = Array.from({ length: 6 }, (_, i) => {
		const d = new Date();
		d.setMonth(d.getMonth() - 5 + i);
		return {
			label: d.toLocaleDateString('en-IN', { month: 'short' }),
			v: Math.round((nw * (0.8 + i * 0.04)) / 1000),
		};
	});
	return (
		<ResponsiveContainer
			width="100%"
			height={height}>
			<LineChart
				data={data}
				margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
				<XAxis
					dataKey="label"
					tick={{ fill: 'hsl(215 25% 45%)', fontSize: 11 }}
					axisLine={false}
					tickLine={false}
				/>
				<YAxis hide />
				<Tooltip
					contentStyle={TIP_STYLE}
					formatter={(v: number) => [`₹${v}k`, 'Net Worth']}
				/>
				<Line
					type="monotone"
					dataKey="v"
					stroke="hsl(158 84% 44%)"
					strokeWidth={2.5}
					dot={{ fill: 'hsl(158 84% 44%)', r: 3, strokeWidth: 0 }}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}

export function PortfolioDonut({
	investments,
	height = 130,
}: {
	investments: Investment[];
	height?: number;
}) {
	const byType = investments.reduce<Record<string, number>>((a, i) => {
		a[i.type] = (a[i.type] ?? 0) + (i.value ?? 0);
		return a;
	}, {});
	const data = Object.entries(byType).map(([name, value]) => ({
		name: name.replace('_', ' '),
		value: Math.round(value),
	}));
	if (data.length < 2) return null;
	return (
		<ResponsiveContainer
			width="100%"
			height={height}>
			<PieChart>
				<Pie
					data={data}
					cx="50%"
					cy="50%"
					outerRadius={55}
					paddingAngle={3}
					dataKey="value"
					strokeWidth={0}>
					{data.map((_, i) => (
						<Cell
							key={i}
							fill={CHART_COLORS[i % CHART_COLORS.length]}
						/>
					))}
				</Pie>
				<Tooltip
					contentStyle={TIP_STYLE}
					formatter={(v: number) => [fmt(v), 'Value']}
				/>
			</PieChart>
		</ResponsiveContainer>
	);
}

export const CHART_COLORS_EXPORT = CHART_COLORS;
