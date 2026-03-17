import { useMemo } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { buildForecast } from '@/utils/forecast';
import { fmt, fmtDate, daysFromNow, fmtCompact, todayStr } from '@/utils/format';
import { getOccurrencesForMonth, urgencyClass, urgencyLabel } from '@/utils/recurring';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { StatCard, StatGrid } from '@/components/ui/stat-card';
import { Separator } from '@/components/ui/separator';
import { ForecastChart, SpendingDonut, MonthlyBarsChart, NetWorthChart } from '@/components/charts';

export function DashboardView() {
	const { state } = useApp();
	const { timeline, shortfall, safeToSpend, totalBalance, monthlyObligations } = useMemo(
		() => buildForecast(state, 60),
		[state]
	);

	const totalInv = state.investments.reduce((s, i) => s + (i.value ?? 0), 0);
	const totalDebt =
		state.loans.reduce(
			(s, l) =>
				s + Math.max(0, (l.principalAmount ?? 0) - (l.emi ?? 0) * (l.paidMonths ?? 0)),
			0
		) + state.creditCards.reduce((s, c) => s + (c.outstanding ?? 0), 0);
	const netWorth = totalBalance + totalInv - totalDebt;
	const outstandingReceivables = state.receivables
		.filter((r) => !r.isSettled)
		.reduce((s, r) => s + (r.amountLent - r.amountRepaid), 0);
	const stress = Math.min(
		100,
		Math.round((totalDebt / Math.max(totalBalance + totalInv, 1)) * 100)
	);
	const nextIncome = [...state.recurringIncomes]
		.filter((r) => r.isActive)
		.sort((a, b) => (a.nextDate ?? '').localeCompare(b.nextDate ?? ''))[0];

	const today = new Date();
	const thisMonthOccs = useMemo(
		() => getOccurrencesForMonth(state, today.getFullYear(), today.getMonth()),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[state]
	);
	const todayStr_ = todayStr();
	// 5 soonest unpaid payment occurrences this month
	const upcoming = thisMonthOccs
		.filter((o) => o.kind !== 'recurring_income' && o.status === 'unpaid')
		.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
		.slice(0, 5);

	const activeGoals = state.goals.filter((g) => g.status === 'active');

	return (
		<div className="flex flex-col gap-5 animate-fade-in">
			{/* Alert bar */}
			{shortfall && (
				<div className="flex items-center gap-3 rounded-xl border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					<span>
						Projected shortfall on <strong>{fmtDate(shortfall.date)}</strong> — balance
						drops to {fmt(shortfall.balance)}
					</span>
				</div>
			)}

			{/* KPI grid */}
			<StatGrid>
				<StatCard
					icon="💰"
					label="Total Balance"
					value={fmtCompact(totalBalance)}
					variant="cyan"
				/>
				<StatCard
					icon="✅"
					label="Safe to Spend"
					value={fmtCompact(safeToSpend)}
					variant="profit"
				/>
				<StatCard
					icon="📈"
					label="Net Worth"
					value={fmtCompact(netWorth)}
					variant={netWorth >= 0 ? 'profit' : 'loss'}
				/>
				<StatCard
					icon="📅"
					label="Monthly Out"
					value={fmtCompact(monthlyObligations)}
					variant="warning"
				/>
			</StatGrid>

			{/* Forecast chart */}
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle>60-Day Balance Forecast</CardTitle>
						<Badge variant={shortfall ? 'destructive' : 'profit'}>
							{shortfall ? `⚠ Shortfall ${fmtDate(shortfall.date)}` : '✓ Stable'}
						</Badge>
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					<ForecastChart
						timeline={timeline}
						height={130}
					/>
				</CardContent>
			</Card>

			{/* Stress + next income */}
			<div className="grid grid-cols-2 gap-3">
				<Card>
					<CardContent className="flex flex-col items-center gap-2 p-4">
						<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
							Debt Stress
						</p>
						<div className="relative h-16 w-16">
							<svg
								viewBox="0 0 36 36"
								className="rotate-[-90deg] w-full h-full">
								<circle
									cx="18"
									cy="18"
									r="15.9"
									fill="none"
									stroke="hsl(220 35% 16%)"
									strokeWidth="3.5"
								/>
								<circle
									cx="18"
									cy="18"
									r="15.9"
									fill="none"
									stroke={
										stress < 35
											? 'hsl(158 84% 44%)'
											: stress < 65
												? 'hsl(38 95% 55%)'
												: 'hsl(350 85% 60%)'
									}
									strokeWidth="3.5"
									strokeDasharray={`${stress} 100`}
									strokeLinecap="round"
								/>
							</svg>
							<div className="absolute inset-0 flex items-center justify-center">
								<span className="font-mono text-base font-bold">{stress}</span>
							</div>
						</div>
						<p
							className={`text-xs font-bold ${stress < 35 ? 'text-profit' : stress < 65 ? 'text-warning' : 'text-loss'}`}>
							{stress < 35 ? 'Low' : stress < 65 ? 'Moderate' : 'High'}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="p-4">
						<p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
							Next Income
						</p>
						{nextIncome ? (
							<>
								<p className="font-mono text-lg font-bold text-profit">
									{fmt(nextIncome.amount)}
								</p>
								<p className="text-xs text-muted-foreground mt-1">
									{nextIncome.name}
								</p>
								<p className="text-xs text-muted-foreground/60">
									{fmtDate(nextIncome.nextDate)}
								</p>
							</>
						) : (
							<p className="text-sm text-muted-foreground">No recurring income set</p>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Spending donut */}
			{state.expenses.length > 0 && (
				<Card>
					<CardHeader className="pb-0">
						<CardTitle>Spending Breakdown</CardTitle>
					</CardHeader>
					<CardContent className="pt-3">
						<div className="flex gap-4 items-center">
							<div className="shrink-0">
								<SpendingDonut
									expenses={state.expenses}
									height={150}
								/>
							</div>
							<div className="flex flex-col gap-1.5 flex-1 min-w-0">
								{Object.entries(
									state.expenses.reduce<Record<string, number>>((a, e) => {
										a[e.category] = (a[e.category] ?? 0) + (e.amount ?? 0);
										return a;
									}, {})
								)
									.sort((a, b) => b[1] - a[1])
									.slice(0, 5)
									.map(([cat, amt], i) => {
										const total = state.expenses.reduce(
											(s, e) => s + (e.amount ?? 0),
											0
										);
										const pct = (amt / Math.max(total, 1)) * 100;
										const colors = [
											'text-cyan',
											'text-profit',
											'text-[#a78bfa]',
											'text-warning',
											'text-loss',
										];
										const barColors = [
											'hsl(191 100% 47%)',
											'hsl(158 84% 44%)',
											'#a78bfa',
											'hsl(38 95% 55%)',
											'hsl(350 85% 60%)',
										];
										return (
											<div key={cat}>
												<div className="flex justify-between text-xs mb-0.5">
													<span className={`${colors[i]} font-medium`}>
														{cat}
													</span>
													<span className="font-mono text-muted-foreground">
														{pct.toFixed(0)}%
													</span>
												</div>
												<div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
													<div
														className="h-full rounded-full transition-all duration-500"
														style={{
															width: `${Math.min(100, pct)}%`,
															background: barColors[i],
														}}
													/>
												</div>
											</div>
										);
									})}
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Monthly bars */}
			{state.expenses.length > 0 && (
				<Card>
					<CardHeader className="pb-0">
						<CardTitle>Monthly Spending</CardTitle>
					</CardHeader>
					<CardContent className="pt-3">
						<MonthlyBarsChart
							expenses={state.expenses}
							height={120}
						/>
					</CardContent>
				</Card>
			)}

			{/* Net worth trend */}
			{(state.accounts.length > 0 || state.investments.length > 0) && (
				<Card>
					<CardHeader className="pb-0">
						<CardTitle>Net Worth Trend</CardTitle>
					</CardHeader>
					<CardContent className="pt-3">
						<NetWorthChart
							accounts={state.accounts}
							investments={state.investments}
							loans={state.loans}
							creditCards={state.creditCards}
							height={110}
						/>
					</CardContent>
				</Card>
			)}

			{/* Upcoming payments */}
			{upcoming.length > 0 && (
				<Card>
					<CardHeader className="pb-0">
						<div className="flex items-center justify-between">
							<CardTitle>Upcoming Payments</CardTitle>
							<span className="text-xs text-muted-foreground">
								{format(today, 'MMMM')}
							</span>
						</div>
					</CardHeader>
					<CardContent className="pt-3 flex flex-col gap-2">
						{upcoming.map((o) => {
							const { bg, border, text, dot } = urgencyClass(o.dueDate, o.status);
							const label = urgencyLabel(o.dueDate);
							return (
								<div
									key={o.id}
									className={`flex items-center gap-3 rounded-lg border p-3 ${bg} ${border}`}>
									<div className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium truncate">{o.label}</p>
										<p className={`text-[10px] font-semibold ${text}`}>
											{label} · {fmtDate(o.dueDate)}
										</p>
									</div>
									<span
										className={`font-mono text-sm font-bold shrink-0 ${text}`}>
										{fmt(o.amount)}
									</span>
								</div>
							);
						})}
					</CardContent>
				</Card>
			)}

			{/* Active Goals */}
			{activeGoals.length > 0 && (
				<Card>
					<CardHeader className="pb-0">
						<CardTitle>Goals</CardTitle>
					</CardHeader>
					<CardContent className="pt-3 flex flex-col gap-3">
						{activeGoals.map((g) => {
							const pct = Math.min(
								100,
								(g.currentAmount / Math.max(g.targetAmount, 1)) * 100
							);
							return (
								<div key={g.id}>
									<div className="flex justify-between text-sm mb-1">
										<span className="font-medium">
											{g.icon} {g.name}
										</span>
										<span className="font-mono text-muted-foreground">
											{pct.toFixed(0)}%
										</span>
									</div>
									<Progress
										value={pct}
										className="h-1.5"
										indicatorClassName="bg-profit"
									/>
									<div className="flex justify-between text-xs text-muted-foreground mt-1">
										<span>{fmt(g.currentAmount)}</span>
										<span>{fmt(g.targetAmount)}</span>
									</div>
								</div>
							);
						})}
					</CardContent>
				</Card>
			)}

			{/* Receivables summary */}
			{outstandingReceivables > 0 && (
				<Card>
					<CardContent className="flex items-center justify-between p-4">
						<div className="flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-warning" />
							<p className="text-sm font-medium">Outstanding Receivables</p>
						</div>
						<span className="font-mono text-sm font-bold text-warning">
							{fmt(outstandingReceivables)}
						</span>
					</CardContent>
				</Card>
			)}

			{/* Accounts */}
			{state.accounts.length > 0 && (
				<Card>
					<CardHeader className="pb-0">
						<CardTitle>Accounts</CardTitle>
					</CardHeader>
					<CardContent className="pt-3 flex flex-col gap-0">
						{state.accounts.map((a, i) => (
							<div key={a.id}>
								{i > 0 && <Separator className="my-2" />}
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<div
											className="h-2.5 w-2.5 rounded-full shrink-0"
											style={{ background: a.color ?? 'hsl(191 100% 47%)' }}
										/>
										<span className="text-sm">{a.name}</span>
										<Badge
											variant="muted"
											className="text-[10px]">
											{a.type.replace('_', ' ')}
										</Badge>
									</div>
									<span className="font-mono text-sm font-bold">
										{fmt(a.balance)}
									</span>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			)}
		</div>
	);
}
