import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { IncomeForm, RecurringIncomeForm } from '@/components/forms';

const FREQ_MULT: Record<string, number> = {
	daily: 30,
	weekly: 4.3,
	fortnightly: 2.17,
	monthly: 1,
	quarterly: 1 / 3,
	yearly: 1 / 12,
};

export function IncomeView() {
	const { state, save, remove } = useApp();
	const [addRecurring, setAddRecurring] = useState(false);
	const [addOneoff, setAddOneoff] = useState(false);

	const monthlyRecurring = state.recurringIncomes
		.filter((r) => r.isActive)
		.reduce((s, i) => s + (i.amount ?? 0) * (FREQ_MULT[i.frequency] ?? 1), 0);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="font-display text-xl font-bold">Income</h2>
				<p className="text-sm text-muted-foreground mt-0.5">
					~{fmt(monthlyRecurring)}/month recurring
				</p>
			</div>

			<Tabs defaultValue="recurring">
				<TabsList className="w-full">
					<TabsTrigger
						value="recurring"
						className="flex-1">
						Recurring
					</TabsTrigger>
					<TabsTrigger
						value="oneoff"
						className="flex-1">
						One-off
					</TabsTrigger>
				</TabsList>

				<TabsContent value="recurring">
					<div className="flex flex-col gap-3">
						<div className="flex justify-end">
							<Button
								size="sm"
								onClick={() => setAddRecurring(true)}>
								<Plus className="h-4 w-4" /> Add
							</Button>
						</div>
						{state.recurringIncomes.length === 0 ? (
							<EmptyState
								icon="💵"
								title="No recurring income"
								description="Add salary, freelance, rental income…"
							/>
						) : (
							state.recurringIncomes.map((inc) => (
								<Card key={inc.id}>
									<CardContent className="flex items-center justify-between p-4">
										<div>
											<p className="font-semibold">{inc.name}</p>
											<div className="flex items-center gap-2 mt-1">
												<Badge variant="muted">{inc.frequency}</Badge>
												<span className="text-xs text-muted-foreground">
													Next: {fmtDate(inc.nextDate)}
												</span>
												{!inc.isActive && (
													<Badge variant="secondary">paused</Badge>
												)}
											</div>
										</div>
										<div className="flex items-center gap-2">
											<span className="font-mono font-bold text-profit">
												{fmt(inc.amount)}
											</span>
											<Button
												size="icon-sm"
												variant="destructive"
												onClick={() => remove('recurringIncomes', inc.id)}>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									</CardContent>
								</Card>
							))
						)}
					</div>
				</TabsContent>

				<TabsContent value="oneoff">
					<div className="flex flex-col gap-3">
						<div className="flex justify-end">
							<Button
								size="sm"
								onClick={() => setAddOneoff(true)}>
								<Plus className="h-4 w-4" /> Add
							</Button>
						</div>
						{state.incomes.length === 0 ? (
							<EmptyState
								icon="💵"
								title="No income records"
								description="Log one-off income payments here"
							/>
						) : (
							[...state.incomes]
								.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
								.map((inc) => (
									<Card key={inc.id}>
										<CardContent className="flex items-center justify-between p-4">
											<div>
												<p className="font-semibold">{inc.name}</p>
												<p className="text-xs text-muted-foreground mt-1">
													{fmtDate(inc.date)} ·{' '}
													{state.accounts.find(
														(a) => a.id === inc.accountId
													)?.name ?? '?'}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<span className="font-mono font-bold text-profit">
													{fmt(inc.amount)}
												</span>
												<Button
													size="icon-sm"
													variant="destructive"
													onClick={() => remove('incomes', inc.id)}>
													<Trash2 className="h-3.5 w-3.5" />
												</Button>
											</div>
										</CardContent>
									</Card>
								))
						)}
					</div>
				</TabsContent>
			</Tabs>

			{/* Dialogs */}
			<Dialog
				open={addRecurring}
				onOpenChange={setAddRecurring}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Recurring Income</DialogTitle>
					</DialogHeader>
					<RecurringIncomeForm
						accounts={state.accounts}
						onSave={async (d) => {
							await save('recurringIncomes', d);
							setAddRecurring(false);
						}}
						onCancel={() => setAddRecurring(false)}
					/>
				</DialogContent>
			</Dialog>

			<Dialog
				open={addOneoff}
				onOpenChange={setAddOneoff}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Income</DialogTitle>
					</DialogHeader>
					<IncomeForm
						accounts={state.accounts}
						onSave={async (d) => {
							await save('incomes', d);
							setAddOneoff(false);
						}}
						onCancel={() => setAddOneoff(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
