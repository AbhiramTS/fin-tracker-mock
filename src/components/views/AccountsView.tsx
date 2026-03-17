import { useState } from 'react';
import { Trash2, RefreshCw, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView } from './EntityView';
import { AccountForm, ReconciliationForm } from '@/components/forms';
import { AccountLedgerDialog } from './AccountLedger';
import type { Account } from '@/types';

export function AccountsView() {
	const { state, save, remove } = useApp();
	const total = state.accounts.reduce((s, a) => s + (a.balance ?? 0), 0);

	const [reconAccount, setReconAccount] = useState<string | null>(null);
	const [ledgerAccount, setLedgerAccount] = useState<Account | null>(null);

	const recon = state.accounts.find((a) => a.id === reconAccount);

	return (
		<EntityView
			title="Accounts"
			subtitle={`Total tracked: ${fmt(total)}`}
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
							<div className="flex items-center gap-1 shrink-0 ml-3">
								<span className="font-mono font-bold text-cyan mr-1">
									{fmt(a.balance)}
								</span>
								<Button
									size="icon-sm"
									variant="ghost"
									title="Reconcile"
									onClick={(e) => {
										e.stopPropagation();
										setReconAccount(a.id);
									}}>
									<RefreshCw className="h-3.5 w-3.5" />
								</Button>
								<Button
									size="icon-sm"
									variant="destructive"
									onClick={(e) => {
										e.stopPropagation();
										remove('accounts', a.id);
									}}>
									<Trash2 className="h-3.5 w-3.5" />
								</Button>
								<ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-1" />
							</div>
						</CardContent>
					</Card>
				))
			)}

			{/* Transaction ledger */}
			<AccountLedgerDialog
				account={ledgerAccount}
				onClose={() => setLedgerAccount(null)}
			/>

			{/* Reconciliation dialog */}
			<Dialog
				open={!!reconAccount}
				onOpenChange={(o) => !o && setReconAccount(null)}>
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
								if (d.difference && d.difference !== 0) {
									await save('accounts', {
										...recon,
										balance: d.actualBalance ?? recon.balance,
									});
								}
								setReconAccount(null);
							}}
							onCancel={() => setReconAccount(null)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</EntityView>
	);
}
