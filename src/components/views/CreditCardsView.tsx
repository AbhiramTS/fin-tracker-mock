import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { useNavigation } from '@/context/NavigationContext';
import { fmt, fmtDate, daysFromNow } from '@/utils/format';
import { currentCreditCardCycle } from '@/utils/amortisation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEntityFormPage } from './EntityView';
import { CreditCardForm } from '@/components/forms';
import { CreditCardLedgerPage } from './AccountLedger';
import type { Account } from '@/types';

export function CreditCardsView() {
	const { state } = useApp();
	const { route, openSubpage, goBack } = useNavigation();
	const creditCardAccounts = state.accounts.filter((a) => a.type === 'credit_card');

	const detailsForAccount = (account: Account) => {
		const trackedBalance = state.computedBalances[account.id] ?? account.openingBalance ?? 0;
		const fromAccount = account.creditCard;
		const todayIso = format(new Date(), 'yyyy-MM-dd');
		return {
			limit: fromAccount?.limit ?? 0,
			outstanding: Math.max(0, -trackedBalance),
			statementDay: fromAccount?.statementDay ?? 1,
			billingCycleDays: fromAccount?.billingCycleDays ?? 30,
			gracePeriodDays: fromAccount?.gracePeriodDays ?? 20,
			dueDate: fromAccount?.dueDate ?? todayIso,
			statementDate: fromAccount?.statementDate ?? todayIso,
			taxRate: fromAccount?.taxRate,
		};
	};

	const totalDebt = creditCardAccounts.reduce((s, a) => s + detailsForAccount(a).outstanding, 0);

	const { openAdd, startEdit, doRemove, FormPage } = useEntityFormPage<Account>({
		tab: 'cards',
		records: creditCardAccounts,
		entity: 'accounts',
		FormComp: CreditCardForm,
		pageTitle: 'Credit Cards',
		formTitle: 'Credit Card',
	});
	const ledgerCard =
		route.tab === 'cards' && route.subpage === 'ledger'
			? (creditCardAccounts.find((account) => account.id === route.id) ?? null)
			: null;
	const ledgerPage =
		route.tab === 'cards' && route.subpage === 'ledger' ? (
			<CreditCardLedgerPage
				card={ledgerCard}
				onBack={goBack}
			/>
		) : null;
	const showSubpage = Boolean(FormPage || ledgerPage);

	return (
		<>
			<div className={showSubpage ? 'hidden' : undefined}>
				<EntityView
					title="Credit Cards"
					subtitle={`Total outstanding: ${fmt(totalDebt)}`}
					onAdd={openAdd}>
					{creditCardAccounts.length === 0 ? (
						<EmptyState
							icon="💳"
							title="No credit cards"
							description="Track balances, billing cycles, and due dates"
						/>
					) : (
						creditCardAccounts.map((a) => {
							const c = detailsForAccount(a);
							const util = ((c.outstanding ?? 0) / Math.max(c.limit ?? 1, 1)) * 100;
							const cycle = currentCreditCardCycle({
								statementDate: c.statementDate,
								statementDay: c.statementDay ?? 1,
								billingCycleDays: c.billingCycleDays ?? 30,
								gracePeriodDays: c.gracePeriodDays ?? 20,
							});
							const nextDueIso = format(cycle.nextDueDate, 'yyyy-MM-dd');
							const days = daysFromNow(nextDueIso);

							return (
								<Card
									key={a.id}
									className="cursor-pointer hover:border-primary/40 transition-colors"
									onClick={() =>
										openSubpage('ledger', { tab: 'cards', id: a.id })
									}>
									<CardContent className="p-4">
										<div className="flex items-start justify-between mb-3">
											<div>
												<p className="font-semibold">
													{a.name || 'Unnamed card'}
												</p>
												<div className="flex gap-1.5 mt-1">
													<Badge variant="muted">
														{c.billingCycleDays ?? 30}d cycle
													</Badge>
													<Badge variant="muted">
														{c.gracePeriodDays ?? 20}d grace
													</Badge>
													{c.taxRate && (
														<Badge variant="warning">
															{c.taxRate}% tax
														</Badge>
													)}
												</div>
											</div>
											<div className="flex items-center gap-1">
												<RowActions
													onEdit={() => startEdit(a)}
													onDelete={() => doRemove(a.id)}
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
												{fmtDate(nextDueIso)}
											</span>
										</div>
										<Separator className="my-3" />
										<div className="grid grid-cols-3 gap-2 text-xs">
											{[
												[
													'Statement day',
													`Day ${cycle.currentStatementDate.getDate()}`,
													`next: ${format(cycle.nextStatementDate, 'd MMM')}`,
												],
												[
													'Payment due',
													`${c.gracePeriodDays ?? 20} days`,
													`due: ${format(cycle.nextDueDate, 'd MMM')}`,
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
													<p className="text-muted-foreground mb-0.5">
														{label}
													</p>
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
													l.linkedCreditCardId === a.id
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
				</EntityView>
			</div>
			{FormPage}
			{ledgerPage}
		</>
	);
}
