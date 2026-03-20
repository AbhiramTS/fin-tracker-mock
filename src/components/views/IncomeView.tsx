import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { RowActions, useEditDelete } from './EntityView';
import { IncomeForm, RecurringIncomeForm } from '@/components/forms';
import type { JournalEntry, RecurringIncome } from '@/types';

const FREQ_MULT: Record<string, number> = {
	daily: 30,
	weekly: 4.3,
	fortnightly: 2.17,
	monthly: 1,
	quarterly: 1 / 3,
	yearly: 1 / 12,
};

export function IncomeView() {
	const { state, save } = useApp();
	const [addRecurring, setAddRecurring] = useState(false);
	const [addOneoff, setAddOneoff] = useState(false);

	const incomes = state.journalEntries.filter((e) => e.type === 'income');
	const monthlyRecurring = state.recurringIncomes
		.filter((r) => r.isActive)
		.reduce((s, i) => s + (i.amount ?? 0) * (FREQ_MULT[i.frequency] ?? 1), 0);

	const headName = (id: string) => state.accountHeads.find((h) => h.id === id)?.name ?? '?';

	const {
		startEdit: startEditInc,
		doRemove: removeInc,
		EditDialog: EditIncDialog,
	} = useEditDelete<JournalEntry>({
		entity: 'journalEntries',
		FormComp: IncomeForm,
		formProps: {
			accounts: state.accounts,
			accountHeads: state.accountHeads,
			defaultType: 'income',
		},
		formTitle: 'Income',
	});
	const {
		startEdit: startEditRI,
		doRemove: removeRI,
		EditDialog: EditRIDialog,
	} = useEditDelete<RecurringIncome>({
		entity: 'recurringIncomes',
		FormComp: RecurringIncomeForm,
		formProps: { accounts: state.accounts, accountHeads: state.accountHeads },
		formTitle: 'Recurring Income',
	});

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
											<RowActions
												onEdit={() => startEditRI(inc)}
												onDelete={() => removeRI(inc.id)}
											/>
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
						{incomes.length === 0 ? (
							<EmptyState
								icon="💵"
								title="No income records"
								description="Log one-off income payments here"
							/>
						) : (
							[...incomes]
								.sort((a, b) => b.date.localeCompare(a.date))
								.map((inc) => (
									<Card key={inc.id}>
										<CardContent className="flex items-center justify-between p-4">
											<div>
												<p className="font-semibold">{inc.description}</p>
												<p className="text-xs text-muted-foreground mt-1">
													Dr: {headName(inc.debitAccountHeadId)} · Cr:{' '}
													{headName(inc.creditAccountHeadId)} ·{' '}
													{fmtDate(inc.date)}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<span className="font-mono font-bold text-profit">
													{fmt(inc.amount)}
												</span>
												<RowActions
													onEdit={() => startEditInc(inc)}
													onDelete={() => removeInc(inc.id)}
												/>
											</div>
										</CardContent>
									</Card>
								))
						)}
					</div>
				</TabsContent>
			</Tabs>

			{EditIncDialog}
			{EditRIDialog}

			<Dialog
				open={addRecurring}
				onOpenChange={setAddRecurring}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add Recurring Income</DialogTitle>
					</DialogHeader>
					<RecurringIncomeForm
						accounts={state.accounts}
						accountHeads={state.accountHeads}
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
						accountHeads={state.accountHeads}
						onSave={async (d) => {
							await save('journalEntries', d);
							setAddOneoff(false);
						}}
						onCancel={() => setAddOneoff(false)}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
