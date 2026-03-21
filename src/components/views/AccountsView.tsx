import { useState } from 'react';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNavigation } from '@/context/NavigationContext';
import { fmt } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEntityFormPage } from './EntityView';
import { AccountForm, ReconciliationForm } from '@/components/forms';
import { AccountLedgerPage } from './AccountLedger';
import type { Account } from '@/types';

export function AccountsView() {
	const { state, save } = useApp();
	const { route, openSubpage, goBack } = useNavigation();
	const total = Object.values(state.computedBalances).reduce((s, b) => s + b, 0);

	const [reconId, setReconId] = useState<string | null>(null);

	const { openAdd, startEdit, doRemove, FormPage } = useEntityFormPage<Account>({
		tab: 'accounts',
		records: state.accounts,
		entity: 'accounts',
		FormComp: AccountForm,
		formProps: { accountHeads: state.accountHeads },
		pageTitle: 'Accounts',
		formTitle: 'Account',
	});
	const ledgerAccount =
		route.tab === 'accounts' && route.subpage === 'ledger'
			? (state.accounts.find((account) => account.id === route.id) ?? null)
			: null;

	if (FormPage) return FormPage;
	if (route.tab === 'accounts' && route.subpage === 'ledger') {
		return (
			<AccountLedgerPage
				account={ledgerAccount}
				onBack={goBack}
			/>
		);
	}

	const recon = state.accounts.find((a) => a.id === reconId);

	return (
		<EntityView
			title="Accounts"
			subtitle={`Total: ${fmt(total)}`}
			onAdd={openAdd}>
			{state.accounts.length === 0 ? (
				<EmptyState
					icon="🏦"
					title="No accounts yet"
					description="Add bank accounts, cash wallets, credit cards…"
				/>
			) : (
				state.accounts.map((a) => (
					<Card
						key={a.id}
						className="cursor-pointer hover:border-primary/40 transition-colors"
						onClick={() => openSubpage('ledger', { tab: 'accounts', id: a.id })}>
						<CardContent className="flex items-center justify-between p-4">
							<div className="flex items-center gap-3 min-w-0">
								<div
									className="h-3 w-3 rounded-full shrink-0"
									style={{ background: a.color ?? 'hsl(191 100% 47%)' }}
								/>
								<div className="min-w-0">
									<p className="font-semibold truncate">{a.name}</p>
									<Badge
										variant="muted"
										className="mt-0.5 text-[10px]">
										{a.type.replace('_', ' ')}
									</Badge>
								</div>
							</div>
							<div className="flex items-center gap-2 ml-3">
								<span className="font-mono font-bold text-cyan">
									{fmt(state.computedBalances[a.id] ?? a.openingBalance ?? 0)}
								</span>
								<Button
									size="icon-sm"
									variant="ghost"
									title="Reconcile"
									onClick={(e) => {
										e.stopPropagation();
										setReconId(a.id);
									}}>
									<RefreshCw className="h-3.5 w-3.5" />
								</Button>
								<RowActions
									onEdit={() => startEdit(a)}
									onDelete={() => doRemove(a.id)}
								/>
								<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
							</div>
						</CardContent>
					</Card>
				))
			)}

			<Dialog
				open={!!reconId}
				onOpenChange={(o) => !o && setReconId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Reconcile Account</DialogTitle>
					</DialogHeader>
					{recon && (
						<ReconciliationForm
							account={recon}
							trackedBalance={state.computedBalances[recon.id] ?? 0}
							onSave={async (d) => {
								// Create a double-entry adjustment journal entry for the difference
								if (d.difference && d.difference !== 0) {
									// Positive difference: actual > tracked → credit equity, debit account (asset increases)
									// Negative difference: actual < tracked → debit equity, credit account (asset decreases)
									const isPositive = d.difference > 0;
									const adj = await save('journalEntries', {
										description: `Reconciliation adjustment — ${recon.name}`,
										amount: Math.abs(d.difference),
										date: d.reconciledDate,
										type: 'adjustment',
										debitAccountHeadId: isPositive ? recon.id : 'head_equity',
										creditAccountHeadId: isPositive ? 'head_equity' : recon.id,
										notes: d.notes ?? '',
									});
									d.adjustmentTransactionId = adj.id;
								}
								await save('reconciliations', d);
								setReconId(null);
							}}
							onCancel={() => setReconId(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</EntityView>
	);
}
