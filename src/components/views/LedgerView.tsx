import { useState, useMemo } from 'react';
import { Search, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Landmark, Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDateFull } from '@/utils/format';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';

// ─────────────────────────────────────────────────────────────────────────────
//  Unified ledger entry
// ─────────────────────────────────────────────────────────────────────────────

type LedgerKind =
	| 'expense'
	| 'income'
	| 'transfer_out'
	| 'transfer_in'
	| 'emi'
	| 'lent'
	| 'repayment';

interface LedgerRow {
	id: string;
	date: string;
	label: string;
	sublabel: string;
	amount: number; // positive = money in, negative = money out (from perspective of net worth / account)
	account: string; // account name
	accountColor: string;
	debit: number; // double-entry debit (positive value, money leaving account)
	credit: number; // double-entry credit (positive value, money entering account)
	kind: LedgerKind;
	category?: string;
	notes?: string;
}

const KIND_META: Record<
	LedgerKind,
	{ icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
	expense: { icon: ArrowUpRight, color: 'text-loss', label: 'Expense' },
	income: { icon: ArrowDownLeft, color: 'text-profit', label: 'Income' },
	transfer_out: { icon: ArrowLeftRight, color: 'text-warning', label: 'Transfer Out' },
	transfer_in: { icon: ArrowLeftRight, color: 'text-profit', label: 'Transfer In' },
	emi: { icon: Landmark, color: 'text-loss', label: 'EMI' },
	lent: { icon: Users, color: 'text-warning', label: 'Money Lent' },
	repayment: { icon: Users, color: 'text-profit', label: 'Repayment' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Build ledger rows from state
// ─────────────────────────────────────────────────────────────────────────────

function useLedgerRows(): LedgerRow[] {
	const { state } = useApp();

	return useMemo(() => {
		const rows: LedgerRow[] = [];

		const acctName = (id?: string) =>
			state.accounts.find((a) => a.id === id)?.name ?? 'Unknown';
		const acctColor = (id?: string) =>
			state.accounts.find((a) => a.id === id)?.color ?? 'hsl(191 100% 47%)';

		// Expenses — money leaves the account
		state.expenses.forEach((e) =>
			rows.push({
				id: e.id,
				date: e.date,
				label: e.name,
				sublabel: e.category,
				amount: -e.amount,
				account: acctName(e.accountId),
				accountColor: acctColor(e.accountId),
				debit: e.amount,
				credit: 0,
				kind: 'expense',
				category: e.category,
				notes: e.notes,
			})
		);

		// Incomes — money enters the account
		state.incomes.forEach((i) =>
			rows.push({
				id: i.id,
				date: i.date,
				label: i.name,
				sublabel: i.category ?? 'Income',
				amount: i.amount,
				account: acctName(i.accountId),
				accountColor: acctColor(i.accountId),
				debit: 0,
				credit: i.amount,
				kind: 'income',
				category: i.category,
				notes: i.notes,
			})
		);

		// Transfers — two rows per transfer (out + in)
		state.transfers.forEach((t) => {
			const fromName = acctName(t.fromAccountId);
			const toName = acctName(t.toAccountId);
			rows.push({
				id: `${t.id}-out`,
				date: t.date,
				label: `Transfer to ${toName}`,
				sublabel: fromName,
				amount: -t.amount,
				account: fromName,
				accountColor: acctColor(t.fromAccountId),
				debit: t.amount,
				credit: 0,
				kind: 'transfer_out',
				notes: t.notes,
			});
			rows.push({
				id: `${t.id}-in`,
				date: t.date,
				label: `Transfer from ${fromName}`,
				sublabel: toName,
				amount: t.amount,
				account: toName,
				accountColor: acctColor(t.toAccountId),
				debit: 0,
				credit: t.amount,
				kind: 'transfer_in',
				notes: t.notes,
			});
		});

		// Receivables — money lent out
		state.receivables.forEach((r) =>
			rows.push({
				id: r.id,
				date: r.dateLent,
				label: `Lent to ${r.personName}`,
				sublabel: r.description ?? 'Receivable',
				amount: -r.amountLent,
				account: acctName(r.accountId),
				accountColor: acctColor(r.accountId),
				debit: r.amountLent,
				credit: 0,
				kind: 'lent',
			})
		);

		// Repayments — money received back
		state.repaymentRecords.forEach((rr) => {
			const recv = state.receivables.find((r) => r.id === rr.receivableId);
			const acctId = recv?.accountId;
			rows.push({
				id: rr.id,
				date: rr.date,
				label: `Repayment from ${recv?.personName ?? '?'}`,
				sublabel: 'Receivable',
				amount: rr.amount,
				account: acctName(acctId),
				accountColor: acctColor(acctId),
				debit: 0,
				credit: rr.amount,
				kind: 'repayment',
				notes: rr.notes,
			});
		});

		return rows.sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));
	}, [state]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Running balance calculation
// ─────────────────────────────────────────────────────────────────────────────

function withRunningBalance(rows: LedgerRow[]): (LedgerRow & { runningBalance: number })[] {
	// Start from current total balance and walk backwards
	// This way running balance = "balance at end of that day"
	let running = 0;
	// Walk forward to build totals then reverse
	const forward = [...rows].reverse();
	const result = forward.map((row) => {
		running += row.amount;
		return { ...row, runningBalance: running };
	});
	return result.reverse();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────────────────────────────────────

export function LedgerView() {
	const allRows = useLedgerRows();
	const [search, setSearch] = useState('');
	const [filterKind, setFilterKind] = useState<LedgerKind | 'all'>('all');
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const filtered = useMemo(() => {
		let rows = allRows;
		if (filterKind !== 'all') rows = rows.filter((r) => r.kind === filterKind);
		if (search.trim()) {
			const q = search.toLowerCase();
			rows = rows.filter(
				(r) =>
					r.label.toLowerCase().includes(q) ||
					r.sublabel.toLowerCase().includes(q) ||
					r.account.toLowerCase().includes(q) ||
					(r.category ?? '').toLowerCase().includes(q)
			);
		}
		return rows;
	}, [allRows, filterKind, search]);

	const withBalance = useMemo(() => withRunningBalance(filtered), [filtered]);

	// Totals
	const totalDebit = filtered.reduce((s, r) => s + r.debit, 0);
	const totalCredit = filtered.reduce((s, r) => s + r.credit, 0);
	const net = totalCredit - totalDebit;

	// Group by date
	const byDate = useMemo(() => {
		const map = new Map<string, typeof withBalance>();
		withBalance.forEach((row) => {
			const d = row.date;
			if (!map.has(d)) map.set(d, []);
			map.get(d)!.push(row);
		});
		return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
	}, [withBalance]);

	const kindFilters: Array<{ value: LedgerKind | 'all'; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'expense', label: 'Expenses' },
		{ value: 'income', label: 'Income' },
		{ value: 'transfer_out', label: 'Transfers' },
		{ value: 'emi', label: 'EMIs' },
		{ value: 'lent', label: 'Lent' },
		{ value: 'repayment', label: 'Repayments' },
	];

	return (
		<div className="flex flex-col gap-4">
			{/* Header */}
			<div>
				<h2 className="font-display text-xl font-bold">Account Book</h2>
				<p className="text-sm text-muted-foreground mt-0.5">
					{allRows.length} transactions · double-entry ledger
				</p>
			</div>

			{/* Totals bar */}
			{filtered.length > 0 && (
				<div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden border border-border">
					{[
						{ label: 'Total Debit', value: fmt(totalDebit), cls: 'text-loss' },
						{ label: 'Total Credit', value: fmt(totalCredit), cls: 'text-profit' },
						{
							label: 'Net',
							value: fmt(Math.abs(net)),
							cls: net >= 0 ? 'text-profit' : 'text-loss',
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

			{/* Search */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
				<Input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search transactions…"
					className="pl-8"
				/>
			</div>

			{/* Kind filter pills */}
			<div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
				{kindFilters.map((f) => (
					<button
						key={f.value}
						onClick={() => setFilterKind(f.value)}
						className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors
              ${
					filterKind === f.value
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border text-muted-foreground hover:border-primary/50'
				}`}>
						{f.label}
					</button>
				))}
			</div>

			{/* Ledger table */}
			{filtered.length === 0 ? (
				<EmptyState
					icon="📒"
					title="No transactions"
					description="Add expenses, incomes, or transfers to see them here"
				/>
			) : (
				<div className="rounded-xl border border-border overflow-hidden">
					{/* Column headers */}
					<div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 border-b border-border bg-muted/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
						<span>Transaction</span>
						<span className="text-right pr-3 w-24">Debit</span>
						<span className="text-right pr-3 w-24">Credit</span>
						<span className="text-right w-24">Balance</span>
					</div>

					{byDate.map(([date, dayRows]) => (
						<div key={date}>
							{/* Day header */}
							<div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/50">
								<span className="text-xs font-bold text-muted-foreground">
									{fmtDateFull(date)}
								</span>
								<span
									className={`font-mono text-[10px] font-bold ${
										dayRows.reduce((s, r) => s + r.amount, 0) >= 0
											? 'text-profit'
											: 'text-loss'
									}`}>
									{dayRows.reduce((s, r) => s + r.amount, 0) >= 0 ? '+' : ''}
									{fmt(dayRows.reduce((s, r) => s + r.amount, 0))}
								</span>
							</div>

							{/* Rows for this day */}
							{dayRows.map((row, idx) => {
								const meta = KIND_META[row.kind];
								const Icon = meta.icon;
								const isExpanded = expandedId === row.id;

								return (
									<div key={row.id}>
										<button
											onClick={() =>
												setExpandedId(isExpanded ? null : row.id)
											}
											className="w-full grid grid-cols-[1fr_auto_auto_auto] gap-0 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
											{/* Description */}
											<div className="flex items-start gap-2.5 min-w-0 pr-2">
												<div
													className={`mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 ${meta.color}`}>
													<Icon className="h-3 w-3" />
												</div>
												<div className="min-w-0">
													<p className="text-xs font-semibold truncate">
														{row.label}
													</p>
													<div className="flex items-center gap-1.5 mt-0.5">
														<span
															className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
															style={{ background: row.accountColor }}
														/>
														<span className="text-[10px] text-muted-foreground truncate">
															{row.account}
														</span>
														{row.category && (
															<Badge
																variant="muted"
																className="text-[9px] px-1 py-0">
																{row.category}
															</Badge>
														)}
													</div>
												</div>
											</div>

											{/* Debit */}
											<div className="w-24 text-right pr-3">
												{row.debit > 0 ? (
													<span className="font-mono text-xs font-semibold text-loss">
														{fmt(row.debit)}
													</span>
												) : (
													<span className="text-muted-foreground/30 text-xs">
														—
													</span>
												)}
											</div>

											{/* Credit */}
											<div className="w-24 text-right pr-3">
												{row.credit > 0 ? (
													<span className="font-mono text-xs font-semibold text-profit">
														{fmt(row.credit)}
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
													className={`font-mono text-xs font-bold ${row.runningBalance >= 0 ? 'text-foreground' : 'text-loss'}`}>
													{fmt(row.runningBalance)}
												</span>
											</div>
										</button>

										{/* Expanded notes */}
										{isExpanded && (
											<div className="px-12 py-2 bg-muted/20 border-b border-border/30 text-xs text-muted-foreground space-y-1">
												<p>
													<span className="font-semibold text-foreground">
														Date:
													</span>{' '}
													{fmtDateFull(row.date)}
												</p>
												<p>
													<span className="font-semibold text-foreground">
														Type:
													</span>{' '}
													{meta.label}
												</p>
												<p>
													<span className="font-semibold text-foreground">
														Account:
													</span>{' '}
													{row.account}
												</p>
												{row.notes && (
													<p>
														<span className="font-semibold text-foreground">
															Notes:
														</span>{' '}
														{row.notes}
													</p>
												)}
												<p>
													<span className="font-semibold text-foreground">
														Entry:
													</span>{' '}
													{row.debit > 0 ? (
														<span className="text-loss">
															Dr {fmt(row.debit)}
														</span>
													) : (
														<span className="text-profit">
															Cr {fmt(row.credit)}
														</span>
													)}
												</p>
											</div>
										)}
									</div>
								);
							})}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
