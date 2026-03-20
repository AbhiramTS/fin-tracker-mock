import { useState, useMemo } from 'react';
import {
	Search,
	ArrowUpRight,
	ArrowDownLeft,
	ArrowLeftRight,
	SlidersHorizontal,
	X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDateFull } from '@/utils/format';
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
	if (entry.type === 'expense' || entry.type === 'emi') return -entry.amount;
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
	const { state } = useApp();

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

	const headName = (id: string) => state.accountHeads.find((h) => h.id === id)?.name ?? id;
	const activeHead = filterAccountHeadId ?? (headFilter !== 'all' ? headFilter : undefined);
	const activeAccount = state.accounts.find((a) => a.id === activeHead);
	const openingSeed = activeAccount?.openingBalance ?? 0;

	// ── Filter entries ─────────────────────────────────────────────────────────
	const filtered = useMemo(() => {
		// Start with all entries, sort oldest → newest
		let rows = [...state.journalEntries].sort((a, b) => a.date.localeCompare(b.date));

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

	// Totals derived from the same signed-impact logic used by running/day balances.
	const { netIn, netOut } = useMemo(() => {
		return filtered.reduce(
			(acc, entry) => {
				const signed = getSignedImpact(entry, activeHead);
				if (signed > 0) acc.netIn += signed;
				else if (signed < 0) acc.netOut += Math.abs(signed);
				return acc;
			},
			{ netIn: 0, netOut: 0 }
		);
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

	// All non-system account heads for the head filter dropdown
	const filterableHeads = state.accountHeads.filter((h) => h.parentId !== null);

	return (
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
					{[
						{ label: 'Total In', value: fmt(netIn), cls: 'text-profit' },
						{ label: 'Total Out', value: fmt(netOut), cls: 'text-loss' },
						{
							label: 'Net',
							value: fmt(netIn - netOut),
							cls: netIn >= netOut ? 'text-profit' : 'text-loss',
						},
					].map(({ label, value, cls }, i) => (
						<div
							key={label}
							className={`flex flex-col items-center py-3 bg-muted/20 ${i < 2 ? 'border-r border-border' : ''}`}>
							<p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
								{label}
							</p>
							<p className={`font-mono text-xs font-bold mt-0.5 ${cls}`}>{value}</p>
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
								onValueChange={(v) => setTypeFilter(v as JournalEntryType | 'all')}>
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
											'adjustment',
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
						<span className="pr-3 w-24 text-right">Account</span>
						<span className="text-right pr-3 w-20">Debit</span>
						<span className="text-right pr-3 w-20">Credit</span>
						<span className="text-right w-24">Balance</span>
					</div>

					{/* Opening balance row */}
					{activeAccount && (
						<div className="grid grid-cols-[1fr_auto_auto_auto_auto] px-3 py-2 bg-cyan/5 border-b border-border/50">
							<div className="flex items-center gap-2.5 min-w-0 pr-2">
								<div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-cyan/10 text-cyan">
									<SlidersHorizontal className="h-3 w-3" />
								</div>
								<p className="text-xs font-semibold text-cyan">Opening Balance</p>
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

						return (
							<div key={date}>
								{/* Day header */}
								<div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/50">
									<span className="text-xs font-bold text-muted-foreground">
										{fmtDateFull(date)}
									</span>
									<span
										className={`font-mono text-[10px] font-bold ${
											dayDelta >= 0 ? 'text-profit' : 'text-loss'
										}`}>
										{dayDelta >= 0 ? '+' : ''}
										{fmt(Math.abs(dayDelta))}
									</span>
								</div>

								{dayRows.map((row) => {
									const meta = TYPE_META[row.type];
									const Icon = meta.icon;
									const side = getDisplaySide(row, activeHead);
									const isDebit = side === 'debit';
									const isCredit = side === 'credit';
									const isOpen = expanded === row.id;
									const counterHead = activeHead
										? row.debitAccountHeadId === activeHead
											? headName(row.creditAccountHeadId)
											: row.creditAccountHeadId === activeHead
												? headName(row.debitAccountHeadId)
												: '—'
										: headName(row.debitAccountHeadId);

									return (
										<div key={row.id}>
											<button
												onClick={() => setExpanded(isOpen ? null : row.id)}
												className="w-full grid grid-cols-[1fr_auto_auto_auto_auto] px-3 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
												<div className="flex items-start gap-2.5 min-w-0 pr-2">
													<div
														className={`mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 ${meta.color}`}>
														<Icon className="h-3 w-3" />
													</div>
													<div className="min-w-0">
														<p className="text-xs font-semibold truncate">
															{row.description}
														</p>
														<p className="text-[10px] text-muted-foreground mt-0.5 truncate">
															Dr: {headName(row.debitAccountHeadId)} ·
															Cr: {headName(row.creditAccountHeadId)}
														</p>
													</div>
												</div>{' '}
												{/* Account column */}
												<div className="w-24 text-right pr-3">
													<span className="text-[10px] text-muted-foreground truncate block">
														{counterHead}
													</span>
												</div>{' '}
												{/* Debit column */}
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
												{/* Credit column */}
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
												{/* Running balance */}
												<div className="w-24 text-right">
													<span
														className={`font-mono text-xs font-bold ${row.running >= 0 ? 'text-foreground' : 'text-loss'}`}>
														{fmt(row.running)}
													</span>
												</div>
											</button>

											{isOpen && (
												<div className="px-12 py-2 bg-muted/20 border-b border-border/30 text-xs text-muted-foreground space-y-1">
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
	);
}
