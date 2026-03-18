import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate, daysFromNow } from '@/utils/format';
import { nextStatementDate, dueFromStatement } from '@/utils/amortisation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEditDelete } from './EntityView';
import { CreditCardForm } from '@/components/forms';
import { CreditCardLedgerDialog } from './AccountLedger';
import type { CreditCard } from '@/types';

export function CreditCardsView() {
	const { state } = useApp();
	const totalDebt = state.creditCards.reduce((s, c) => s + (c.outstanding ?? 0), 0);
	const [ledgerCard, setLedgerCard] = useState<CreditCard | null>(null);

	const { startEdit, doRemove, EditDialog } = useEditDelete<CreditCard>({
		entity: 'creditCards',
		FormComp: CreditCardForm,
		formTitle: 'Credit Card',
	});

	return (
		<EntityView
			title="Credit Cards"
			subtitle={`Total outstanding: ${fmt(totalDebt)}`}
			entity="creditCards"
			FormComp={CreditCardForm}>
			{state.creditCards.length === 0 ? (
				<EmptyState
					icon="💳"
					title="No credit cards"
					description="Track balances, billing cycles, and due dates"
				/>
			) : (
				state.creditCards.map((c) => {
					const util = ((c.outstanding ?? 0) / Math.max(c.limit ?? 1, 1)) * 100;
					const days = daysFromNow(c.dueDate);
					const stmtDate = nextStatementDate({
						statementDay: c.statementDay ?? 1,
						billingCycleDays: c.billingCycleDays ?? 30,
					});
					const dueDate = dueFromStatement(stmtDate, c.gracePeriodDays ?? 20);

					return (
						<Card
							key={c.id}
							className="cursor-pointer hover:border-primary/40 transition-colors"
							onClick={() => setLedgerCard(c)}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between mb-3">
									<div>
										<p className="font-semibold">{c.name}</p>
										<div className="flex gap-1.5 mt-1">
											<Badge variant="muted">
												{c.billingCycleDays ?? 30}d cycle
											</Badge>
											<Badge variant="muted">
												{c.gracePeriodDays ?? 20}d grace
											</Badge>
											{c.taxRate && (
												<Badge variant="warning">{c.taxRate}% tax</Badge>
											)}
										</div>
									</div>
									<div className="flex items-center gap-1">
										<RowActions
											onEdit={() => startEdit(c)}
											onDelete={() => doRemove(c.id)}
										/>
										<ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-1" />
									</div>
								</div>
								<p className="font-mono text-2xl font-bold text-loss">
									{fmt(c.outstanding)}
								</p>
								<p className="text-xs text-muted-foreground mt-0.5 mb-3">
									of {fmt(c.limit)} limit
								</p>
								<Progress
									value={util}
									className="h-2"
									indicatorClassName={
										util > 70
											? 'bg-loss'
											: util > 40
												? 'bg-warning'
												: 'bg-profit'
									}
								/>
								<div className="flex justify-between mt-2 text-xs text-muted-foreground">
									<span>{util.toFixed(0)}% utilised</span>
									<span className={days <= 3 ? 'text-loss' : ''}>
										Due {days <= 0 ? 'today' : `in ${days}d`} ·{' '}
										{fmtDate(c.dueDate)}
									</span>
								</div>
								<Separator className="my-3" />
								<div className="grid grid-cols-3 gap-2 text-xs">
									{[
										[
											'Statement day',
											`Day ${c.statementDay ?? 1}`,
											`next: ${format(stmtDate, 'd MMM')}`,
										],
										[
											'Grace period',
											`${c.gracePeriodDays ?? 20} days`,
											`due: ${format(dueDate, 'd MMM')}`,
										],
										[
											'Cycle length',
											`${c.billingCycleDays ?? 30} days`,
											'monthly',
										],
									].map(([label, val, sub]) => (
										<div
											key={label}
											className="rounded-lg bg-muted/40 p-2">
											<p className="text-muted-foreground mb-0.5">{label}</p>
											<p className="font-semibold">{val}</p>
											<p className="text-muted-foreground/60 text-[10px] mt-0.5">
												{sub}
											</p>
										</div>
									))}
								</div>
								{(() => {
									const ccLoans = state.loans.filter(
										(l) =>
											l.loanType === 'credit_card' &&
											l.linkedCreditCardId === c.id
									);
									if (!ccLoans.length) return null;
									return (
										<>
											<Separator className="my-3" />
											<p className="text-xs font-semibold text-muted-foreground mb-2">
												CC-linked EMIs
											</p>
											{ccLoans.map((loan) => (
												<div
													key={loan.id}
													className="flex justify-between text-xs py-1">
													<span className="text-muted-foreground">
														{loan.name}
													</span>
													<span className="font-mono font-semibold">
														{fmt(loan.emi)}/mo
													</span>
												</div>
											))}
										</>
									);
								})()}
							</CardContent>
						</Card>
					);
				})
			)}
			{EditDialog}
			<CreditCardLedgerDialog
				card={ledgerCard}
				onClose={() => setLedgerCard(null)}
			/>
		</EntityView>
	);
}
