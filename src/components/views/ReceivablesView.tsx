import { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNavigation } from '@/context/NavigationContext';
import { fmt, fmtDate, daysFromNow } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEntityFormPage } from './EntityView';
import { ReceivableForm, LendingEntryForm } from '@/components/forms';
import { ReceivableLedgerPage } from './AccountLedger';
import { getPersonNetStats } from '@/utils/receivables';
import { SubpageLayout } from '@/components/ui/subpage-layout';
import type { Receivable, LendingEntryType } from '@/types';

export function ReceivablesView() {
	const { state, save } = useApp();
	const { route, openSubpage, goBack } = useNavigation();
	const [showEntryForm, setShowEntryForm] = useState(false);
	const [entryPersonId, setEntryPersonId] = useState<string | null>(null);

	const receivablesWithStats = state.receivables.map((receivable) => ({
		receivable,
		stats: getPersonNetStats(receivable, state.journalEntries),
	}));
	const active = receivablesWithStats.filter((r) => r.stats.netBalance !== 0);
	const settled = receivablesWithStats.filter((r) => r.stats.netBalance === 0);
	const totalReceivable = active.reduce((sum, r) => sum + Math.max(0, r.stats.netBalance), 0);
	const totalPayable = active.reduce((sum, r) => sum + Math.max(0, -r.stats.netBalance), 0);

	const { startEdit, doRemove, FormPage } = useEntityFormPage<Receivable>({
		tab: 'receivables',
		records: state.receivables,
		entity: 'receivables',
		FormComp: ReceivableForm,
		formProps: { accounts: state.accounts, accountHeads: state.accountHeads },
		pageTitle: 'Lending & Borrowing',
		formTitle: 'Person',
		onAfterSave: async (saved) => {
			const receivable = saved as Receivable;
			const isNew = !state.receivables.some((existing) => existing.id === receivable.id);
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
		},
	});

	const ledgerReceivable =
		route.tab === 'receivables' && route.subpage === 'ledger'
			? (state.receivables.find((receivable) => receivable.id === route.id) ?? null)
			: null;
	const ledgerPage =
		route.tab === 'receivables' && route.subpage === 'ledger' ? (
			<ReceivableLedgerPage
				receivable={ledgerReceivable}
				onBack={goBack}
			/>
		) : null;

	const detailReceivable =
		route.tab === 'receivables' && route.subpage === 'person'
			? (state.receivables.find((receivable) => receivable.id === route.id) ?? null)
			: null;

	const entryForReceivable = entryPersonId
		? (state.receivables.find((r) => r.id === entryPersonId) ?? null)
		: null;

	const handleEntrySave = async (data: {
		receivableId?: string;
		personName: string;
		type: LendingEntryType;
		amount: number;
		date: string;
		accountId: string;
		notes?: string;
	}) => {
		const personName = data.personName.trim();
		let receivable: Receivable | null = data.receivableId
			? (state.receivables.find((r) => r.id === data.receivableId) ?? null)
			: (state.receivables.find(
					(r) => r.personName.toLowerCase() === personName.toLowerCase()
				) ?? null);

		if (!receivable) {
			receivable = (await save('receivables', {
				personName,
				description: '',
				openingBalance: 0,
				amountLent: 0,
				dateLent: data.date,
				accountId: data.accountId,
				notes: '',
			})) as Receivable;
		}

		if (!receivable) {
			throw new Error('Unable to resolve receivable');
		}

		if ((data.type === 'lent' || data.type === 'received') && !receivable.receivableHeadId) {
			const head = await save('accountHeads', {
				name: receivable.personName,
				type: 'asset',
				parentId: 'head_asset',
				isSystem: false,
				isAccount: false,
				entityHint: 'lending_head',
			});
			receivable = { ...receivable, receivableHeadId: head.id };
			await save('receivables', receivable as unknown as Record<string, unknown>);
		}

		if ((data.type === 'borrowed' || data.type === 'paid') && !receivable.payableHeadId) {
			const head = await save('accountHeads', {
				name: receivable.personName,
				type: 'liability',
				parentId: 'head_liability',
				isSystem: false,
				isAccount: false,
				entityHint: 'payable',
			});
			receivable = { ...receivable, payableHeadId: head.id };
			await save('receivables', receivable as unknown as Record<string, unknown>);
		}

		await save('repaymentRecords', {
			receivableId: receivable.id,
			amount: data.amount,
			date: data.date,
			accountId: data.accountId,
			notes: data.notes,
			type: data.type,
		});

		const journalType =
			data.type === 'lent'
				? 'lending_disbursal'
				: data.type === 'received'
					? 'lending_repayment'
					: data.type === 'borrowed'
						? 'borrowing_disbursal'
						: 'borrowing_repayment';

		const journalEntry = {
			description:
				data.type === 'lent'
					? `Lent to ${receivable.personName}`
					: data.type === 'received'
						? `Repayment from ${receivable.personName}`
						: data.type === 'borrowed'
							? `Borrowed from ${receivable.personName}`
							: `Paid ${receivable.personName}`,
			amount: data.amount,
			date: data.date,
			type: journalType,
			debitAccountHeadId:
				data.type === 'lent'
					? (receivable.receivableHeadId ?? 'head_asset')
					: data.type === 'received'
						? data.accountId
						: data.type === 'borrowed'
							? data.accountId
							: (receivable.payableHeadId ?? 'head_liability'),
			creditAccountHeadId:
				data.type === 'lent'
					? data.accountId
					: data.type === 'received'
						? (receivable.receivableHeadId ?? 'head_asset')
						: data.type === 'borrowed'
							? (receivable.payableHeadId ?? 'head_liability')
							: data.accountId,
			notes: data.notes,
		};

		await save('journalEntries', journalEntry);
		setShowEntryForm(false);
		setEntryPersonId(null);
	};

	const personEntries = (receivable: Receivable) => {
		const payments = state.repaymentRecords
			.filter((rr) => rr.receivableId === receivable.id)
			.sort((a, b) => a.date.localeCompare(b.date));

		const legacyEntry = receivable.amountLent
			? [
					{
						id: `${receivable.id}-legacy`,
						type: 'lent' as LendingEntryType,
						amount: receivable.amountLent,
						date: receivable.dateLent,
						accountId: receivable.accountId,
						notes: receivable.description ?? receivable.notes,
					},
				]
			: [];

		return [
			...legacyEntry,
			...payments.map((rr) => ({
				id: rr.id,
				type: rr.type ?? 'received',
				amount: rr.amount,
				date: rr.date,
				accountId: rr.accountId ?? '',
				notes: rr.notes,
			})),
		].sort((a, b) => a.date.localeCompare(b.date));
	};

	const PersonDetailPage = ({ receivable }: { receivable: Receivable }) => {
		const stats = getPersonNetStats(receivable, state.journalEntries);
		const entries = personEntries(receivable);
		return (
			<SubpageLayout
				title={receivable.personName}
				subtitle={`Net balance: ${fmt(stats.netBalance)} ${
					stats.netBalance > 0
						? '(They owe you)'
						: stats.netBalance < 0
							? '(You owe them)'
							: '(Settled)'
				}`}
				onBack={goBack}>
				<div className="flex flex-col gap-4">
					<div className="grid gap-3 sm:grid-cols-2">
						<Card>
							<CardContent>
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Lent
								</p>
								<p className="mt-2 text-lg font-semibold">{fmt(stats.netLent)}</p>
							</CardContent>
						</Card>
						<Card>
							<CardContent>
								<p className="text-xs uppercase tracking-wide text-muted-foreground">
									Borrowed
								</p>
								<p className="mt-2 text-lg font-semibold">
									{fmt(stats.netBorrowed)}
								</p>
							</CardContent>
						</Card>
					</div>
					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<Button
								onClick={() => {
									setEntryPersonId(receivable.id);
									setShowEntryForm(true);
								}}>
								Add Entry
							</Button>
							{receivable.receivableHeadId && (
								<Button
									variant="outline"
									onClick={() =>
										openSubpage('ledger', {
											tab: 'receivables',
											id: receivable.id,
										})
									}>
									View Journal Ledger
								</Button>
							)}
						</div>
						{entries.length === 0 ? (
							<EmptyState
								icon="🧾"
								title="No entries yet"
								description="Add a lending or borrowing entry to start tracking this person."
							/>
						) : (
							<div className="flex flex-col gap-3">
								{entries.map((entry) => {
									const account = state.accounts.find(
										(a) => a.id === entry.accountId
									);
									return (
										<Card
											key={entry.id}
											className="p-4">
											<div className="flex items-start justify-between gap-4">
												<div>
													<p className="font-semibold">{entry.type}</p>
													<p className="text-xs text-muted-foreground">
														{fmtDate(entry.date)} ·{' '}
														{account?.name ?? 'Account'}
													</p>
												</div>
												<div className="text-right font-mono text-lg">
													{fmt(entry.amount)}
												</div>
											</div>
											{entry.notes && (
												<p className="mt-3 text-sm text-muted-foreground">
													{entry.notes}
												</p>
											)}
										</Card>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</SubpageLayout>
		);
	};

	const personDetailPage = detailReceivable ? (
		<PersonDetailPage receivable={detailReceivable} />
	) : null;

	const showSubpage = Boolean(FormPage || ledgerPage || personDetailPage);

	return (
		<>
			<div className={showSubpage ? 'hidden' : undefined}>
				<EntityView
					title="Lending & Borrowing"
					subtitle={`${active.length} active · ${fmt(totalReceivable)} receivable · ${fmt(totalPayable)} payable`}
					onAdd={() => {
						setEntryPersonId(null);
						setShowEntryForm(true);
					}}>
					{state.receivables.length === 0 && (
						<EmptyState
							icon="🤝"
							title="No lending or borrowing records"
							description="Track money you lent, borrowed, paid, or received from people."
						/>
					)}

					{active.length > 0 && (
						<div className="flex flex-col gap-3">
							{active.map(({ receivable: r, stats }) => {
								const balance = stats.netBalance;
								const balanceLabel = balance > 0 ? 'They owe you' : 'You owe them';
								const balanceClass = balance > 0 ? 'text-profit' : 'text-loss';
								return (
									<Card
										key={r.id}
										className="transition-colors cursor-pointer hover:border-primary/40"
										onClick={() =>
											openSubpage('person', { tab: 'receivables', id: r.id })
										}>
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
												<div className="text-right">
													<p
														className={`font-mono font-bold ${balanceClass}`}>
														{fmt(balance)}
													</p>
													<p className="text-xs text-muted-foreground">
														{balanceLabel}
													</p>
												</div>
											</div>
											<div className="grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
												<div>Lent: {fmt(stats.netLent)}</div>
												<div>Borrowed: {fmt(stats.netBorrowed)}</div>
												<div>Outstanding: {fmt(Math.abs(balance))}</div>
												<div>{fmtDate(r.dateLent)}</div>
											</div>
											<div className="mt-3 flex flex-col gap-2 sm:flex-row">
												<Button
													size="sm"
													variant="outline"
													onClick={(e) => {
														e.stopPropagation();
														setEntryPersonId(r.id);
														setShowEntryForm(true);
													}}>
													Add Entry
												</Button>
												<RowActions
													onEdit={() => startEdit(r)}
													onDelete={() => doRemove(r.id)}
												/>
											</div>
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
									className="opacity-60 transition-colors cursor-pointer hover:border-primary/40 hover:opacity-100"
									onClick={() =>
										openSubpage('person', { tab: 'receivables', id: r.id })
									}>
									<CardContent className="flex items-center justify-between p-4">
										<div>
											<p className="font-semibold line-through">
												{r.personName}
											</p>
											<p className="text-xs text-muted-foreground">
												{fmt(stats.netLent)} · {fmtDate(r.dateLent)}
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

					<Dialog
						open={showEntryForm}
						onOpenChange={(open) => !open && setShowEntryForm(false)}>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>Add Lending / Borrowing Entry</DialogTitle>
							</DialogHeader>
							<LendingEntryForm
								initialData={{
									receivableId: entryForReceivable?.id,
									personName: entryForReceivable?.personName ?? '',
									type: 'lent',
									amount: 0,
									date: new Date().toISOString().slice(0, 10),
									accountId:
										entryForReceivable?.accountId ??
										state.accounts[0]?.id ??
										'',
								}}
								receivables={state.receivables}
								accounts={state.accounts}
								onSave={handleEntrySave}
								onCancel={() => setShowEntryForm(false)}
							/>
						</DialogContent>
					</Dialog>
				</EntityView>
			</div>
			{FormPage}
			{ledgerPage}
			{personDetailPage}{' '}
		</>
	);
}
