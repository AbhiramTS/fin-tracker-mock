// ─────────────────────────────────────────────────────────────────────────────
//  ImportReviewView.tsx
//  Shows parsed import data for review and editing before committing to the DB.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
	ArrowLeft,
	CheckCircle2,
	Pencil,
	Trash2,
	AlertTriangle,
	ArrowUpRight,
	ArrowDownLeft,
	ArrowLeftRight,
	SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import {
	getPendingImport,
	savePendingImportDraft,
	markImportSessionCompleted,
	type PendingImport,
} from '@/utils/importStore';
import { makeTxReviewRecords } from '@/utils/importEngine';
import { fmt, fmtDate } from '@/utils/format';
import type { JournalEntry, JournalEntryType, Account, Loan, EntityName } from '@/types';

// ── Type display meta ─────────────────────────────────────────────────────────
const TYPE_META: Record<
	JournalEntryType,
	{ icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
	expense: { icon: ArrowUpRight, color: 'text-loss', label: 'Expense' },
	income: { icon: ArrowDownLeft, color: 'text-profit', label: 'Income' },
	transfer: { icon: ArrowLeftRight, color: 'text-warning', label: 'Transfer' },
	emi: { icon: ArrowUpRight, color: 'text-loss', label: 'EMI' },
	credit_card_payment: { icon: ArrowUpRight, color: 'text-loss', label: 'CC Payment' },
	loan_disbursal: { icon: ArrowDownLeft, color: 'text-cyan', label: 'Loan Disbursal' },
	loan_payoff: { icon: ArrowUpRight, color: 'text-loss', label: 'Loan Payoff' },
	lending_disbursal: { icon: ArrowUpRight, color: 'text-warning', label: 'Lending' },
	lending_repayment: { icon: ArrowDownLeft, color: 'text-profit', label: 'Repayment' },
	borrowing_disbursal: { icon: ArrowDownLeft, color: 'text-warning', label: 'Borrowing' },
	borrowing_repayment: { icon: ArrowUpRight, color: 'text-loss', label: 'Borrowing Repayment' },
	adjustment: { icon: SlidersHorizontal, color: 'text-muted-foreground', label: 'Adjustment' },
	opening_balance: {
		icon: SlidersHorizontal,
		color: 'text-cyan',
		label: 'Opening Balance',
	},
};

const TYPE_OPTIONS: { value: JournalEntryType; label: string }[] = [
	{ value: 'expense', label: 'Expense' },
	{ value: 'income', label: 'Income' },
	{ value: 'transfer', label: 'Transfer' },
	{ value: 'emi', label: 'EMI' },
	{ value: 'credit_card_payment', label: 'CC Bill Payment' },
	{ value: 'loan_disbursal', label: 'Loan Disbursal' },
	{ value: 'loan_payoff', label: 'Loan Payoff' },
	{ value: 'lending_disbursal', label: 'Lending Disbursal' },
	{ value: 'lending_repayment', label: 'Lending Repayment' },
	{ value: 'adjustment', label: 'Adjustment' },
	{ value: 'opening_balance', label: 'Opening Balance' },
];

type SaveStep = 'idle' | 'saving' | 'done';

// ── Edit draft state ──────────────────────────────────────────────────────────
interface EditDraft {
	id: string;
	draft: Partial<JournalEntry>;
}

// ── Combined account / head option ───────────────────────────────────────────
interface HeadOption {
	id: string;
	label: string;
	group: 'import' | 'existing' | 'head';
}
// ─────────────────────────────────────────────────────────────────────────────
export function ImportReviewView() {
	const { state, save } = useApp();
	const [pending, setPending] = useState<PendingImport | null | undefined>(undefined);

	useEffect(() => {
		let alive = true;
		void (async () => {
			const loaded = await getPendingImport();
			if (!alive) return;
			setPending(loaded);
			if (!loaded) return;

			setEntries(loaded.draft?.entries ?? loaded.plan.cleanJournalEntries ?? []);
			setAccounts(loaded.plan.cleanAccounts ?? []);
			setLoans(loaded.plan.cleanLoans ?? []);
			setTxDuplicates(loaded.plan.txDuplicates ?? []);
			setSessionId(loaded.sessionId ?? loaded.plan.sessionId ?? '');
			setPlanErrors(loaded.plan.errors ?? []);
			setMergeMap(loaded.mergeMap ?? {});
			setAccountRemap(loaded.draft?.accountRemap ?? {});
		})();
		return () => {
			alive = false;
		};
	}, []);

	// Local editable copies — loaded from persistent import session
	const [entries, setEntries] = useState<Partial<JournalEntry>[]>([]);
	const [accounts, setAccounts] = useState<Partial<Account>[]>([]);
	const [loans, setLoans] = useState<Partial<Loan>[]>([]);
	const [txDuplicates, setTxDuplicates] = useState<PendingImport['plan']['txDuplicates']>([]);
	const [sessionId, setSessionId] = useState('');
	const [planErrors, setPlanErrors] = useState<string[]>([]);
	const [mergeMap, setMergeMap] = useState<Record<string, Record<string, unknown>>>({});

	const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
	// accountRemap: importAccountId → existingAccountId (user-selected "link to existing")
	const [accountRemap, setAccountRemap] = useState<Record<string, string>>({});
	const [saveStep, setSaveStep] = useState<SaveStep>('idle');
	const [importResult, setImportResult] = useState<{
		ok: number;
		err: number;
		reviews: number;
		skipped: number;
	} | null>(null);
	const [importError, setImportError] = useState('');

	// ── Resolve account/head ID → display name ────────────────────────────────
	const resolveHeadName = useCallback(
		(headId: string): string => {
			if (!headId) return '—';
			// Check remap first
			const remappedId = accountRemap[headId];
			const lookupId = remappedId ?? headId;
			const inPlan = accounts.find((a) => a.id === lookupId);
			if (inPlan?.name) return (remappedId ? '→ ' : '') + inPlan.name;
			const inAccounts = state.accounts.find((a) => a.id === lookupId);
			if (inAccounts) return (remappedId ? '→ ' : '') + inAccounts.name;
			const inHeads = state.accountHeads.find((h) => h.id === lookupId);
			if (inHeads) return (remappedId ? '→ ' : '') + inHeads.name;
			return lookupId;
		},
		[accounts, accountRemap, state.accounts, state.accountHeads]
	);

	// ── Combined head options for selects ─────────────────────────────────────
	const headOptions = useMemo<HeadOption[]>(() => {
		const opts: HeadOption[] = [];
		for (const acc of accounts) {
			if (acc.id && acc.name && !accountRemap[acc.id]) {
				opts.push({ id: acc.id, label: `[New] ${acc.name}`, group: 'import' });
			}
		}
		for (const acc of state.accounts) {
			opts.push({ id: acc.id, label: acc.name, group: 'existing' });
		}
		for (const head of state.accountHeads) {
			opts.push({ id: head.id, label: head.name, group: 'head' });
		}
		return opts;
	}, [accounts, accountRemap, state.accounts, state.accountHeads]);
	// ── Entries sorted by date ────────────────────────────────────────────────
	const sortedEntries = useMemo(
		() => [...entries].sort((a, b) => ((a.date ?? '') < (b.date ?? '') ? -1 : 1)),
		[entries]
	);

	// Persist review edits so the session can be resumed later.
	useEffect(() => {
		if (!pending || !sessionId || saveStep !== 'idle') return;
		const timer = setTimeout(() => {
			void savePendingImportDraft(sessionId, { entries, accountRemap });
		}, 250);
		return () => clearTimeout(timer);
	}, [pending, sessionId, saveStep, entries, accountRemap]);

	// ── Handlers ──────────────────────────────────────────────────────────────
	const handleCancelImport = () => {
		window.location.hash = '/import';
	};

	// ── Account remapping ─────────────────────────────────────────────────────
	const handleRemap = (importId: string, existingId: string | null) => {
		setAccountRemap((prev) => {
			const next = { ...prev };
			if (existingId) {
				next[importId] = existingId;
			} else {
				delete next[importId];
			}
			return next;
		});
	};
	const handleRemoveEntry = (id: string) => {
		setEntries((prev) => prev.filter((e) => e.id !== id));
	};

	const handleStartEdit = (id: string) => {
		const entry = entries.find((e) => e.id === id);
		if (entry) setEditDraft({ id, draft: { ...entry } });
	};

	const handleSaveEdit = () => {
		if (!editDraft) return;
		setEntries((prev) => prev.map((e) => (e.id === editDraft.id ? editDraft.draft : e)));
		setEditDraft(null);
	};

	const handleConfirmImport = useCallback(async () => {
		setSaveStep('saving');
		setImportError('');
		let ok = 0,
			err = 0;
		try {
			// 1. Apply merges (update existing accounts/loans)
			for (const [existingId, incoming] of Object.entries(mergeMap)) {
				try {
					await save((incoming._entity as EntityName) ?? 'accounts', {
						...incoming,
						id: existingId,
					} as Record<string, unknown>);
					ok++;
				} catch {
					err++;
				}
			}

			// 2. Save new accounts
			for (const acc of accounts) {
				// Skip accounts that have been remapped to an existing account
				if (acc.id && accountRemap[acc.id]) continue;
				try {
					await save('accounts', acc as Record<string, unknown>);
					ok++;
				} catch {
					err++;
				}
			}

			// 3. Save new loans
			for (const loan of loans) {
				try {
					await save('loans', loan as Record<string, unknown>);
					ok++;
				} catch {
					err++;
				}
			}

			// 4. Save (possibly edited) journal entries
			for (const entry of entries) {
				// Apply account remaps to debit/credit fields before saving
				const finalEntry = {
					...entry,
					debitAccountHeadId:
						accountRemap[entry.debitAccountHeadId ?? ''] ?? entry.debitAccountHeadId,
					creditAccountHeadId:
						accountRemap[entry.creditAccountHeadId ?? ''] ?? entry.creditAccountHeadId,
				};
				try {
					await save('journalEntries', finalEntry as Record<string, unknown>);
					ok++;
				} catch {
					err++;
				}
			}

			// 5. Save tx duplicate reviews for later resolution
			const reviews = makeTxReviewRecords(txDuplicates, sessionId);
			for (const r of reviews) {
				try {
					await save('importReviews', r as unknown as Record<string, unknown>);
				} catch {
					/* non-critical */
				}
			}

			if (sessionId) await markImportSessionCompleted(sessionId);
			setImportResult({ ok, err, reviews: reviews.length, skipped: planErrors.length });
			setSaveStep('done');
		} catch (e) {
			setImportError((e as Error).message || 'Import failed.');
			setSaveStep('idle');
		}
	}, [
		mergeMap,
		accounts,
		loans,
		entries,
		accountRemap,
		txDuplicates,
		sessionId,
		planErrors,
		save,
	]);

	// ── No pending import guard ───────────────────────────────────────────────
	if (pending === undefined) {
		return (
			<div className="flex flex-col gap-6">
				<h2 className="font-display text-xl font-bold">Import Review</h2>
				<p className="text-sm text-muted-foreground">Loading pending import session...</p>
			</div>
		);
	}

	if (!pending) {
		return (
			<div className="flex flex-col gap-6">
				<h2 className="font-display text-xl font-bold">Import Review</h2>
				<EmptyState
					icon="📂"
					title="No import pending"
					description="Go to Import Data and resume or start a new import session."
					action={
						<Button
							variant="outline"
							onClick={() => {
								window.location.hash = '/import';
							}}>
							Go to Import
						</Button>
					}
				/>
			</div>
		);
	}

	// ── Done screen ───────────────────────────────────────────────────────────
	if (saveStep === 'done' && importResult) {
		return (
			<div className="flex flex-col gap-6">
				<h2 className="font-display text-xl font-bold">Import Complete</h2>
				<div className="rounded-xl border border-profit/30 bg-profit/10 p-5 flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="h-5 w-5 text-profit" />
						<p className="font-semibold text-profit">Import successful</p>
					</div>
					<p className="text-sm text-foreground">
						{importResult.ok} record{importResult.ok !== 1 ? 's' : ''} saved.
						{importResult.err > 0 && (
							<span className="text-warning"> {importResult.err} failed.</span>
						)}
					</p>
					{importResult.skipped > 0 && (
						<p className="text-xs text-warning">
							{importResult.skipped} item
							{importResult.skipped !== 1 ? 's were' : ' was'} skipped due to
							missing/invalid references.
						</p>
					)}
					{importResult.reviews > 0 && (
						<p className="text-xs text-warning">
							{importResult.reviews} duplicate transaction
							{importResult.reviews !== 1 ? 's' : ''} need review — see Settings →
							Dups.
						</p>
					)}
				</div>
				<div className="flex flex-col gap-2">
					<Button
						onClick={() => {
							window.location.hash = '/journalledger';
						}}
						className="w-full">
						View Journal Ledger
					</Button>
					<Button
						variant="outline"
						onClick={() => {
							window.location.hash = '/import';
						}}
						className="w-full">
						Import Another File
					</Button>
				</div>
			</div>
		);
	}

	// ── Main review view ──────────────────────────────────────────────────────
	const totalRecords = entries.length + accounts.length + loans.length;

	return (
		<div className="flex flex-col gap-6 pb-32">
			{/* Header */}
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="font-display text-xl font-bold">Review Import</h2>
					<p className="text-sm text-muted-foreground mt-0.5">
						Edit entries as needed, then confirm to save to the database.
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={handleCancelImport}
					className="shrink-0">
					<ArrowLeft className="h-3.5 w-3.5 mr-1" />
					Cancel
				</Button>
			</div>

			{/* Summary stats */}
			<div className="grid grid-cols-3 gap-3">
				<div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
					<p className="text-2xl font-bold font-mono">{entries.length}</p>
					<p className="text-xs text-muted-foreground">Transactions</p>
				</div>
				<div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
					<p className="text-2xl font-bold font-mono">{accounts.length}</p>
					<p className="text-xs text-muted-foreground">Accounts</p>
				</div>
				<div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
					<p className="text-2xl font-bold font-mono">{loans.length}</p>
					<p className="text-xs text-muted-foreground">Loans</p>
				</div>
			</div>

			{/* Import engine warnings */}
			{planErrors.length > 0 && (
				<div className="rounded-xl border border-warning/30 bg-warning/10 p-3 flex flex-col gap-1">
					<p className="text-xs font-semibold text-warning flex items-center gap-1.5">
						<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
						{planErrors.length} warning
						{planErrors.length !== 1 ? 's' : ''} from import engine
					</p>
					{planErrors.map((msg, i) => (
						<p
							key={i}
							className="text-xs text-muted-foreground pl-5">
							{msg}
						</p>
					))}
				</div>
			)}

			{/* Save error */}
			{importError && (
				<div className="flex items-center gap-2 text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
					<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
					{importError}
				</div>
			)}

			{/* ── Journal Entries ────────────────────────────────────────────────── */}
			<section>
				<h3 className="font-semibold text-sm mb-3">
					Journal Entries
					<span className="text-muted-foreground font-normal ml-2">
						({entries.length})
					</span>
				</h3>
				{entries.length === 0 ? (
					<p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
						No journal entries in this import.
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{sortedEntries.map((entry) => {
							const meta = TYPE_META[entry.type ?? 'expense'];
							const Icon = meta.icon;
							return (
								<Card
									key={entry.id}
									className="overflow-hidden">
									<CardContent className="p-0">
										<div className="flex items-start gap-3 p-3">
											<div className="mt-0.5 shrink-0">
												<Icon className={`h-4 w-4 ${meta.color}`} />
											</div>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 flex-wrap">
													<span
														className={`text-xs font-medium ${meta.color}`}>
														{meta.label}
													</span>
													<Badge
														variant="outline"
														className="text-[10px] font-mono">
														{fmtDate(entry.date ?? '')}
													</Badge>
													{entry.tags && entry.tags.length > 0 && (
														<Badge
															variant="outline"
															className="text-[10px]">
															{entry.tags[0]}
														</Badge>
													)}
												</div>
												<p className="text-sm font-semibold mt-0.5 truncate">
													{entry.description}
												</p>
												<p className="text-xs text-muted-foreground mt-0.5">
													Dr:{' '}
													<span className="text-foreground">
														{resolveHeadName(
															entry.debitAccountHeadId ?? ''
														)}
													</span>
													{' → '}
													Cr:{' '}
													<span className="text-foreground">
														{resolveHeadName(
															entry.creditAccountHeadId ?? ''
														)}
													</span>
												</p>
												{entry.notes && (
													<p className="text-xs text-muted-foreground italic mt-0.5">
														{entry.notes}
													</p>
												)}
											</div>
											<div className="flex flex-col items-end gap-1.5 shrink-0">
												<span className="text-sm font-bold font-mono">
													{fmt(entry.amount ?? 0)}
												</span>
												<div className="flex gap-1">
													<button
														onClick={() => handleStartEdit(entry.id!)}
														className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
														title="Edit entry">
														<Pencil className="h-3.5 w-3.5" />
													</button>
													<button
														onClick={() => handleRemoveEntry(entry.id!)}
														className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
														title="Remove entry">
														<Trash2 className="h-3.5 w-3.5" />
													</button>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				)}
			</section>

			{/* ── New Accounts ──────────────────────────────────────────────────── */}
			{accounts.length > 0 && (
				<section>
					<h3 className="font-semibold text-sm mb-3">
						New Accounts
						<span className="text-muted-foreground font-normal ml-2">
							({accounts.length})
						</span>
					</h3>
					<div className="flex flex-col gap-2">
						{accounts.map((acc, idx) => (
							<Card key={acc.id ?? idx}>
								<CardContent className="px-3 py-3">
									<div className="flex items-center gap-2 justify-between">
										<div className="flex items-center gap-2 min-w-0">
											<span
												className="inline-block h-3 w-3 rounded-full shrink-0"
												style={{ background: acc.color ?? '#00d4f5' }}
											/>
											<span className="text-sm font-semibold truncate">
												{acc.name}
											</span>
											<Badge
												variant="outline"
												className="text-[10px] capitalize shrink-0">
												{acc.type}
											</Badge>
										</div>
										<span className="text-sm font-mono font-bold shrink-0">
											{fmt(acc.openingBalance ?? 0)}
										</span>
									</div>
									{acc.notes && (
										<p className="text-xs text-muted-foreground mt-1 pl-5">
											{acc.notes}
										</p>
									)}
								</CardContent>
							</Card>
						))}
					</div>
					{/* per-account "link to existing" remaps */}
					{accounts.map((acc, idx) => {
						if (!acc.id) return null;
						const remappedId = accountRemap[acc.id];
						const remappedName = remappedId
							? (state.accounts.find((a) => a.id === remappedId)?.name ?? remappedId)
							: null;
						return (
							<div
								key={acc.id ?? idx}
								className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs">
								<span className="text-muted-foreground min-w-0 truncate flex-1">
									<span className="font-medium text-foreground">{acc.name}</span>
								</span>
								<span className="text-muted-foreground shrink-0">link to</span>
								<Select
									value={remappedId ?? '__new__'}
									onValueChange={(v) =>
										handleRemap(acc.id!, v === '__new__' ? null : v)
									}>
									<SelectTrigger className="h-7 text-xs w-44 shrink-0">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="__new__">
											<span className="text-profit font-medium">
												＋ Create new
											</span>
										</SelectItem>
										{state.accounts.map((ea) => (
											<SelectItem
												key={ea.id}
												value={ea.id}>
												{ea.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{remappedName && (
									<Badge
										variant="outline"
										className="text-[10px] shrink-0 text-warning">
										linked
									</Badge>
								)}
							</div>
						);
					})}
					{/* remove the old closing </div> duplicate */}
				</section>
			)}

			{/* ── Loans ─────────────────────────────────────────────────────────── */}
			{loans.length > 0 && (
				<section>
					<h3 className="font-semibold text-sm mb-3">
						Loans
						<span className="text-muted-foreground font-normal ml-2">
							({loans.length})
						</span>
					</h3>
					<div className="flex flex-col gap-2">
						{loans.map((loan, idx) => (
							<Card key={loan.id ?? idx}>
								<CardContent className="px-3 py-3">
									<div className="flex items-center justify-between">
										<p className="text-sm font-semibold">{loan.name}</p>
										<span className="text-sm font-mono font-bold">
											{fmt(loan.principalAmount ?? 0)}
										</span>
									</div>
									<p className="text-xs text-muted-foreground mt-0.5">
										{loan.interestRate}% interest · {loan.tenureMonths} months ·
										EMI {fmt(loan.emi ?? 0)}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				</section>
			)}

			{/* ── Sticky confirm bar ────────────────────────────────────────────── */}
			<div className="fixed bottom-nav-safe md:bottom-0 left-0 right-0 md:left-60 bg-background border-t border-border p-4 z-20">
				<div className="w-full">
					<Button
						className="w-full"
						disabled={saveStep === 'saving' || totalRecords === 0}
						onClick={handleConfirmImport}>
						<CheckCircle2 className="h-4 w-4 mr-2" />
						{saveStep === 'saving'
							? 'Importing…'
							: `Confirm Import — ${totalRecords} record${totalRecords !== 1 ? 's' : ''}`}
					</Button>
				</div>
			</div>

			{/* ── Edit Entry Dialog ─────────────────────────────────────────────── */}
			{editDraft && (
				<Dialog
					open
					onOpenChange={(o) => !o && setEditDraft(null)}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Edit Journal Entry</DialogTitle>
						</DialogHeader>
						<div className="flex flex-col gap-4 px-5 pb-5 pt-2">
							<FormField label="Date *">
								<Input
									type="date"
									value={editDraft.draft.date ?? ''}
									onChange={(e) =>
										setEditDraft((prev) =>
											prev
												? {
														...prev,
														draft: {
															...prev.draft,
															date: e.target.value,
														},
													}
												: null
										)
									}
								/>
							</FormField>
							<FormField label="Description *">
								<Input
									value={editDraft.draft.description ?? ''}
									onChange={(e) =>
										setEditDraft((prev) =>
											prev
												? {
														...prev,
														draft: {
															...prev.draft,
															description: e.target.value,
														},
													}
												: null
										)
									}
									placeholder="e.g. Salary — March"
								/>
							</FormField>
							<FormField label="Amount *">
								<Input
									type="number"
									min={0.01}
									step={0.01}
									value={editDraft.draft.amount ?? ''}
									onChange={(e) =>
										setEditDraft((prev) =>
											prev
												? {
														...prev,
														draft: {
															...prev.draft,
															amount: parseFloat(e.target.value) || 0,
														},
													}
												: null
										)
									}
								/>
							</FormField>
							<FormField label="Type">
								<Select
									value={editDraft.draft.type ?? 'expense'}
									onValueChange={(v) =>
										setEditDraft((prev) =>
											prev
												? {
														...prev,
														draft: {
															...prev.draft,
															type: v as JournalEntryType,
														},
													}
												: null
										)
									}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{TYPE_OPTIONS.map((o) => (
											<SelectItem
												key={o.value}
												value={o.value}>
												{o.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FormField>
							<FormField label="Notes">
								<Input
									value={editDraft.draft.notes ?? ''}
									onChange={(e) =>
										setEditDraft((prev) =>
											prev
												? {
														...prev,
														draft: {
															...prev.draft,
															notes: e.target.value,
														},
													}
												: null
										)
									}
									placeholder="Optional note"
								/>
							</FormField>
							<FormField label="Debit Account">
								<Select
									value={editDraft.draft.debitAccountHeadId ?? ''}
									onValueChange={(v) =>
										setEditDraft((prev) =>
											prev
												? {
														...prev,
														draft: {
															...prev.draft,
															debitAccountHeadId: v,
														},
													}
												: null
										)
									}>
									<SelectTrigger>
										<SelectValue placeholder="Select debit account…" />
									</SelectTrigger>
									<SelectContent>
										{headOptions.map((o) => (
											<SelectItem
												key={o.id}
												value={o.id}>
												{o.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FormField>
							<FormField label="Credit Account">
								<Select
									value={editDraft.draft.creditAccountHeadId ?? ''}
									onValueChange={(v) =>
										setEditDraft((prev) =>
											prev
												? {
														...prev,
														draft: {
															...prev.draft,
															creditAccountHeadId: v,
														},
													}
												: null
										)
									}>
									<SelectTrigger>
										<SelectValue placeholder="Select credit account…" />
									</SelectTrigger>
									<SelectContent>
										{headOptions.map((o) => (
											<SelectItem
												key={o.id}
												value={o.id}>
												{o.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FormField>
							<div className="flex gap-2 justify-end pt-1">
								<Button
									variant="outline"
									onClick={() => setEditDraft(null)}>
									Cancel
								</Button>
								<Button onClick={handleSaveEdit}>Save Changes</Button>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	);
}
