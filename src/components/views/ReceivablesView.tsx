import { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate, daysFromNow } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEditDelete } from './EntityView';
import { ReceivableForm, RepaymentForm } from '@/components/forms';
import { ReceivableLedgerDialog } from './AccountLedger';
import { getReceivableJournalStats } from '@/utils/receivables';
import type { Receivable } from '@/types';

export function ReceivablesView() {
	const { state, save } = useApp();
	const [repayFor, setRepayFor] = useState<string | null>(null);
	const [ledgerReceivable, setLedgerReceivable] = useState<Receivable | null>(null);

	const receivablesWithStats = state.receivables.map((receivable) => ({
		receivable,
		stats: getReceivableJournalStats(receivable, state.journalEntries),
	}));
	const active = receivablesWithStats.filter((r) => !r.stats.isSettled);
	const settled = receivablesWithStats.filter((r) => r.stats.isSettled);
	const totalOut = active.reduce((s, r) => s + r.stats.outstanding, 0);

	const { startEdit, doRemove, EditDialog } = useEditDelete<Receivable>({
		entity: 'receivables',
		FormComp: ReceivableForm,
		formProps: { accounts: state.accounts, accountHeads: state.accountHeads },
		formTitle: 'Receivable',
	});

	const handleRepayment = async (data: Record<string, unknown>) => {
		const receivable = state.receivables.find((r) => r.id === repayFor);
		if (!receivable) return;
		await save('repaymentRecords', data);
		const amount = (data.amount as number) ?? 0;
		const receiveAccountId = (data.accountId as string) ?? receivable.accountId;
		const repaymentDate = (data.date as string) ?? new Date().toISOString().slice(0, 10);
		if (amount > 0 && receiveAccountId) {
			await save('journalEntries', {
				description: `Repayment from ${receivable.personName}`,
				amount,
				date: repaymentDate,
				type: 'lending_repayment',
				debitAccountHeadId: receiveAccountId,
				creditAccountHeadId: receivable.receivableHeadId ?? 'head_asset',
				notes: data.notes,
			});
		}
		setRepayFor(null);
	};

	return (
		<EntityView
			title="Money Lent"
			subtitle={`${active.length} active · ${fmt(totalOut)} outstanding`}
			entity="receivables"
			FormComp={ReceivableForm}
			formProps={{ accounts: state.accounts, accountHeads: state.accountHeads }}
			onAfterSave={async (saved) => {
				const receivable = saved as Receivable;
				const isNew = !state.receivables.some((r) => r.id === receivable.id);
				if (!isNew) return;
				if (!receivable.amountLent || !receivable.accountId) return;

				await save('journalEntries', {
					description: `Lent to ${receivable.personName}`,
					amount: receivable.amountLent,
					date: receivable.dateLent,
					type: 'lending_disbursal',
					debitAccountHeadId: receivable.receivableHeadId ?? 'head_asset',
					creditAccountHeadId: receivable.accountId,
					notes: receivable.description ?? receivable.notes,
				});
			}}>
			{state.receivables.length === 0 && (
				<EmptyState
					icon="🤝"
					title="No receivables"
					description="Track money you've lent to friends, family, or others"
				/>
			)}

			{active.length > 0 && (
				<div className="flex flex-col gap-3">
					{active.map(({ receivable: r, stats }) => {
						const outstanding = stats.outstanding;
						const pct = Math.min(
							100,
							(stats.totalRepaid / Math.max(stats.totalDisbursed, 1)) * 100
						);
						const days = r.expectedRepaymentDate
							? daysFromNow(r.expectedRepaymentDate)
							: null;
						const repayments = state.repaymentRecords.filter(
							(rr) => rr.receivableId === r.id
						);
						return (
							<Card
								key={r.id}
								className={`transition-colors${r.receivableHeadId ? ' cursor-pointer hover:border-primary/40' : ''}`}
								onClick={() => r.receivableHeadId && setLedgerReceivable(r)}>
								<CardContent className="p-4">
									<div className="flex items-start justify-between mb-2">
										<div>
											<p className="font-semibold">{r.personName}</p>
											{r.description && (
												<p className="text-xs text-muted-foreground">
													{r.description}
												</p>
											)}
										</div>
										<div className="flex items-start gap-2">
											<div className="text-right">
												<p className="font-mono font-bold text-warning">
													{fmt(outstanding)}
												</p>
												<p className="text-xs text-muted-foreground">
													outstanding
												</p>
											</div>
											<RowActions
												onEdit={() => startEdit(r)}
												onDelete={() => doRemove(r.id)}
											/>{' '}
											{r.receivableHeadId && (
												<ChevronRight className="h-3.5 w-3.5 text-muted-foreground self-center" />
											)}{' '}
										</div>
									</div>
									<div className="flex justify-between text-xs text-muted-foreground mb-1">
										<span>
											Lent: {fmt(stats.totalDisbursed)} on{' '}
											{fmtDate(r.dateLent)}
										</span>
										<span>Repaid: {fmt(stats.totalRepaid)}</span>
									</div>
									{stats.openingBalance > 0 && (
										<p className="text-[11px] text-muted-foreground mb-1">
											Includes opening balance: {fmt(stats.openingBalance)}
										</p>
									)}
									<Progress
										value={pct}
										className="h-1.5"
										indicatorClassName="bg-profit"
									/>
									{days !== null && (
										<p
											className={`text-xs mt-2 ${days < 0 ? 'text-loss' : days <= 7 ? 'text-warning' : 'text-muted-foreground'}`}>
											{days < 0
												? `Overdue by ${Math.abs(days)}d`
												: days === 0
													? 'Expected today'
													: `Expected in ${days}d`}{' '}
											· {fmtDate(r.expectedRepaymentDate)}
										</p>
									)}
									{repayments.length > 0 && (
										<div className="mt-3">
											<p className="text-xs text-muted-foreground mb-1.5">
												Repayment history
											</p>
											{repayments.map((rr) => (
												<div
													key={rr.id}
													className="flex justify-between text-xs py-0.5">
													<span className="text-muted-foreground">
														{fmtDate(rr.date)}
													</span>
													<span className="font-mono text-profit">
														+{fmt(rr.amount)}
													</span>
												</div>
											))}
										</div>
									)}
									<Button
										size="sm"
										variant="profit"
										className="mt-3 w-full"
										onClick={(e) => {
											e.stopPropagation();
											setRepayFor(r.id);
										}}>
										<Plus className="h-3.5 w-3.5" /> Record Repayment
									</Button>
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}

			{settled.length > 0 && (
				<div className="flex flex-col gap-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">
						Settled
					</p>
					{settled.map(({ receivable: r, stats }) => (
						<Card
							key={r.id}
							className={`opacity-60 transition-colors${r.receivableHeadId ? ' cursor-pointer hover:border-primary/40 hover:opacity-100' : ''}`}
							onClick={() => r.receivableHeadId && setLedgerReceivable(r)}>
							<CardContent className="flex items-center justify-between p-4">
								<div>
									<p className="font-semibold line-through">{r.personName}</p>
									<p className="text-xs text-muted-foreground">
										{fmt(stats.totalDisbursed)} · {fmtDate(r.dateLent)}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="profit">Settled</Badge>
									<RowActions
										onEdit={() => startEdit(r)}
										onDelete={() => doRemove(r.id)}
									/>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{EditDialog}

			<ReceivableLedgerDialog
				receivable={ledgerReceivable}
				onClose={() => setLedgerReceivable(null)}
			/>

			<Dialog
				open={!!repayFor}
				onOpenChange={(o) => !o && setRepayFor(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Record Repayment</DialogTitle>
					</DialogHeader>
					{repayFor && (
						<RepaymentForm
							receivableId={repayFor}
							accounts={state.accounts}
							defaultAccountId={
								state.receivables.find((r) => r.id === repayFor)?.accountId
							}
							onSave={handleRepayment as (d: Record<string, unknown>) => void}
							onCancel={() => setRepayFor(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</EntityView>
	);
}
