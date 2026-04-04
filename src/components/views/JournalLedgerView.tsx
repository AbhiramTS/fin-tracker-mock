import { useState, useMemo } from 'react';
import {
	Search,
	ArrowUpRight,
	ArrowDownLeft,
	ArrowLeftRight,
	SlidersHorizontal,
	GripVertical,
	Pencil,
	Trash2,
	X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDateFull } from '@/utils/format';
import { generateAmortisation } from '@/utils/amortisation';
import { occurrenceId } from '@/utils/recurring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { JournalEntryForm } from '@/components/forms';
import { useNavigation } from '@/context/NavigationContext';
import { useEntityFormPage } from './EntityView';
import type { JournalEntry, JournalEntryType } from '@/types';

// ── Type meta ─────────────────────────────────────────────────────────────────
const TYPE_META: Record<
	JournalEntryType,
	{ icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
	expense: { icon: ArrowUpRight, color: 'text-loss', label: 'Expense' },
	income: { icon: ArrowDownLeft, color: 'text-profit', label: 'Income' },
	transfer: { icon: ArrowLeftRight, color: 'text-warning', label: 'Transfer' },
	emi: { icon: ArrowUpRight, color: 'text-loss', label: 'EMI' },
	credit_card_payment: {
		icon: ArrowUpRight,
		color: 'text-loss',
		label: 'CC Bill Payment',
	},
	loan_disbursal: { icon: ArrowDownLeft, color: 'text-cyan', label: 'Loan Disbursal' },
	loan_payoff: { icon: ArrowUpRight, color: 'text-loss', label: 'Loan Payoff' },
	lending_disbursal: { icon: ArrowUpRight, color: 'text-warning', label: 'Lending Disbursal' },
	lending_repayment: {
		icon: ArrowDownLeft,
		color: 'text-profit',
		label: 'Lending Repayment',
	},
	borrowing_disbursal: {
		icon: ArrowDownLeft,
		color: 'text-warning',
		label: 'Borrowing Disbursal',
	},
	borrowing_repayment: {
		icon: ArrowUpRight,
		color: 'text-loss',
		label: 'Borrowing Repayment',
	},
	adjustment: { icon: SlidersHorizontal, color: 'text-muted-foreground', label: 'Adjustment' },
	opening_balance: { icon: SlidersHorizontal, color: 'text-cyan', label: 'Opening Balance' },
};

// ── Running balance ───────────────────────────────────────────────────────────
// For a given account head view, running balance = Σ debits - Σ credits (asset)
// For global view, running balance tracks net asset flow
function withRunning(
	entries: JournalEntry[],
	accountHeadId?: string,
	openingBalance = 0
): (JournalEntry & { running: number })[] {
	let running = openingBalance;
	return entries.map((e) => {
		running += getSignedImpact(e, accountHeadId);
		return { ...e, running };
	});
}

function getSignedImpact(entry: JournalEntry, accountHeadId?: string): number {
	if (accountHeadId) {
		if (entry.debitAccountHeadId === accountHeadId) return entry.amount;
		if (entry.creditAccountHeadId === accountHeadId) return -entry.amount;
		return 0;
	}

	if (entry.type === 'income' || entry.type === 'opening_balance') return entry.amount;
	if (entry.type === 'loan_disbursal' || entry.type === 'lending_repayment') return entry.amount;
	if (
		entry.type === 'expense' ||
		entry.type === 'emi' ||
		entry.type === 'credit_card_payment' ||
		entry.type === 'loan_payoff' ||
		entry.type === 'lending_disbursal'
	)
		return -entry.amount;
	return 0;
}

function getDisplaySide(entry: JournalEntry, accountHeadId?: string): 'debit' | 'credit' | null {
	if (accountHeadId) {
		if (entry.debitAccountHeadId === accountHeadId) return 'debit';
		if (entry.creditAccountHeadId === accountHeadId) return 'credit';
		return null;
	}

	const signed = getSignedImpact(entry);
	if (signed > 0) return 'credit';
	if (signed < 0) return 'debit';
	return null;
}

// ─────────────────────────────────────────────────────────────────────────────
export function JournalLedgerView({ filterAccountHeadId }: { filterAccountHeadId?: string } = {}) {
	const { state, save } = useApp();
	const { tab } = useNavigation();
	const { startEdit, doRemove, FormPage } = useEntityFormPage<JournalEntry>({
		tab,
		records: state.journalEntries,
		entity: 'journalEntries',
		FormComp: JournalEntryForm,
		formProps: {
			accounts: state.accounts,
			accountHeads: state.accountHeads,
			loans: state.loans,
			allowTypeChange: true,
		},
		pageTitle: 'Journal Entry',
		formTitle: 'Journal Entry',
		editSubpage: 'edit-entry',
		onAfterSave: async (savedBase) => {
			const saved = savedBase as JournalEntry;
			if (saved.type !== 'emi' || !saved.emiNumber || saved.emiNumber < 1) return;

			const loan = state.loans.find((item) => item.id === saved.debitAccountHeadId);
			if (!loan) return;

			const row = generateAmortisation(loan).find((item) => item.month === saved.emiNumber);
			if (!row) return;

			const occId = occurrenceId(loan.id, row.date);
			const existing = state.paymentOccurrences.find((item) => item.id === occId);
			await save('paymentOccurrences', {
				...(existing ?? {
					id: occId,
					createdAt: saved.createdAt,
				}),
				updatedAt: new Date().toISOString(),
				kind: 'loan_emi',
				sourceId: loan.id,
				dueDate: row.date,
				amount: row.totalPayable,
				emiNumber: row.month,
				label: `${loan.name} — EMI #${row.month}`,
				debitAccountHeadId: loan.id,
				accountId: saved.creditAccountHeadId,
				status: 'paid',
				paidDate: saved.date,
				paidAmount: saved.amount,
				transactionId: saved.id,
			});
		},
	});

	const showFormPage = Boolean(FormPage);

	// ── Filters ────────────────────────────────────────────────────────────────
	const [search, setSearch] = useState('');
	const [typeFilter, setTypeFilter] = useState<JournalEntryType | 'all'>('all');
	const [headFilter, setHeadFilter] = useState<string>('all');
	const [dateFrom, setDateFrom] = useState('');
	const [dateTo, setDateTo] = useState('');
	const [amtMin, setAmtMin] = useState('');
	const [amtMax, setAmtMax] = useState('');
	const [showFilters, setShowFilters] = useState(false);
	const [expanded, setExpanded] = useState<string | null>(null);
	const [draggedId, setDraggedId] = useState<string | null>(null);
	const [dropTargetId, setDropTargetId] = useState<string | null>(null);
	const [isReordering, setIsReordering] = useState(false);

	const handleDelete = async (entry: JournalEntry) => {
		await doRemove(entry.id, entry.description);
		setExpanded((current) => (current === entry.id ? null : current));
	};

	const headName = (id: string) => state.accountHeads.find((h) => h.id === id)?.name ?? id;
	const activeHead = filterAccountHeadId ?? (headFilter !== 'all' ? headFilter : undefined);
	const isGlobalJournal = !activeHead;
	const activeAccount = state.accounts.find((a) => a.id === activeHead);
	const openingSeed = activeAccount?.openingBalance ?? 0;
	const hasNonHeadFilters =
		typeFilter !== 'all' ||
		Boolean(dateFrom) ||
		Boolean(dateTo) ||
		Boolean(amtMin) ||
		Boolean(amtMax) ||
		Boolean(search.trim());
	const canReorderRows = !hasNonHeadFilters;

	// ── Filter entries ─────────────────────────────────────────────────────────
	const filtered = useMemo(() => {
		// Start with all entries, sort oldest → newest
		let rows = [...state.journalEntries].sort((a, b) => {
			if (a.date !== b.date) return a.date.localeCompare(b.date);
			const ao = a.sortOrder ?? Number.POSITIVE_INFINITY;
			const bo = b.sortOrder ?? Number.POSITIVE_INFINITY;
			if (ao !== bo) return ao - bo;
			return a.createdAt.localeCompare(b.createdAt);
		});

		// Account head filter (from prop or from dropdown)
		if (activeHead) {
			rows = rows.filter(
				(e) => e.debitAccountHeadId === activeHead || e.creditAccountHeadId === activeHead
			);
		}

		if (typeFilter !== 'all') rows = rows.filter((e) => e.type === typeFilter);
		if (dateFrom) rows = rows.filter((e) => e.date >= dateFrom);
		if (dateTo) rows = rows.filter((e) => e.date <= dateTo);
		if (amtMin) rows = rows.filter((e) => e.amount >= parseFloat(amtMin));
		if (amtMax) rows = rows.filter((e) => e.amount <= parseFloat(amtMax));
		if (search.trim()) {
			const q = search.toLowerCase();
			rows = rows.filter(
				(e) =>
					e.description.toLowerCase().includes(q) ||
					(e.notes ?? '').toLowerCase().includes(q) ||
					headName(e.debitAccountHeadId).toLowerCase().includes(q) ||
					headName(e.creditAccountHeadId).toLowerCase().includes(q)
			);
		}

		return rows;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		state.journalEntries,
		filterAccountHeadId,
		headFilter,
		typeFilter,
		dateFrom,
		dateTo,
		amtMin,
		amtMax,
		search,
	]);

	const withBalances = useMemo(
		() => withRunning(filtered, activeHead, openingSeed),
		[filtered, activeHead, openingSeed]
	);

	const totals = useMemo(() => {
		if (activeHead) {
			const { netIn, netOut } = filtered.reduce(
				(acc, entry) => {
					const signed = getSignedImpact(entry, activeHead);
					if (signed > 0) acc.netIn += signed;
					else if (signed < 0) acc.netOut += Math.abs(signed);
					return acc;
				},
				{ netIn: 0, netOut: 0 }
			);

			return [
				{ label: 'Total In', value: netIn, cls: 'text-profit' },
				{ label: 'Total Out', value: netOut, cls: 'text-loss' },
				{
					label: 'Net',
					value: netIn - netOut,
					cls: netIn >= netOut ? 'text-profit' : 'text-loss',
				},
			] as const;
		}

		const totalDebits = filtered.reduce((sum, entry) => sum + entry.amount, 0);
		const totalCredits = totalDebits;
		const diff = totalDebits - totalCredits;

		return [
			{ label: 'Total Dr', value: totalDebits, cls: 'text-cyan' },
			{ label: 'Total Cr', value: totalCredits, cls: 'text-profit' },
			{ label: 'Diff', value: diff, cls: diff === 0 ? 'text-muted-foreground' : 'text-loss' },
		] as const;
	}, [filtered, activeHead]);

	// Group by date
	const byDate = useMemo(() => {
		const map = new Map<string, typeof withBalances>();
		withBalances.forEach((row) => {
			if (!map.has(row.date)) map.set(row.date, []);
			map.get(row.date)!.push(row);
		});
		return [...map.entries()]; // already sorted oldest first
	}, [withBalances]);

	const activeFilters = [
		typeFilter !== 'all',
		headFilter !== 'all',
		dateFrom,
		dateTo,
		amtMin,
		amtMax,
		search.trim(),
	].filter(Boolean).length;

	const clearFilters = () => {
		setTypeFilter('all');
		setHeadFilter('all');
		setDateFrom('');
		setDateTo('');
		setAmtMin('');
		setAmtMax('');
		setSearch('');
	};

	const beginDrag = (id: string) => {
		if (!canReorderRows || isReordering) return;
		setDraggedId(id);
	};

	const endDrag = () => {
		setDraggedId(null);
		setDropTargetId(null);
	};

	const nextSortOrder = (
		targetDate: string,
		targetId: string,
		dragId: string,
		entries: JournalEntry[]
	) => {
		const dayEntries = entries
			.filter((e) => e.date === targetDate && e.id !== dragId)
			.sort((a, b) => {
				const ao = a.sortOrder ?? Number.POSITIVE_INFINITY;
				const bo = b.sortOrder ?? Number.POSITIVE_INFINITY;
				if (ao !== bo) return ao - bo;
				return a.createdAt.localeCompare(b.createdAt);
			});

		const idx = dayEntries.findIndex((e) => e.id === targetId);
		if (idx < 0) {
			const max = dayEntries.reduce((m, e) => Math.max(m, e.sortOrder ?? 0), 0);
			return max + 1024;
		}

		const prev = idx > 0 ? dayEntries[idx - 1] : null;
		const curr = dayEntries[idx];
		const prevOrder = prev?.sortOrder ?? (curr.sortOrder ?? 1024) - 1024;
		const currOrder = curr.sortOrder ?? prevOrder + 1024;
		const candidate = (prevOrder + currOrder) / 2;
		if (Number.isFinite(candidate)) return candidate;
		return currOrder - 1;
	};

	const dropOnRow = async (targetId: string) => {
		if (!canReorderRows || isReordering || !draggedId || draggedId === targetId) return;

		const dragged = state.journalEntries.find((e) => e.id === draggedId);
		const target = state.journalEntries.find((e) => e.id === targetId);
		if (!dragged || !target) return;

		setIsReordering(true);
		try {
			const order = nextSortOrder(target.date, target.id, dragged.id, state.journalEntries);
			await save('journalEntries', {
				...dragged,
				date: target.date,
				sortOrder: order,
			});
		} finally {
			setIsReordering(false);
			setDraggedId(null);
			setDropTargetId(null);
		}
	};

	// All non-system account heads for the head filter dropdown
	const filterableHeads = state.accountHeads.filter((h) => h.parentId !== null);

	return (
		<>
			<div className={showFormPage ? 'hidden' : undefined}>
				<div className="flex flex-col gap-4">
					{!filterAccountHeadId && (
						<div>
							<h2 className="font-display text-xl font-bold">Account Book</h2>
							<p className="text-sm text-muted-foreground mt-0.5">
								{filtered.length} entries · oldest first
							</p>
						</div>
					)}

					{/* Totals strip */}
					{filtered.length > 0 && (
						<div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden border border-border">
							{totals.map(({ label, value, cls }, i) => (
								<div
									key={label}
									className={`flex flex-col items-center py-3 bg-muted/20 ${i < 2 ? 'border-r border-border' : ''}`}>
									<p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
										{label}
									</p>
									<p className={`font-mono text-xs font-bold mt-0.5 ${cls}`}>
										{fmt(value)}
									</p>
								</div>
							))}
						</div>
					)}

					{/* Search + filter toggle */}
					<div className="flex gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Search entries…"
								className="pl-8"
							/>
						</div>
						<Button
							variant={showFilters ? 'default' : 'outline'}
							size="sm"
							onClick={() => setShowFilters((v) => !v)}
							className="gap-1.5 shrink-0">
							<SlidersHorizontal className="h-3.5 w-3.5" />
							Filters
							{activeFilters > 0 && (
								<span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-primary text-[9px] font-bold">
									{activeFilters}
								</span>
							)}
						</Button>
					</div>

					{/* Expanded filter panel */}
					{showFilters && (
						<div className="rounded-xl border border-border p-3 flex flex-col gap-3">
							<div className="grid grid-cols-2 gap-2">
								{/* Type */}
								<div>
									<p className="text-[10px] font-semibold text-muted-foreground mb-1">
										Type
									</p>
									<Select
										value={typeFilter}
										onValueChange={(v) =>
											setTypeFilter(v as JournalEntryType | 'all')
										}>
										<SelectTrigger className="h-8 text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">All types</SelectItem>
											{(
												[
													'expense',
													'income',
													'transfer',
													'emi',
													'credit_card_payment',
													'loan_disbursal',
													'loan_payoff',
													'lending_disbursal',
													'lending_repayment',
													'adjustment',
													'opening_balance',
												] as JournalEntryType[]
											).map((t) => (
												<SelectItem
													key={t}
													value={t}>
													{TYPE_META[t].label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								{/* Account head */}
								{!filterAccountHeadId && (
									<div>
										<p className="text-[10px] font-semibold text-muted-foreground mb-1">
											Account head
										</p>
										<Select
											value={headFilter}
											onValueChange={setHeadFilter}>
											<SelectTrigger className="h-8 text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">All heads</SelectItem>
												{filterableHeads.map((h) => (
													<SelectItem
														key={h.id}
														value={h.id}>
														{h.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
							<div className="grid grid-cols-2 gap-2">
								<div>
									<p className="text-[10px] font-semibold text-muted-foreground mb-1">
										Date from
									</p>
									<Input
										type="date"
										value={dateFrom}
										onChange={(e) => setDateFrom(e.target.value)}
										className="h-8 text-xs"
									/>
								</div>
								<div>
									<p className="text-[10px] font-semibold text-muted-foreground mb-1">
										Date to
									</p>
									<Input
										type="date"
										value={dateTo}
										onChange={(e) => setDateTo(e.target.value)}
										className="h-8 text-xs"
									/>
								</div>
								<div>
									<p className="text-[10px] font-semibold text-muted-foreground mb-1">
										Min amount (₹)
									</p>
									<Input
										type="number"
										min="0"
										value={amtMin}
										onChange={(e) => setAmtMin(e.target.value)}
										className="h-8 text-xs"
										placeholder="0"
									/>
								</div>
								<div>
									<p className="text-[10px] font-semibold text-muted-foreground mb-1">
										Max amount (₹)
									</p>
									<Input
										type="number"
										min="0"
										value={amtMax}
										onChange={(e) => setAmtMax(e.target.value)}
										className="h-8 text-xs"
										placeholder="∞"
									/>
								</div>
							</div>
							{activeFilters > 0 && (
								<Button
									variant="ghost"
									size="sm"
									onClick={clearFilters}
									className="gap-1.5 text-muted-foreground">
									<X className="h-3.5 w-3.5" /> Clear all filters
								</Button>
							)}
						</div>
					)}

					{!canReorderRows && (
						<p className="text-[11px] text-muted-foreground px-1">
							Row reordering is disabled while search/type/date/amount filters are
							active.
						</p>
					)}

					{/* Ledger table */}
					{filtered.length === 0 ? (
						<EmptyState
							icon="📒"
							title="No entries"
							description="Add journal entries to see them here"
						/>
					) : (
						<div className="rounded-xl border border-border overflow-hidden">
							{/* Column header */}
							<div className="grid grid-cols-[1fr_auto_auto_auto_auto] border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
								<span>Entry</span>
								<span className="pr-3 w-24 text-right">
									{isGlobalJournal ? 'Head' : 'Account'}
								</span>
								<span className="text-right pr-3 w-20">Debit</span>
								<span className="text-right pr-3 w-20">Credit</span>
								<span className="text-right w-24">
									{isGlobalJournal ? 'Line' : 'Balance'}
								</span>
							</div>

							{/* Opening balance row */}
							{activeAccount && (
								<div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-3 py-2 bg-cyan/5 border-b border-border/50">
									<div className="flex items-center gap-2.5 min-w-0 pr-2">
										<div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-cyan/10 text-cyan">
											<SlidersHorizontal className="h-3 w-3" />
										</div>
										<p className="text-xs font-semibold text-cyan">
											Opening Balance
										</p>
									</div>
									<div className="w-24 text-right pr-3 self-center">
										<span className="text-[10px] text-muted-foreground truncate block">
											{activeAccount.name}
										</span>
									</div>
									<div className="w-20 text-right pr-3 self-center">
										<span className="text-muted-foreground/30 text-xs">—</span>
									</div>
									<div className="w-20 text-right pr-3 self-center">
										<span className="text-muted-foreground/30 text-xs">—</span>
									</div>
									<div className="w-24 text-right self-center">
										<span
											className={`font-mono text-xs font-bold ${
												openingSeed >= 0 ? 'text-cyan' : 'text-loss'
											}`}>
											{fmt(openingSeed)}
										</span>
									</div>
								</div>
							)}

							{byDate.map(([date, dayRows]) => {
								const dayDelta = dayRows.reduce(
									(s, r) => s + getSignedImpact(r, activeHead),
									0
								);
								const dayVolume = dayRows.reduce((s, r) => s + r.amount, 0);

								return (
									<div key={date}>
										{/* Day header */}
										<div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/50">
											<span className="text-xs font-bold text-muted-foreground">
												{fmtDateFull(date)}
											</span>
											<span
												className={`font-mono text-[10px] font-bold ${
													isGlobalJournal
														? 'text-muted-foreground'
														: dayDelta >= 0
															? 'text-profit'
															: 'text-loss'
												}`}>
												{isGlobalJournal
													? `${fmt(dayVolume)} vol`
													: `${dayDelta >= 0 ? '+' : ''}${fmt(Math.abs(dayDelta))}`}
											</span>
										</div>

										{dayRows.map((row) => {
											const meta = TYPE_META[row.type];
											const Icon = meta.icon;
											const side = getDisplaySide(row, activeHead);
											const isDebit = side === 'debit';
											const isCredit = side === 'credit';
											const isOpen = expanded === row.id;
											const counterHead =
												row.debitAccountHeadId === activeHead
													? headName(row.creditAccountHeadId)
													: row.creditAccountHeadId === activeHead
														? headName(row.debitAccountHeadId)
														: '—';

											return (
												<div
													key={row.id}
													draggable={canReorderRows && !isReordering}
													onDragStart={() => beginDrag(row.id)}
													onDragEnd={endDrag}
													onDragOver={(e) => {
														if (
															!canReorderRows ||
															!draggedId ||
															draggedId === row.id
														)
															return;
														e.preventDefault();
														setDropTargetId(row.id);
													}}
													onDragLeave={() => {
														if (dropTargetId === row.id)
															setDropTargetId(null);
													}}
													onDrop={(e) => {
														e.preventDefault();
														void dropOnRow(row.id);
													}}
													className={
														dropTargetId === row.id
															? 'ring-1 ring-primary/60 ring-inset'
															: undefined
													}>
													{isGlobalJournal ? (
														<button
															onClick={() =>
																setExpanded(isOpen ? null : row.id)
															}
															className="w-full text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
															<div className="px-3 py-2 border-b border-border/20">
																<div className="flex items-start gap-2.5 min-w-0">
																	<span className="mt-1 shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing">
																		<GripVertical className="h-3.5 w-3.5" />
																	</span>
																	<div
																		className={`mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 ${meta.color}`}>
																		<Icon className="h-3 w-3" />
																	</div>
																	<div className="min-w-0">
																		<p className="text-xs font-semibold truncate">
																			{row.description}
																		</p>
																		<p className="text-[10px] text-muted-foreground mt-0.5">
																			{meta.label}
																		</p>
																	</div>
																</div>
															</div>
															<div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-3 py-2">
																<div className="text-xs font-semibold text-foreground">
																	Debit
																</div>
																<div className="w-24 text-right pr-3">
																	<span className="text-[10px] text-muted-foreground truncate block">
																		{headName(
																			row.debitAccountHeadId
																		)}
																	</span>
																</div>
																<div className="w-20 text-right pr-3">
																	<span className="font-mono text-xs font-semibold text-loss">
																		{fmt(row.amount)}
																	</span>
																</div>
																<div className="w-20 text-right pr-3">
																	<span className="text-muted-foreground/30 text-xs">
																		—
																	</span>
																</div>
																<div className="w-24 text-right">
																	<span className="text-[10px] font-semibold text-muted-foreground">
																		Dr
																	</span>
																</div>
															</div>
															<div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-3 py-2 bg-muted/10">
																<div className="text-xs font-semibold text-foreground">
																	Credit
																</div>
																<div className="w-24 text-right pr-3">
																	<span className="text-[10px] text-muted-foreground truncate block">
																		{headName(
																			row.creditAccountHeadId
																		)}
																	</span>
																</div>
																<div className="w-20 text-right pr-3">
																	<span className="text-muted-foreground/30 text-xs">
																		—
																	</span>
																</div>
																<div className="w-20 text-right pr-3">
																	<span className="font-mono text-xs font-semibold text-profit">
																		{fmt(row.amount)}
																	</span>
																</div>
																<div className="w-24 text-right">
																	<span className="text-[10px] font-semibold text-muted-foreground">
																		Cr
																	</span>
																</div>
															</div>
														</button>
													) : (
														<button
															onClick={() =>
																setExpanded(isOpen ? null : row.id)
															}
															className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] px-3 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
															<div className="flex items-start gap-2.5 min-w-0 pr-2">
																<span className="mt-1 shrink-0 text-muted-foreground/60 cursor-grab active:cursor-grabbing">
																	<GripVertical className="h-3.5 w-3.5" />
																</span>
																<div
																	className={`mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 ${meta.color}`}>
																	<Icon className="h-3 w-3" />
																</div>
																<div className="min-w-0">
																	<p className="text-xs font-semibold truncate">
																		{row.description}
																	</p>
																	<p className="text-[10px] text-muted-foreground mt-0.5 truncate">
																		Dr:{' '}
																		{headName(
																			row.debitAccountHeadId
																		)}{' '}
																		· Cr:{' '}
																		{headName(
																			row.creditAccountHeadId
																		)}
																	</p>
																</div>
															</div>
															<div className="w-24 text-right pr-3">
																<span className="text-[10px] text-muted-foreground truncate block">
																	{counterHead}
																</span>
															</div>
															<div className="w-20 text-right pr-3">
																{isDebit ? (
																	<span className="font-mono text-xs font-semibold text-loss">
																		{fmt(row.amount)}
																	</span>
																) : (
																	<span className="text-muted-foreground/30 text-xs">
																		—
																	</span>
																)}
															</div>
															<div className="w-20 text-right pr-3">
																{isCredit ? (
																	<span className="font-mono text-xs font-semibold text-profit">
																		{fmt(row.amount)}
																	</span>
																) : (
																	<span className="text-muted-foreground/30 text-xs">
																		—
																	</span>
																)}
															</div>
															<div className="w-24 text-right">
																<span
																	className={`font-mono text-xs font-bold ${row.running >= 0 ? 'text-foreground' : 'text-loss'}`}>
																	{fmt(row.running)}
																</span>
															</div>
														</button>
													)}

													{isOpen && (
														<div className="px-12 py-2 bg-muted/20 border-b border-border/30 text-xs text-muted-foreground space-y-1">
															<div className="flex justify-end gap-2">
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => startEdit(row)}
																	className="h-7 gap-1.5">
																	<Pencil className="h-3 w-3" />{' '}
																	Edit entry
																</Button>
																<Button
																	variant="destructive"
																	size="sm"
																	onClick={() =>
																		void handleDelete(row)
																	}
																	className="h-7 gap-1.5">
																	<Trash2 className="h-3 w-3" />{' '}
																	Delete entry
																</Button>
															</div>
															<p>
																<span className="font-semibold text-foreground">
																	Type:
																</span>{' '}
																{meta.label}
															</p>
															<p>
																<span className="font-semibold text-foreground">
																	Amount:
																</span>{' '}
																{fmt(row.amount)}
															</p>
															<p>
																<span className="font-semibold text-foreground">
																	Dr:
																</span>{' '}
																{headName(row.debitAccountHeadId)}
															</p>
															<p>
																<span className="font-semibold text-foreground">
																	Cr:
																</span>{' '}
																{headName(row.creditAccountHeadId)}
															</p>
															{row.notes && (
																<p>
																	<span className="font-semibold text-foreground">
																		Notes:
																	</span>{' '}
																	{row.notes}
																</p>
															)}
															{(row.tags ?? []).length > 0 && (
																<div className="flex gap-1 flex-wrap">
																	{row.tags!.map((t) => (
																		<Badge
																			key={t}
																			variant="muted"
																			className="text-[9px]">
																			{t}
																		</Badge>
																	))}
																</div>
															)}
														</div>
													)}
												</div>
											);
										})}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
			{FormPage}
		</>
	);
}
