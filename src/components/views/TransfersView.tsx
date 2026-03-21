import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEntityFormPage } from './EntityView';
import { TransferForm } from '@/components/forms';
import type { JournalEntry } from '@/types';

export function TransfersView() {
	const { state } = useApp();
	const transfers = state.journalEntries.filter((e) => e.type === 'transfer');
	const headName = (id: string) => state.accountHeads.find((h) => h.id === id)?.name ?? '?';

	const { openAdd, startEdit, doRemove, FormPage } = useEntityFormPage<JournalEntry>({
		tab: 'transfers',
		records: transfers,
		entity: 'journalEntries',
		FormComp: TransferForm,
		formProps: {
			accounts: state.accounts,
			accountHeads: state.accountHeads,
			defaultType: 'transfer',
		},
		pageTitle: 'Transfers',
		formTitle: 'Transfer',
	});

	if (FormPage) return FormPage;

	const sorted = [...transfers].sort((a, b) => b.date.localeCompare(a.date));

	return (
		<EntityView
			title="Transfers"
			subtitle={`${transfers.length} transfers`}
			onAdd={openAdd}>
			{sorted.length === 0 ? (
				<EmptyState
					icon="🔄"
					title="No transfers"
					description="Record money moved between your own accounts"
				/>
			) : (
				sorted.map((t) => (
					<Card key={t.id}>
						<CardContent className="flex items-center justify-between p-4">
							<div className="flex items-center gap-2 min-w-0">
								<span className="text-sm font-medium text-muted-foreground truncate max-w-[80px]">
									{headName(t.creditAccountHeadId)}
								</span>
								<ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
								<span className="text-sm font-medium truncate max-w-[80px]">
									{headName(t.debitAccountHeadId)}
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
				))
			)}
		</EntityView>
	);
}
