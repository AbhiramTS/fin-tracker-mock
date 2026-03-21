// ─────────────────────────────────────────────────────────────────────────────
//  ImportView.tsx
//  Standalone import flow: file parsing + duplicate resolution dialogs,
//  then hands off to ImportReviewView for pre-save editing.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, Download, AlertTriangle, GitMerge, CheckCircle2, FileJson } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { parseImportFile } from '@/utils/importEngine';
import {
	storePendingImport,
	listPendingImportSessions,
	setActiveImportSession,
	discardPendingImport,
	type ImportSessionSummary,
} from '@/utils/importStore';
import { fmtDate } from '@/utils/format';
import type { Account } from '@/types';

// ── Intra-file duplicate resolution ──────────────────────────────────────────
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
		Object.fromEntries(dups.map((_, i) => [i, 0]))
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
											Update existing with new data
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

// ── Import step ───────────────────────────────────────────────────────────────
type ImportStep = 'idle' | 'intra_dup' | 'existing_dup';

// ── Main view ─────────────────────────────────────────────────────────────────
export function ImportView() {
	const { state } = useApp();
	const fileRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<ImportStep>('idle');
	const [importError, setImportError] = useState('');
	const [intraDups, setIntraDups] = useState<IntraFileDupChoice[]>([]);
	const [existingDups, setExistingDups] = useState<ExistingDupChoice[]>([]);
	const [planRef, setPlanRef] = useState<ReturnType<typeof parseImportFile> | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const [pendingSessions, setPendingSessions] = useState<ImportSessionSummary[]>([]);
	const [loadingSessions, setLoadingSessions] = useState(true);

	const refreshSessions = useCallback(async () => {
		setLoadingSessions(true);
		try {
			setPendingSessions(await listPendingImportSessions());
		} finally {
			setLoadingSessions(false);
		}
	}, []);

	useEffect(() => {
		void refreshSessions();
	}, [refreshSessions]);

	const storeAndReview = (
		plan: ReturnType<typeof parseImportFile>,
		mergeMap: Record<string, Record<string, unknown>>,
		fileName?: string
	) => {
		void (async () => {
			await storePendingImport(plan, mergeMap, { fileName });
			window.location.hash = '/importreview';
		})();
	};

	const parseFile = async (file: File) => {
		setImportError('');
		setStep('idle');
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

			storeAndReview(plan, {}, file.name);
		} catch (err) {
			setImportError((err as Error).message || 'Could not parse file.');
		}
	};

	const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		e.target.value = '';
		await parseFile(file);
	};

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		const file = e.dataTransfer.files[0];
		if (file?.type === 'application/json' || file?.name.endsWith('.json')) {
			await parseFile(file);
		} else {
			setImportError('Please drop a JSON file.');
		}
	};

	const handleIntraResolved = (choices: Record<string, number>) => {
		if (!planRef) return;
		for (const [idxStr, choiceIdx] of Object.entries(choices)) {
			const dup = planRef.intraFileDuplicates[Number(idxStr)];
			if (!dup) continue;
			const winner = (dup.items as unknown as Record<string, unknown>[])[choiceIdx];
			if (dup.kind === 'account') {
				const now = new Date().toISOString();
				const id = (winner.id as string | undefined) ?? Math.random().toString(36).slice(2);
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
			storeAndReview(planRef, {});
		}
	};

	const handleExistingResolved = useCallback(
		(decisions: ('skip' | 'merge')[]) => {
			if (!planRef) return;
			setExistingDups([]);

			const mergeMap: Record<string, Record<string, unknown>> = {};
			for (let i = 0; i < planRef.existingDuplicates.length; i++) {
				const dup = planRef.existingDuplicates[i];
				if (decisions[i] === 'merge') {
					const existingId = (dup.existing as Record<string, string>).id;
					mergeMap[existingId] = dup.incoming;
					if (dup.kind === 'account') {
						const name = (dup.incoming as Record<string, string>).name?.toLowerCase();
						if (name) planRef.resolvedAccounts.set(name, existingId);
					}
				}
			}
			storeAndReview(planRef, mergeMap);
		},
		[planRef]
	);

	const downloadSample = () => {
		const a = document.createElement('a');
		a.href = '/sample-import.json';
		a.download = 'fintracker-sample-import.json';
		a.click();
	};

	const resumeSession = (sessionId: string) => {
		setActiveImportSession(sessionId);
		window.location.hash = '/importreview';
	};

	const discardSession = async (sessionId: string) => {
		await discardPendingImport(sessionId);
		await refreshSessions();
	};

	return (
		<div className="flex flex-col gap-6">
			<div>
				<h2 className="font-display text-xl font-bold">Import Data</h2>
				<p className="text-sm text-muted-foreground mt-0.5">
					Upload a FinTracker JSON file to import accounts, loans, and journal entries.
					You can review and edit everything before it saves.
				</p>
			</div>

			{/* Pending sessions */}
			{loadingSessions ? (
				<div className="rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground">
					Checking for pending import sessions...
				</div>
			) : pendingSessions.length > 0 ? (
				<Card>
					<CardContent className="pt-4 flex flex-col gap-3">
						<p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
							Pending Import Sessions
						</p>
						{pendingSessions.map((s) => (
							<div
								key={s.id}
								className="rounded-xl border border-border px-3 py-3 flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="text-sm font-semibold truncate">
										{s.fileName || 'Untitled import'}
									</p>
									<p className="text-xs text-muted-foreground mt-0.5">
										Updated {fmtDate(s.updatedAt)} · {s.entriesCount} txns ·
										{s.accountsCount} accounts · {s.loansCount} loans
									</p>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<Button
										variant="outline"
										size="sm"
										onClick={() => discardSession(s.id)}>
										Discard
									</Button>
									<Button
										size="sm"
										onClick={() => resumeSession(s.id)}>
										Resume
									</Button>
								</div>
							</div>
						))}
					</CardContent>
				</Card>
			) : null}

			{/* Drop zone */}
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={handleDrop}
				className={`flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30'}`}>
				<div className="rounded-full bg-muted/60 p-4">
					<FileJson className="h-8 w-8 text-muted-foreground" />
				</div>
				<div className="text-center">
					<p className="text-sm font-semibold">Drop a JSON file here</p>
					<p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
				</div>
				<input
					ref={fileRef}
					type="file"
					accept=".json,application/json"
					onChange={handleFile}
					className="hidden"
				/>
				<Button
					onClick={() => fileRef.current?.click()}
					className="gap-2">
					<Upload className="h-4 w-4" />
					Choose File
				</Button>
			</div>

			{importError && (
				<div className="flex items-center gap-2 text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
					<AlertTriangle className="h-4 w-4 shrink-0" />
					{importError}
				</div>
			)}

			{/* What's supported */}
			<Card>
				<CardContent className="pt-4 flex flex-col gap-3">
					<p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
						What gets imported
					</p>
					<div className="grid grid-cols-2 gap-2 text-xs">
						{[
							['🏦', 'Accounts', 'Bank, cash, credit cards, investments'],
							['🏠', 'Loans', 'With EMI auto-calculation'],
							['🧾', 'Journal Entries', 'All transaction types'],
							['📋', 'Duplicate detection', 'Per account name & transaction'],
						].map(([icon, label, desc]) => (
							<div
								key={label}
								className="flex flex-col gap-0.5 rounded-lg bg-muted/30 p-2.5">
								<p className="font-medium">
									{icon} {label}
								</p>
								<p className="text-muted-foreground">{desc}</p>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Sample file */}
			<div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
				<div>
					<p className="text-sm font-medium">Sample import file</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						Download to see the expected JSON format
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={downloadSample}
					className="gap-2 shrink-0">
					<Download className="h-3.5 w-3.5" />
					Download
				</Button>
			</div>

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
