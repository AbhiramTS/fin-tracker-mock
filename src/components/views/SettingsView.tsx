import { useState, useEffect, useRef, useCallback } from 'react';
import {
	Download,
	Upload,
	AlertTriangle,
	CheckCircle2,
	GitMerge,
	Trash2,
	Plus,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { renderQR } from '@/qr/qrcode';
import { parseImportFile, makeTxReviewRecords } from '@/utils/importEngine';
import { fmt, fmtDate } from '@/utils/format';
import type { FirebaseConfig, EntityName, ImportReview, Account } from '@/types';

// ── QR canvas ─────────────────────────────────────────────────────────────────
function QRCanvas({ data, size = 220 }: { data: string; size?: number }) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		if (ref.current && data) renderQR(ref.current, data, size).catch(console.error);
	}, [data, size]);
	return (
		<canvas
			ref={ref}
			className="rounded-xl block"
		/>
	);
}

// ── Firebase config parser ────────────────────────────────────────────────────
function parseFirebaseConfig(raw: string): FirebaseConfig {
	let text = raw.trim();
	text = text
		.replace(/^(?:const|let|var)\s+\w+\s*=\s*/, '')
		.replace(/;?\s*$/, '')
		.trim();
	const s = text.indexOf('{'),
		e = text.lastIndexOf('}');
	if (s === -1 || e === -1) throw new Error('No object literal found');
	text = text.slice(s, e + 1);
	text = text.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
	text = text.replace(
		/'((?:[^'\\]|\\.)*)'/g,
		(_, i) => '"' + i.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'
	);
	text = text.replace(/,(\s*[}\]])/g, '$1');
	const parsed = JSON.parse(text) as Record<string, string>;
	if (!parsed.apiKey || !parsed.projectId) throw new Error('apiKey and projectId are required');
	return parsed as unknown as FirebaseConfig;
}

function FirebaseSetup({ onConnect }: { onConnect: (cfg: FirebaseConfig) => void }) {
	const [raw, setRaw] = useState('');
	const [cfg, setCfg] = useState<Partial<FirebaseConfig>>({
		apiKey: '',
		authDomain: '',
		projectId: '',
		appId: '',
	});
	const [err, setErr] = useState('');
	const [mode, setMode] = useState<'paste' | 'fields'>('paste');

	const connect = () => {
		try {
			const parsed = mode === 'paste' ? parseFirebaseConfig(raw) : (cfg as FirebaseConfig);
			if (!parsed.apiKey || !parsed.projectId) {
				setErr('apiKey and projectId required');
				return;
			}
			setErr('');
			onConnect(parsed);
		} catch (e) {
			setErr((e as Error).message);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<Tabs
				value={mode}
				onValueChange={(v) => setMode(v as 'paste' | 'fields')}>
				<TabsList className="w-full">
					<TabsTrigger
						value="paste"
						className="flex-1">
						Paste SDK snippet
					</TabsTrigger>
					<TabsTrigger
						value="fields"
						className="flex-1">
						Manual fields
					</TabsTrigger>
				</TabsList>
				<TabsContent value="paste">
					<Textarea
						value={raw}
						onChange={(e) => setRaw(e.target.value)}
						rows={7}
						className="font-mono text-xs"
						placeholder={
							'const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  projectId: "my-app",\n  ...\n};'
						}
					/>
				</TabsContent>
				<TabsContent value="fields">
					<div className="flex flex-col gap-2">
						<FormField label="API Key">
							<Input
								value={cfg.apiKey ?? ''}
								onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
							/>
						</FormField>
						<FormField label="Auth Domain">
							<Input
								value={cfg.authDomain ?? ''}
								onChange={(e) => setCfg({ ...cfg, authDomain: e.target.value })}
							/>
						</FormField>
						<FormField label="Project ID">
							<Input
								value={cfg.projectId ?? ''}
								onChange={(e) => setCfg({ ...cfg, projectId: e.target.value })}
							/>
						</FormField>
						<FormField label="App ID">
							<Input
								value={cfg.appId ?? ''}
								onChange={(e) => setCfg({ ...cfg, appId: e.target.value })}
							/>
						</FormField>
					</div>
				</TabsContent>
			</Tabs>
			{err && <p className="text-xs text-destructive">{err}</p>}
			<Button
				variant="firebase"
				onClick={connect}
				className="w-full">
				🔥 Connect Firebase
			</Button>
		</div>
	);
}

// ── Merge Accounts UI ─────────────────────────────────────────────────────────
// Shows all accounts; lets user pick pairs to merge (keep one, move txns, delete other).
function MergeAccountsSection() {
	const { state, save, remove } = useApp();
	const [keepId, setKeepId] = useState('');
	const [deleteId, setDeleteId] = useState('');
	const [merging, setMerging] = useState(false);
	const [done, setDone] = useState<string | null>(null);

	const canMerge = keepId && deleteId && keepId !== deleteId;

	const doMerge = async () => {
		if (!canMerge) return;
		setMerging(true);
		try {
			// Re-point all transactions from deleteId to keepId
			const TRANSACTION_ENTITIES: { entity: EntityName; field: string }[] = [
				{ entity: 'expenses', field: 'accountId' },
				{ entity: 'incomes', field: 'accountId' },
				{ entity: 'transfers', field: 'fromAccountId' },
				{ entity: 'transfers', field: 'toAccountId' },
				{ entity: 'recurringPayments', field: 'accountId' },
				{ entity: 'recurringIncomes', field: 'accountId' },
				{ entity: 'loans', field: 'accountId' },
				{ entity: 'receivables', field: 'accountId' },
			];

			for (const { entity, field } of TRANSACTION_ENTITIES) {
				const list =
					(state[entity as keyof typeof state] as unknown as Record<string, unknown>[]) ??
					[];
				for (const rec of list) {
					if (rec[field] === deleteId) {
						await save(entity, { ...rec, [field]: keepId } as Record<string, unknown>);
					}
				}
			}

			// Delete the duplicate account
			await remove('accounts', deleteId);

			const keepName = state.accounts.find((a) => a.id === keepId)?.name ?? keepId;
			const delName = state.accounts.find((a) => a.id === deleteId)?.name ?? deleteId;
			setDone(`Merged "${delName}" into "${keepName}". All transactions moved.`);
			setKeepId('');
			setDeleteId('');
		} finally {
			setMerging(false);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs text-muted-foreground">
				Select two accounts: the one to{' '}
				<span className="text-profit font-semibold">keep</span> and the one to{' '}
				<span className="text-loss font-semibold">delete</span>. All transactions from the
				deleted account are moved to the surviving account.
			</p>

			<FormField label="Keep this account">
				<Select
					value={keepId}
					onValueChange={setKeepId}>
					<SelectTrigger>
						<SelectValue placeholder="Select account to keep" />
					</SelectTrigger>
					<SelectContent>
						{state.accounts.map((a) => (
							<SelectItem
								key={a.id}
								value={a.id}>
								<span className="flex items-center gap-2">
									<span
										className="inline-block h-2 w-2 rounded-full"
										style={{ background: a.color ?? '#00d4f5' }}
									/>
									{a.name}
									<span className="font-mono text-xs text-muted-foreground ml-1">
										{fmt(state.computedBalances[a.id] ?? a.openingBalance ?? 0)}
									</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</FormField>

			<FormField label="Delete this account (duplicate)">
				<Select
					value={deleteId}
					onValueChange={setDeleteId}>
					<SelectTrigger>
						<SelectValue placeholder="Select duplicate to delete" />
					</SelectTrigger>
					<SelectContent>
						{state.accounts
							.filter((a) => a.id !== keepId)
							.map((a) => (
								<SelectItem
									key={a.id}
									value={a.id}>
									<span className="flex items-center gap-2">
										<span
											className="inline-block h-2 w-2 rounded-full"
											style={{ background: a.color ?? '#00d4f5' }}
										/>
										{a.name}
										<span className="font-mono text-xs text-muted-foreground ml-1">
											{fmt(
												state.computedBalances[a.id] ??
													a.openingBalance ??
													0
											)}
										</span>
									</span>
								</SelectItem>
							))}
					</SelectContent>
				</Select>
			</FormField>

			{done && (
				<div className="flex items-center gap-2 text-xs text-profit bg-profit/10 rounded-lg px-3 py-2">
					<CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {done}
				</div>
			)}

			<Button
				variant="destructive"
				onClick={doMerge}
				disabled={!canMerge || merging}
				className="w-full">
				<GitMerge className="h-4 w-4 mr-2" />
				{merging ? 'Merging…' : 'Merge Accounts'}
			</Button>
		</div>
	);
}

// ── Transaction duplicate review ──────────────────────────────────────────────
function TxDuplicateReview() {
	const { state, save, remove } = useApp();
	const pending = state.importReviews.filter((r) => r.status === 'pending');

	const resolve = async (review: ImportReview, decision: ImportReview['decision']) => {
		if (decision === 'overwrite') {
			// Save incoming record (overwrites existing id)
			const entity = review.entity;
			await save(entity, { ...review.incoming } as Record<string, unknown>);
		} else if (decision === 'create_new') {
			// Save as brand-new record (strip any id)
			const entity = review.entity;
			const { id: _id, ...rest } = review.incoming;
			void _id;
			await save(entity, rest as Record<string, unknown>);
		}
		// skip = do nothing to the transaction
		await save('importReviews', {
			...review,
			status: 'resolved',
			decision,
			resolvedAt: new Date().toISOString(),
		} as unknown as Record<string, unknown>);
	};

	if (pending.length === 0)
		return (
			<div className="text-xs text-muted-foreground text-center py-4">
				No pending duplicate reviews.
			</div>
		);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs text-muted-foreground">
				{pending.length} duplicate transaction{pending.length !== 1 ? 's' : ''} need review.
				Decisions are saved immediately.
			</p>
			{pending.map((review) => {
				const inc = review.incoming as Record<string, string | number>;
				const ext = review.existing as Record<string, string | number>;
				return (
					<div
						key={review.id}
						className="rounded-xl border border-warning/30 bg-warning/5 overflow-hidden">
						<div className="px-3 py-2.5 border-b border-warning/20">
							<p className="text-xs font-semibold text-warning">
								Duplicate {review.entity === 'expenses' ? 'Expense' : 'Income'}
							</p>
							<p className="text-sm font-bold mt-0.5">{String(inc.name)}</p>
							<p className="text-xs text-muted-foreground">
								{String(inc.date)} · {fmt(inc.amount as number)}
							</p>
						</div>
						<div className="px-3 py-2 text-xs text-muted-foreground border-b border-warning/10">
							Existing record from {fmtDate(String(ext.date))} ·{' '}
							{fmt(ext.amount as number)}
						</div>
						<div className="flex gap-1.5 p-2.5">
							<Button
								size="sm"
								variant="outline"
								className="flex-1 text-xs"
								onClick={() => resolve(review, 'skip')}>
								Skip
							</Button>
							<Button
								size="sm"
								variant="outline"
								className="flex-1 text-xs"
								onClick={() => resolve(review, 'overwrite')}>
								Overwrite
							</Button>
							<Button
								size="sm"
								className="flex-1 text-xs"
								onClick={() => resolve(review, 'create_new')}>
								Create New
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ── Intra-file duplicate resolution ──────────────────────────────────────────
// Called during import flow when two records in the same file share a name
interface IntraFileDupChoice {
	kind: string;
	name: string;
	options: Record<string, unknown>[];
	choice: number | null;
}

function IntraFileDupDialog({
	dups,
	onResolve,
}: {
	dups: IntraFileDupChoice[];
	onResolve: (choices: Record<string, number>) => void;
}) {
	const [choices, setChoices] = useState<Record<string, number>>(() =>
		Object.fromEntries(dups.map((d, i) => [i, 0]))
	);

	return (
		<Dialog
			open={dups.length > 0}
			onOpenChange={() => {}}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Duplicate names in import file</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4 p-5 pt-2 max-h-[60vh] overflow-y-auto">
					<p className="text-xs text-muted-foreground">
						These names appear more than once in your file. Choose which version to
						import.
					</p>
					{dups.map((d, di) => (
						<div
							key={di}
							className="flex flex-col gap-2">
							<p className="text-sm font-semibold">
								{d.kind}: "{d.name}"
							</p>
							{d.options.map((opt, oi) => (
								<button
									key={oi}
									onClick={() => setChoices((c) => ({ ...c, [di]: oi }))}
									className={`text-left rounded-lg border p-2.5 text-xs transition-colors ${choices[di] === oi ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
									<p className="font-semibold">Option {oi + 1}</p>
									{Object.entries(opt)
										.filter(
											([k]) => !['id', 'createdAt', 'updatedAt'].includes(k)
										)
										.map(([k, v]) => (
											<p
												key={k}
												className="text-muted-foreground">
												{k}: {String(v)}
											</p>
										))}
								</button>
							))}
						</div>
					))}
					<Button onClick={() => onResolve(choices)}>Use selected versions</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── Existing duplicate resolution ─────────────────────────────────────────────
interface ExistingDupChoice {
	kind: string;
	name: string;
	incoming: Record<string, unknown>;
	existing: Record<string, unknown>;
	decision: 'skip' | 'merge' | null;
}

function ExistingDupDialog({
	dups,
	onResolve,
}: {
	dups: ExistingDupChoice[];
	onResolve: (decisions: ('skip' | 'merge')[]) => void;
}) {
	const [decisions, setDecisions] = useState<('skip' | 'merge')[]>(() => dups.map(() => 'merge'));

	return (
		<Dialog
			open={dups.length > 0}
			onOpenChange={() => {}}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Matches existing records</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4 p-5 pt-2 max-h-[60vh] overflow-y-auto">
					<p className="text-xs text-muted-foreground">
						These names already exist in your data. Choose what to do.
					</p>
					{dups.map((d, i) => (
						<div
							key={i}
							className="rounded-xl border border-border overflow-hidden">
							<div className="px-3 py-2 border-b border-border bg-muted/30">
								<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
									{d.kind}
								</p>
								<p className="text-sm font-bold">{d.name}</p>
							</div>
							<div className="flex">
								<button
									onClick={() =>
										setDecisions((ds) =>
											ds.map((x, j) => (j === i ? 'merge' : x))
										)
									}
									className={`flex-1 flex items-center gap-2 p-3 text-xs transition-colors border-r border-border ${decisions[i] === 'merge' ? 'bg-profit/10 text-profit' : 'hover:bg-muted/40'}`}>
									<GitMerge className="h-3.5 w-3.5 shrink-0" />
									<div className="text-left">
										<p className="font-semibold">Merge</p>
										<p className="text-muted-foreground">
											Update existing with new data, move transactions
										</p>
									</div>
								</button>
								<button
									onClick={() =>
										setDecisions((ds) =>
											ds.map((x, j) => (j === i ? 'skip' : x))
										)
									}
									className={`flex-1 flex items-center gap-2 p-3 text-xs transition-colors ${decisions[i] === 'skip' ? 'bg-muted text-foreground' : 'hover:bg-muted/40'}`}>
									<CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
									<div className="text-left">
										<p className="font-semibold">Skip</p>
										<p className="text-muted-foreground">
											Keep existing unchanged
										</p>
									</div>
								</button>
							</div>
						</div>
					))}
					<Button onClick={() => onResolve(decisions)}>Apply decisions</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── EXPORT_ENTITIES ───────────────────────────────────────────────────────────
const EXPORT_ENTITIES: EntityName[] = [
	'accounts',
	'accountHeads',
	'expenses',
	'incomes',
	'transfers',
	'recurringPayments',
	'recurringIncomes',
	'loans',
	'creditCards',
	'receivables',
	'repaymentRecords',
	'investments',
	'reconciliations',
	'goals',
	'paymentOccurrences',
];

// ── DataPortability ───────────────────────────────────────────────────────────
type ImportStep =
	| 'idle'
	| 'intra_dup' // resolving duplicates within the file
	| 'existing_dup' // resolving duplicates against existing records
	| 'saving'
	| 'done';

function DataPortability() {
	const { state, save } = useApp();
	const fileRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<ImportStep>('idle');
	const [importError, setImportError] = useState('');
	const [importResult, setImportResult] = useState<{
		ok: number;
		err: number;
		reviews: number;
	} | null>(null);
	const [intraDups, setIntraDups] = useState<IntraFileDupChoice[]>([]);
	const [existingDups, setExistingDups] = useState<ExistingDupChoice[]>([]);
	const [planRef, setPlanRef] = useState<ReturnType<typeof parseImportFile> | null>(null);

	// ── Export ──────────────────────────────────────────────────────────────────
	const handleExport = () => {
		const payload: Record<string, unknown[]> = {};
		for (const entity of EXPORT_ENTITIES) {
			payload[entity] = (state[entity as keyof typeof state] as unknown[]) ?? [];
		}
		const json = JSON.stringify(
			{ version: '4.0', exportedAt: new Date().toISOString(), data: payload },
			null,
			2
		);
		const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
		Object.assign(document.createElement('a'), {
			href: url,
			download: `fintracker-export-${new Date().toISOString().slice(0, 10)}.json`,
		}).click();
		URL.revokeObjectURL(url);
	};

	// ── Download sample ─────────────────────────────────────────────────────────
	const downloadSample = () => {
		const a = document.createElement('a');
		a.href = './sample-import.json';
		a.download = 'fintracker-sample-import.json';
		a.click();
	};

	// ── File picked ─────────────────────────────────────────────────────────────
	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setImportError('');
		setImportResult(null);
		setStep('idle');
		e.target.value = '';

		try {
			const text = await file.text();
			const raw = JSON.parse(text);
			const plan = parseImportFile(raw, state);
			setPlanRef(plan);

			if (plan.intraFileDuplicates.length > 0) {
				setIntraDups(
					plan.intraFileDuplicates.map((d) => ({
						kind: d.kind,
						name: d.name,
						options: d.items as unknown as Record<string, unknown>[],
						choice: 0,
					}))
				);
				setStep('intra_dup');
				return;
			}

			if (plan.existingDuplicates.length > 0) {
				setExistingDups(
					plan.existingDuplicates.map((d) => ({
						kind: d.kind,
						name: (d.incoming as Record<string, string>).name,
						incoming: d.incoming,
						existing: d.existing,
						decision: null,
					}))
				);
				setStep('existing_dup');
				return;
			}

			await executePlan(plan, {});
		} catch (err) {
			setImportError((err as Error).message || 'Could not parse file.');
		}
	};

	// ── After intra-file dup resolution ─────────────────────────────────────────
	const handleIntraResolved = (choices: Record<string, number>) => {
		if (!planRef) return;
		// Keep only the chosen version from each duplicate group
		// (simplification: remove all from plan, add back chosen)
		// The plan's cleanAccounts already excluded these — we add the winners back
		for (const [idxStr, choiceIdx] of Object.entries(choices)) {
			const dup = planRef.intraFileDuplicates[Number(idxStr)];
			if (!dup) continue;
			const winner = (dup.items as unknown as Record<string, unknown>[])[choiceIdx];
			if (dup.kind === 'account') {
				const now = new Date().toISOString();
				const id =
					(winner.id as string | undefined) ??
					(planRef as unknown as { generateId?: () => string }).generateId?.() ??
					Math.random().toString(36).slice(2);
				planRef.cleanAccounts.push({
					...winner,
					id,
					createdAt: now,
					updatedAt: now,
				} as Partial<Account>);
				planRef.resolvedAccounts.set((winner.name as string).toLowerCase(), id);
			}
		}
		setIntraDups([]);

		if (planRef.existingDuplicates.length > 0) {
			setExistingDups(
				planRef.existingDuplicates.map((d) => ({
					kind: d.kind,
					name: (d.incoming as Record<string, string>).name,
					incoming: d.incoming,
					existing: d.existing,
					decision: null,
				}))
			);
			setStep('existing_dup');
		} else {
			executePlan(planRef, {});
		}
	};

	// ── After existing dup resolution ────────────────────────────────────────────
	const handleExistingResolved = useCallback(
		async (decisions: ('skip' | 'merge')[]) => {
			if (!planRef) return;
			setExistingDups([]);

			// mergeMap: existingId → incomingRecord (to update existing with new data + re-point txns)
			const mergeMap: Record<string, Record<string, unknown>> = {};
			for (let i = 0; i < planRef.existingDuplicates.length; i++) {
				const dup = planRef.existingDuplicates[i];
				if (decisions[i] === 'merge') {
					const existingId = (dup.existing as Record<string, string>).id;
					mergeMap[existingId] = dup.incoming;
					// Ensure resolvedAccounts points to existing id
					if (dup.kind === 'account') {
						const name = (dup.incoming as Record<string, string>).name?.toLowerCase();
						if (name) planRef.resolvedAccounts.set(name, existingId);
					}
				}
			}

			await executePlan(planRef, mergeMap);
		},
		[planRef]
	);

	// ── Execute plan ─────────────────────────────────────────────────────────────
	const executePlan = useCallback(
		async (
			plan: ReturnType<typeof parseImportFile>,
			mergeMap: Record<string, Record<string, unknown>>
		) => {
			setStep('saving');
			let ok = 0,
				err = 0;

			// Apply merges first (update existing records)
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

			// Save clean records
			const toSave: [EntityName, Record<string, unknown>][] = [
				...plan.cleanAccounts.map(
					(r) => ['accounts', r] as [EntityName, Record<string, unknown>]
				),
				...plan.cleanLoans.map(
					(r) => ['loans', r] as [EntityName, Record<string, unknown>]
				),
				...plan.cleanCreditCards.map(
					(r) => ['creditCards', r] as [EntityName, Record<string, unknown>]
				),
				...plan.cleanExpenses.map(
					(r) => ['expenses', r] as [EntityName, Record<string, unknown>]
				),
				...plan.cleanIncomes.map(
					(r) => ['incomes', r] as [EntityName, Record<string, unknown>]
				),
			];

			for (const [entity, record] of toSave) {
				try {
					await save(entity, record);
					ok++;
				} catch {
					err++;
				}
			}

			// Save transaction duplicate reviews for later resolution
			const reviews = makeTxReviewRecords(plan.txDuplicates, plan.sessionId);
			for (const r of reviews) {
				try {
					await save('importReviews', r as unknown as Record<string, unknown>);
				} catch {
					/* non-critical */
				}
			}

			if (plan.errors.length) console.warn('[import] errors:', plan.errors);

			setImportResult({ ok, err, reviews: reviews.length });
			setStep('done');
			setPlanRef(null);
		},
		[save]
	);

	return (
		<div className="flex flex-col gap-3">
			<Button
				variant="outline"
				onClick={handleExport}
				className="w-full justify-start gap-2">
				<Download className="h-4 w-4 text-cyan" /> Export all data as JSON
			</Button>
			<Button
				variant="outline"
				onClick={downloadSample}
				className="w-full justify-start gap-2">
				<Download className="h-4 w-4 text-muted-foreground" /> Download sample import JSON
			</Button>

			<input
				ref={fileRef}
				type="file"
				accept=".json,application/json"
				onChange={handleFile}
				className="hidden"
			/>
			<Button
				variant="outline"
				onClick={() => fileRef.current?.click()}
				disabled={step === 'saving'}
				className="w-full justify-start gap-2">
				<Upload className="h-4 w-4 text-warning" />
				{step === 'saving' ? 'Importing…' : 'Import from JSON'}
			</Button>
			<p className="text-xs text-muted-foreground -mt-1">
				Supported: accounts, incomes, expenses, loans, credit cards. IDs are generated
				automatically. Account names are used as identifiers.
			</p>

			{importError && (
				<div className="flex items-center gap-2 text-xs text-destructive">
					<AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {importError}
				</div>
			)}

			{importResult && (
				<div
					className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${importResult.err > 0 ? 'bg-warning/10 text-warning' : 'bg-profit/10 text-profit'}`}>
					<CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
					<div>
						<p>
							Imported {importResult.ok} records
							{importResult.err > 0
								? `, ${importResult.err} failed`
								: ' successfully'}
							.
						</p>
						{importResult.reviews > 0 && (
							<p className="text-warning mt-0.5">
								{importResult.reviews} duplicate transaction
								{importResult.reviews !== 1 ? 's' : ''} need review — see "Duplicate
								Review" tab.
							</p>
						)}
					</div>
				</div>
			)}

			{/* Intra-file dup dialog */}
			{step === 'intra_dup' && (
				<IntraFileDupDialog
					dups={intraDups}
					onResolve={handleIntraResolved}
				/>
			)}

			{/* Existing dup dialog */}
			{step === 'existing_dup' && (
				<ExistingDupDialog
					dups={existingDups}
					onResolve={handleExistingResolved}
				/>
			)}
		</div>
	);
}

// ── Clear Data ────────────────────────────────────────────────────────────────

const CLEAR_GROUPS: { label: string; description: string; icon: string; entities: EntityName[] }[] =
	[
		{
			label: 'Transactions',
			description: 'Expenses, incomes, transfers',
			icon: '🧾',
			entities: ['expenses', 'incomes', 'transfers'],
		},
		{
			label: 'Accounts',
			description: 'All bank, cash, and card accounts',
			icon: '🏦',
			entities: ['accounts'],
		},
		{
			label: 'Loans & Credit Cards',
			description: 'Loans, EMI schedules, credit cards, payment occurrences',
			icon: '🏠',
			entities: ['loans', 'creditCards', 'paymentOccurrences'],
		},
		{
			label: 'Recurring',
			description: 'Recurring payments and incomes',
			icon: '🔁',
			entities: ['recurringPayments', 'recurringIncomes'],
		},
		{
			label: 'Receivables',
			description: 'Money lent and repayment records',
			icon: '🤝',
			entities: ['receivables', 'repaymentRecords'],
		},
		{
			label: 'Investments',
			description: 'Portfolio and investment records',
			icon: '📊',
			entities: ['investments'],
		},
		{
			label: 'Goals',
			description: 'Financial goals',
			icon: '🎯',
			entities: ['goals'],
		},
		{
			label: 'Import Reviews',
			description: 'Pending duplicate import decisions',
			icon: '📋',
			entities: ['importReviews'],
		},
	];

type ClearScope = 'local' | 'cloud' | 'both';

function ClearDataSection() {
	const { state, clearData } = useApp();
	const isConnected = state.syncStatus === 'firebase';

	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [scope, setScope] = useState<ClearScope>('local');
	const [showConfirm, setShowConfirm] = useState(false);
	const [confirmText, setConfirmText] = useState('');
	const [clearing, setClearing] = useState(false);
	const [done, setDone] = useState<string | null>(null);

	const toggleGroup = (i: number) =>
		setSelected((s) => {
			const n = new Set(s);
			n.has(i) ? n.delete(i) : n.add(i);
			return n;
		});

	const selectAll = () => setSelected(new Set(CLEAR_GROUPS.map((_, i) => i)));
	const selectNone = () => setSelected(new Set());

	const selectedEntities: EntityName[] = [...selected].flatMap((i) => CLEAR_GROUPS[i].entities);

	const selectedGroups = [...selected].map((i) => CLEAR_GROUPS[i].label);
	const selectedGroupsSummary =
		selectedGroups.length <= 2
			? selectedGroups.join(', ')
			: `${selectedGroups.slice(0, 2).join(', ')} +${selectedGroups.length - 2} more`;

	const scopeLabel =
		scope === 'local'
			? 'local device only'
			: scope === 'cloud'
				? 'Firestore cloud only'
				: 'local device + Firestore cloud';

	const canProceed = selected.size > 0 && confirmText === 'DELETE';

	const handleClear = async () => {
		if (!canProceed) return;
		setClearing(true);
		try {
			await clearData({
				local: scope === 'local' || scope === 'both',
				cloud: scope === 'cloud' || scope === 'both',
				entities: selectedEntities,
			});
			setDone(`Cleared ${selectedGroups.join(', ')} from ${scopeLabel}.`);
		} finally {
			setClearing(false);
			setShowConfirm(false);
			setConfirmText('');
			setSelected(new Set());
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<p className="text-xs text-muted-foreground">
				Select what to delete and where.{' '}
				<span className="text-loss font-semibold">This cannot be undone.</span>
			</p>

			{/* Entity group checkboxes */}
			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between mb-1">
					<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
						What to clear
					</p>
					<div className="flex gap-2">
						<button
							onClick={selectAll}
							className="text-[10px] text-primary hover:underline">
							All
						</button>
						<button
							onClick={selectNone}
							className="text-[10px] text-muted-foreground hover:underline">
							None
						</button>
					</div>
				</div>
				{CLEAR_GROUPS.map((g, i) => {
					const checked = selected.has(i);
					return (
						<button
							key={i}
							type="button"
							onClick={() => toggleGroup(i)}
							className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors
                ${checked ? 'border-loss/40 bg-loss/5' : 'border-border hover:border-loss/20'}`}>
							<div
								className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors
                ${checked ? 'bg-loss border-loss' : 'border-border'}`}>
								{checked && (
									<svg
										className="h-2.5 w-2.5 text-white"
										viewBox="0 0 10 10"
										fill="none">
										<path
											d="M1.5 5L4 7.5L8.5 2.5"
											stroke="currentColor"
											strokeWidth="1.8"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								)}
							</div>
							<span className="text-base leading-none">{g.icon}</span>
							<div className="flex-1 min-w-0">
								<p
									className={`text-sm font-semibold ${checked ? 'text-loss' : 'text-foreground'}`}>
									{g.label}
								</p>
								<p className="text-xs text-muted-foreground mt-0.5">
									{g.description}
								</p>
							</div>
						</button>
					);
				})}
			</div>

			{/* Scope selector */}
			<div className="flex flex-col gap-1.5">
				<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
					Where to clear
				</p>
				{(['local', 'cloud', 'both'] as ClearScope[]).map((s) => {
					const labels: Record<ClearScope, { title: string; sub: string }> = {
						local: {
							title: 'Local device only',
							sub: 'Clears IndexedDB on this device. Cloud data is untouched.',
						},
						cloud: {
							title: 'Cloud (Firestore) only',
							sub: 'Removes documents from Firestore. Local cache is untouched.',
						},
						both: {
							title: 'Local + Cloud',
							sub: 'Completely removes all selected data everywhere.',
						},
					};
					const disabled = (s === 'cloud' || s === 'both') && !isConnected;
					return (
						<button
							key={s}
							type="button"
							disabled={disabled}
							onClick={() => !disabled && setScope(s)}
							className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors
                ${scope === s ? 'border-primary bg-primary/10' : 'border-border'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-primary/40'}`}>
							<div
								className={`h-3.5 w-3.5 shrink-0 rounded-full border-2 flex items-center justify-center
                ${scope === s ? 'border-primary' : 'border-border'}`}>
								{scope === s && (
									<div className="h-1.5 w-1.5 rounded-full bg-primary" />
								)}
							</div>
							<div>
								<p
									className={`text-sm font-semibold ${scope === s ? 'text-primary' : ''}`}>
									{labels[s].title}
								</p>
								<p className="text-xs text-muted-foreground">{labels[s].sub}</p>
								{disabled && (
									<p className="text-xs text-warning mt-0.5">
										Firebase not connected
									</p>
								)}
							</div>
						</button>
					);
				})}
			</div>

			{/* Success message */}
			{done && (
				<div className="flex items-center gap-2 text-xs text-profit bg-profit/10 rounded-lg px-3 py-2">
					<CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {done}
				</div>
			)}

			{/* Trigger button */}
			<Button
				variant="destructive"
				disabled={selected.size === 0}
				onClick={() => {
					setConfirmText('');
					setShowConfirm(true);
				}}
				className="w-full h-auto items-center justify-center gap-2 whitespace-normal py-2">
				<Trash2 className="h-4 w-4 shrink-0" />
				<span className="text-center leading-snug break-words">
					Clear {selected.size > 0 ? selectedGroupsSummary : 'selected data'}
				</span>
			</Button>

			{/* Confirmation dialog */}
			<Dialog
				open={showConfirm}
				onOpenChange={(o) => !o && setShowConfirm(false)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm data deletion</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 p-5 pt-2">
						{/* Summary */}
						<div className="rounded-xl border border-loss/30 bg-loss/5 p-3">
							<p className="text-sm font-semibold text-loss mb-2">
								You are about to delete:
							</p>
							<ul className="text-xs text-muted-foreground space-y-1">
								{[...selected].map((i) => (
									<li
										key={i}
										className="flex items-center gap-1.5">
										<span>{CLEAR_GROUPS[i].icon}</span>
										<span>
											<span className="font-semibold text-foreground">
												{CLEAR_GROUPS[i].label}
											</span>{' '}
											— {CLEAR_GROUPS[i].description}
										</span>
									</li>
								))}
							</ul>
							<p className="text-xs text-muted-foreground mt-2.5 pt-2.5 border-t border-loss/20">
								From:{' '}
								<span className="font-semibold text-foreground">{scopeLabel}</span>
							</p>
						</div>

						<div className="flex items-start gap-2.5 rounded-xl border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
							<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
							<p>
								This is{' '}
								<span className="font-bold">permanent and irreversible.</span>{' '}
								Export a backup first if you might need this data.
							</p>
						</div>

						<FormField label="Type DELETE to confirm">
							<Input
								value={confirmText}
								onChange={(e) => setConfirmText(e.target.value)}
								placeholder="DELETE"
								className="font-mono"
								autoFocus
							/>
						</FormField>

						<div className="flex gap-2">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => setShowConfirm(false)}
								disabled={clearing}>
								Cancel
							</Button>
							<Button
								variant="destructive"
								className="flex-1"
								onClick={handleClear}
								disabled={!canProceed || clearing}>
								{clearing ? 'Clearing…' : 'Delete permanently'}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ── Main SettingsView ─────────────────────────────────────────────────────────
export function SettingsView() {
	const { state, connectFirebase } = useApp();
	const [connected, setConnected] = useState(() => !!localStorage.getItem('ft_firebase_config'));
	const [showQR, setShowQR] = useState(false);
	const [qrData, setQrData] = useState('');
	const pendingReviews = state.importReviews.filter((r) => r.status === 'pending').length;

	const showQRModal = () => {
		const cfg = localStorage.getItem('ft_firebase_config');
		if (!cfg) return;
		setQrData(`${window.location.href.split('?')[0]}?fbc=${btoa(cfg)}`);
		setShowQR(true);
	};

	const disconnect = () => {
		localStorage.removeItem('ft_firebase_config');
		setConnected(false);
		window.location.reload();
	};

	return (
		<div className="flex flex-col gap-4">
			<h2 className="font-display text-xl font-bold">Settings</h2>

			<Tabs defaultValue="import">
				<TabsList className="w-full grid grid-cols-4">
					<TabsTrigger value="import">Import / Export</TabsTrigger>
					<TabsTrigger value="merge">Merge</TabsTrigger>
					<TabsTrigger
						value="review"
						className="relative">
						Dups
						{pendingReviews > 0 && (
							<span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-warning text-[9px] font-bold text-background">
								{pendingReviews}
							</span>
						)}
					</TabsTrigger>
					<TabsTrigger value="clear">Clear Data</TabsTrigger>
				</TabsList>
				<TabsContent value="import">
					<Card>
						<CardContent className="pt-4">
							<DataPortability />
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="merge">
					<Card>
						<CardContent className="pt-4">
							<MergeAccountsSection />
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="review">
					<Card>
						<CardContent className="pt-4">
							<TxDuplicateReview />
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="clear">
					<Card>
						<CardContent className="pt-4">
							<ClearDataSection />
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* Firebase */}
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle>🔥 Firebase Sync</CardTitle>
						{connected && <Badge variant="profit">Live</Badge>}
					</div>
				</CardHeader>
				<CardContent>
					{connected ? (
						<div className="flex flex-col gap-3">
							<p className="text-sm text-muted-foreground">
								Real-time sync active across all devices.
							</p>
							<div className="flex gap-2">
								<Button
									className="flex-1"
									onClick={showQRModal}>
									📱 QR Sync Code
								</Button>
								<Button
									variant="destructive"
									onClick={disconnect}>
									Disconnect
								</Button>
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							<p className="text-sm text-muted-foreground">
								Connect Firestore for real-time sync across all your devices.
							</p>
							<FirebaseSetup
								onConnect={async (cfg) => {
									await connectFirebase(cfg);
									setConnected(true);
								}}
							/>
						</div>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={showQR}
				onOpenChange={setShowQR}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Scan on Your Phone</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center gap-4 p-5">
						<div className="rounded-2xl bg-white p-4">
							<QRCanvas
								data={qrData}
								size={220}
							/>
						</div>
						<p className="text-sm text-warning font-semibold text-center">
							⚠ Contains your Firebase config. Only scan on your own devices.
						</p>
					</div>
				</DialogContent>
			</Dialog>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle>📱 Install as App</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-sm text-muted-foreground space-y-1.5">
						<p>
							<span className="font-semibold text-foreground">iOS Safari:</span> Share
							→ Add to Home Screen
						</p>
						<p>
							<span className="font-semibold text-foreground">Android Chrome:</span> ⋮
							→ Add to Home Screen
						</p>
						<p>
							<span className="font-semibold text-foreground">
								Desktop Chrome / Edge:
							</span>{' '}
							Install icon in address bar
						</p>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<CardTitle>📊 Data Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-2">
						{(
							[
								['Accounts', state.accounts.length],
								['Account Heads', state.accountHeads.length],
								['Expenses', state.expenses.length],
								['Incomes', state.incomes.length],
								['Transfers', state.transfers.length],
								['Loans', state.loans.length],
								['Credit Cards', state.creditCards.length],
								['Investments', state.investments.length],
								['Goals', state.goals.length],
								['Import Reviews', state.importReviews.length],
							] as [string, number][]
						).map(([label, count]) => (
							<div
								key={label}
								className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
								<span className="text-muted-foreground text-xs">{label}</span>
								<span className="font-mono font-semibold text-xs">{count}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

// ── Account Heads Management ──────────────────────────────────────────────────
export function AccountHeadsView() {
	const { state, save, remove } = useApp();
	const [newName, setNewName] = useState('');
	const [newType, setNewType] = useState('expense');
	const [newParent, setNewParent] = useState('head_expense');
	const [adding, setAdding] = useState(false);

	const roots = state.accountHeads.filter((h) => h.parentId === null);
	const children = (pid: string) => state.accountHeads.filter((h) => h.parentId === pid);

	const addHead = async () => {
		if (!newName.trim()) return;
		const now = new Date().toISOString();
		const parent = state.accountHeads.find((h) => h.id === newParent);
		await save('accountHeads', {
			name: newName.trim(),
			type: parent?.type ?? newType,
			parentId: newParent || null,
			isSystem: false,
			createdAt: now,
			updatedAt: now,
		});
		setNewName('');
		setAdding(false);
	};

	const canDelete = (h: import('@/types').AccountHead) =>
		!h.isSystem &&
		children(h.id).length === 0 &&
		!state.expenses.some((e) => e.accountHeadId === h.id) &&
		!state.incomes.some((i) => i.accountHeadId === h.id);

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs text-muted-foreground">
				Five root heads are fixed. Add sub-heads under any root.
			</p>
			{roots.map((root) => (
				<div
					key={root.id}
					className="rounded-xl border border-border overflow-hidden">
					<div className="flex items-center justify-between px-3 py-2 bg-muted/30">
						<div className="flex items-center gap-2">
							<span className="text-xs font-bold uppercase tracking-wide">
								{root.name}
							</span>
							<Badge
								variant="muted"
								className="text-[9px]">
								{root.type}
							</Badge>
						</div>
						<Badge
							variant="secondary"
							className="text-[9px]">
							System
						</Badge>
					</div>
					{children(root.id).map((child) => (
						<div
							key={child.id}
							className="flex items-center justify-between px-3 py-2 border-t border-border/50">
							<span className="text-sm pl-3">└ {child.name}</span>
							<Button
								size="icon-sm"
								variant="destructive"
								disabled={!canDelete(child)}
								onClick={() => remove('accountHeads', child.id)}
								title={canDelete(child) ? 'Delete' : 'In use or has children'}>
								<Trash2 className="h-3 w-3" />
							</Button>
						</div>
					))}
				</div>
			))}

			{!adding ? (
				<Button
					variant="outline"
					onClick={() => setAdding(true)}
					className="gap-2">
					<Plus className="h-4 w-4" /> Add account head
				</Button>
			) : (
				<div className="rounded-xl border border-border p-3 flex flex-col gap-2">
					<FormField label="Name">
						<Input
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
							placeholder="e.g. Rent, Salary, GST"
							autoFocus
						/>
					</FormField>
					<FormField label="Under (parent)">
						<Select
							value={newParent}
							onValueChange={setNewParent}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{roots.map((r) => (
									<SelectItem
										key={r.id}
										value={r.id}>
										{r.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FormField>
					<div className="flex gap-2">
						<Button
							variant="outline"
							className="flex-1"
							onClick={() => setAdding(false)}>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onClick={addHead}
							disabled={!newName.trim()}>
							Add
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
