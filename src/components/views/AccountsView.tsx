import { useState } from 'react';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEditDelete } from './EntityView';
import { AccountForm, ReconciliationForm } from '@/components/forms';
import { AccountLedgerDialog } from './AccountLedger';
import type { Account } from '@/types';

export function AccountsView() {
	const { state, save } = useApp();
	const total = state.accounts.reduce((s, a) => s + (a.balance ?? 0), 0);

	const [reconId, setReconId] = useState<string | null>(null);
	const [ledgerAccount, setLedgerAccount] = useState<Account | null>(null);

	const { startEdit, doRemove, EditDialog } = useEditDelete<Account>({
		entity: 'accounts',
		FormComp: AccountForm,
		formTitle: 'Account',
	});

	const recon = state.accounts.find((a) => a.id === reconId);

	return (
		<EntityView
			title="Accounts"
			subtitle={`Total: ${fmt(total)}`}
			entity="accounts"
			FormComp={AccountForm}>
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
						onClick={() => setLedgerAccount(a)}>
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
									{fmt(a.balance)}
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

			{EditDialog}
			<AccountLedgerDialog
				account={ledgerAccount}
				onClose={() => setLedgerAccount(null)}
			/>

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
							trackedBalance={recon.balance}
							onSave={async (d) => {
								await save('reconciliations', d);
								if (d.difference && d.difference !== 0)
									await save('accounts', {
										...recon,
										balance: d.actualBalance ?? recon.balance,
									});
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
