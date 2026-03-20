import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { RowActions, useEditDelete } from './EntityView';
import { EntityView } from './EntityView';
import { ExpenseForm } from '@/components/forms';
import { MonthlyBarsChart } from '@/components/charts';
import type { Expense } from '@/types';

const COLORS = [
	'hsl(191 100% 47%)',
	'hsl(158 84% 44%)',
	'#a78bfa',
	'hsl(38 95% 55%)',
	'hsl(350 85% 60%)',
	'#fb923c',
];

export function ExpensesView() {
	const { state } = useApp();
	const [cat, setCat] = useState('all');

	const { startEdit, doRemove, EditDialog } = useEditDelete<Expense>({
		entity: 'expenses',
		FormComp: ExpenseForm,
		formProps: { accounts: state.accounts, accountHeads: state.accountHeads },
		formTitle: 'Expense',
	});

	const allCats = ['all', ...new Set(state.expenses.map((e) => e.category))];
	const filtered =
		cat === 'all' ? state.expenses : state.expenses.filter((e) => e.category === cat);
	const sorted = [...filtered].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
	const total = filtered.reduce((s, e) => s + (e.amount ?? 0), 0);
	const grandTotal = state.expenses.reduce((s, e) => s + (e.amount ?? 0), 0);
	const catTotals = state.expenses.reduce<Record<string, number>>((a, e) => {
		a[e.category] = (a[e.category] ?? 0) + (e.amount ?? 0);
		return a;
	}, {});
	const topCats = Object.entries(catTotals)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);

	return (
		<EntityView
			title="Expenses"
			subtitle={`${filtered.length} records · ${fmt(total)}`}
			entity="expenses"
			FormComp={ExpenseForm}
			formProps={{ accounts: state.accounts, accountHeads: state.accountHeads }}>
			{state.expenses.length > 0 && (
				<>
					<Card>
						<CardHeader className="pb-0">
							<CardTitle>Monthly Spending</CardTitle>
						</CardHeader>
						<CardContent className="pt-3">
							<MonthlyBarsChart
								expenses={state.expenses}
								height={110}
							/>
						</CardContent>
					</Card>
					{topCats.length > 0 && (
						<Card>
							<CardHeader className="pb-0">
								<CardTitle>By Category</CardTitle>
							</CardHeader>
							<CardContent className="pt-3 flex flex-col gap-3">
								{topCats.map(([c, amt], i) => (
									<div key={c}>
										<div className="flex justify-between text-xs mb-1">
											<span
												className="font-medium"
												style={{ color: COLORS[i % COLORS.length] }}>
												{c}
											</span>
											<span className="font-mono text-muted-foreground">
												{fmt(amt)}
											</span>
										</div>
										<div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
											<div
												className="h-full rounded-full transition-all duration-500"
												style={{
													width: `${Math.min(100, (amt / Math.max(grandTotal, 1)) * 100)}%`,
													background: COLORS[i % COLORS.length],
												}}
											/>
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					)}
				</>
			)}

			<div className="flex gap-2 overflow-x-auto pb-1">
				{allCats.map((c) => (
					<button
						key={c}
						onClick={() => setCat(c)}
						className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${cat === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
						{c}
					</button>
				))}
			</div>

			{sorted.length === 0 ? (
				<EmptyState
					icon="🧾"
					title="No expenses"
					description="Tap + Add to log your first expense"
				/>
			) : (
				<div className="flex flex-col gap-2">
					{sorted.map((e) => (
						<Card key={e.id}>
							<CardContent className="flex items-center justify-between p-3">
								<div className="min-w-0 flex-1">
									<p className="font-medium truncate">{e.name}</p>
									<p className="text-xs text-muted-foreground">
										{e.category} · {fmtDate(e.date)} ·{' '}
										{state.accounts.find((a) => a.id === e.accountId)?.name ??
											'?'}
									</p>
								</div>
								<div className="flex items-center gap-2 ml-3">
									<span className="font-mono font-bold text-loss">
										{fmt(e.amount)}
									</span>
									<RowActions
										onEdit={() => startEdit(e)}
										onDelete={() => doRemove(e.id)}
									/>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
			{EditDialog}
		</EntityView>
	);
}
