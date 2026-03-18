import { ArrowRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEditDelete } from './EntityView';
import { TransferForm } from '@/components/forms';
import type { Transfer } from '@/types';

export function TransfersView() {
	const { state } = useApp();
	const { startEdit, doRemove, EditDialog } = useEditDelete<Transfer>({
		entity: 'transfers',
		FormComp: TransferForm,
		formProps: { accounts: state.accounts },
		formTitle: 'Transfer',
	});
	const sorted = [...state.transfers].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

	return (
		<EntityView
			title="Transfers"
			subtitle={`${state.transfers.length} transfers`}
			entity="transfers"
			FormComp={TransferForm}
			formProps={{ accounts: state.accounts }}>
			{sorted.length === 0 ? (
				<EmptyState
					icon="🔄"
					title="No transfers"
					description="Record money moved between your own accounts"
				/>
			) : (
				sorted.map((t) => {
					const from = state.accounts.find((a) => a.id === t.fromAccountId);
					const to = state.accounts.find((a) => a.id === t.toAccountId);
					return (
						<Card key={t.id}>
							<CardContent className="flex items-center justify-between p-4">
								<div className="flex items-center gap-2 min-w-0">
									<span className="text-sm font-medium text-muted-foreground truncate max-w-[80px]">
										{from?.name ?? '?'}
									</span>
									<ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
									<span className="text-sm font-medium truncate max-w-[80px]">
										{to?.name ?? '?'}
									</span>
								</div>
								<div className="flex items-center gap-2 ml-2">
									<div className="text-right">
										<p className="font-mono font-bold">{fmt(t.amount)}</p>
										<p className="text-xs text-muted-foreground">
											{fmtDate(t.date)}
										</p>
									</div>
									<RowActions
										onEdit={() => startEdit(t)}
										onDelete={() => doRemove(t.id)}
									/>
								</div>
							</CardContent>
						</Card>
					);
				})
			)}
			{EditDialog}
		</EntityView>
	);
}
