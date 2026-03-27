import { useState, useEffect, useRef } from 'react';
import {
	Download,
	AlertTriangle,
	CheckCircle2,
	GitMerge,
	Trash2,
	Plus,
	RefreshCw,
	Upload,
	ChevronRight,
	Pencil,
	Bell,
	BellRing,
	Bot,
	Eye,
	EyeOff,
	Wifi,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNotifications } from '@/context/NotificationContext';
import { useNavigation } from '@/context/NavigationContext';
import { useAgentChat } from '@/context/AgentContext';
import { testAgentConnection } from '@/agent/llm';
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
import { fmt, fmtDate } from '@/utils/format';
import {
	ensurePushSubscription,
	getBrowserNotificationPermission,
	getBrowserNotificationsEnabled,
	isBrowserNotificationSupported,
	isPushSupported,
	requestBrowserNotificationPermission,
	setBrowserNotificationsEnabled,
	showBrowserNotification,
} from '@/utils/notifications';
import type { FirebaseConfig, EntityName, ImportReview } from '@/types';

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
			// For journalEntries we need to re-point both debit and credit sides
			const TRANSACTION_ENTITIES: { entity: EntityName; field: string }[] = [
				{ entity: 'journalEntries', field: 'debitAccountHeadId' },
				{ entity: 'journalEntries', field: 'creditAccountHeadId' },
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
								Duplicate{' '}
								{review.entity === 'journalEntries'
									? ((review.incoming as Record<string, string>).type ??
										'Journal Entry')
									: review.entity}
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

// ── EXPORT_ENTITIES ───────────────────────────────────────────────────────────
const EXPORT_ENTITIES: EntityName[] = [
	'accounts',
	'accountHeads',
	'journalEntries',
	'recurringPayments',
	'recurringIncomes',
	'loans',
	'receivables',
	'repaymentRecords',
	'investments',
	'reconciliations',
	'goals',
	'paymentOccurrences',
];

// ── ExportSection ─────────────────────────────────────────────────────────────
function ExportSection() {
	const { state } = useApp();

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
		const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
		Object.assign(document.createElement('a'), {
			href: url,
			download: `fintracker-export-${ts}.json`,
		}).click();
		URL.revokeObjectURL(url);
	};

	return (
		<div className="flex flex-col gap-3">
			<Button
				variant="outline"
				onClick={handleExport}
				className="w-full justify-start gap-2">
				<Download className="h-4 w-4 text-cyan" /> Export all data as JSON
			</Button>
			<p className="text-xs text-muted-foreground">
				Exports accounts, journal entries, loans, goals, and all other records as a
				versioned JSON file you can re-import or back up.
			</p>
			<div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 mt-1">
				<p className="text-xs text-muted-foreground">Want to import data?</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => {
						window.location.hash = '/import';
					}}
					className="gap-1.5">
					<Upload className="h-3.5 w-3.5" />
					Go to Import
				</Button>
			</div>
		</div>
	);
}

// ── Clear Data ────────────────────────────────────────────────────────────────

const CLEAR_GROUPS: { label: string; description: string; icon: string; entities: EntityName[] }[] =
	[
		{
			label: 'Account Heads',
			description: 'Chart of accounts categories and hierarchy',
			icon: '🗂️',
			entities: ['accountHeads'],
		},
		{
			label: 'Transactions',
			description: 'All journal entries (expenses, income, transfers)',
			icon: '🧾',
			entities: ['journalEntries'],
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
			entities: ['loans', 'paymentOccurrences'],
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
				<Trash2 className="h-4 w-4" />
				Clear {selected.size > 0 ? selectedGroups.join(', ') : 'selected data'}
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

// ── AI Agent Settings ─────────────────────────────────────────────────────────
function AIAgentSettings() {
	const { config, saveConfig, removeConfig } = useAgentChat();
	const { notify } = useNotifications();
	const { setTab } = useNavigation();
	const defaultProvider = config?.provider ?? 'openai-compatible';
	const defaultBaseUrl = config?.baseUrl ?? 'https://api.openai.com/v1';

	const [provider, setProvider] = useState<'openai-compatible' | 'gemini'>(defaultProvider);
	const [baseUrl, setBaseUrl] = useState(() => defaultBaseUrl);
	const [apiKey, setApiKey] = useState(() => config?.apiKey ?? '');
	const [model, setModel] = useState(() => config?.model ?? 'gpt-4o');
	const [showKey, setShowKey] = useState(false);
	const [testing, setTesting] = useState(false);
	const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

	useEffect(() => {
		if (provider === 'openai-compatible' && !baseUrl.trim()) {
			setBaseUrl('https://api.openai.com/v1');
		}
	}, [provider, baseUrl]);

	const hasChanged =
		provider !== (config?.provider ?? 'openai-compatible') ||
		baseUrl !== (config?.baseUrl ?? 'https://api.openai.com/v1') ||
		apiKey !== (config?.apiKey ?? '') ||
		model !== (config?.model ?? 'gpt-4o');

	const handleSave = () => {
		if (!apiKey.trim() || !model.trim()) {
			notify({ title: 'API key and model are required', tone: 'warning' });
			return;
		}
		if (provider === 'openai-compatible' && !baseUrl.trim()) {
			notify({ title: 'All fields are required', tone: 'warning' });
			return;
		}
		saveConfig({
			provider,
			baseUrl: provider === 'openai-compatible' ? baseUrl.trim() : undefined,
			apiKey: apiKey.trim(),
			model: model.trim(),
		});
		notify({ title: 'AI Agent settings saved', tone: 'success' });
	};

	const handleTest = async () => {
		if (!apiKey.trim() || !model.trim()) {
			notify({ title: 'Fill all fields first', tone: 'warning' });
			return;
		}
		if (provider === 'openai-compatible' && !baseUrl.trim()) {
			notify({ title: 'Fill all fields first', tone: 'warning' });
			return;
		}
		setTesting(true);
		setTestResult(null);
		try {
			const msg = await testAgentConnection({
				provider,
				baseUrl: provider === 'openai-compatible' ? baseUrl.trim() : undefined,
				apiKey: apiKey.trim(),
				model: model.trim(),
			});
			setTestResult({ ok: true, message: msg || 'Connection OK' });
		} catch (e) {
			setTestResult({ ok: false, message: (e as Error).message });
		} finally {
			setTesting(false);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				{config ? (
					<Badge variant="profit">Configured</Badge>
				) : (
					<Badge variant="secondary">Not configured</Badge>
				)}
				<p className="text-xs text-muted-foreground">
					{config
						? `Provider: ${config.provider ?? 'openai-compatible'} · Model: ${config.model}`
						: 'Set up an AI provider to start chatting'}
				</p>
			</div>

			<FormField label="Provider">
				<Select
					value={provider}
					onValueChange={(value) => setProvider(value as 'openai-compatible' | 'gemini')}>
					<SelectTrigger>
						<SelectValue placeholder="Select provider" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="openai-compatible">OpenAI-compatible</SelectItem>
						<SelectItem value="gemini">Google Gemini</SelectItem>
					</SelectContent>
				</Select>
			</FormField>

			{provider === 'openai-compatible' && (
				<FormField label="API Base URL">
					<Input
						value={baseUrl}
						onChange={(e) => setBaseUrl(e.target.value)}
						placeholder="https://api.openai.com/v1"
						autoComplete="off"
					/>
				</FormField>
			)}

			<FormField label="API Key">
				<div className="relative">
					<Input
						type={showKey ? 'text' : 'password'}
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder={provider === 'gemini' ? 'AIza…' : 'sk-…'}
						autoComplete="new-password"
						className="pr-10"
					/>
					<button
						type="button"
						onClick={() => setShowKey((v) => !v)}
						className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
						{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
					</button>
				</div>
			</FormField>

			<FormField label="Model">
				<Input
					value={model}
					onChange={(e) => setModel(e.target.value)}
					placeholder={provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o'}
					autoComplete="off"
				/>
			</FormField>

			<p className="text-xs text-muted-foreground">
				Supports OpenAI-compatible endpoints (OpenAI, Groq, Ollama, LM Studio, etc.) and
				Google Gemini. Your key is stored locally and{' '}
				<span className="font-semibold">never synced to the cloud</span>.
			</p>

			{testResult && (
				<div
					className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
						testResult.ok
							? 'bg-profit/10 text-profit border border-profit/20'
							: 'bg-loss/10 text-loss border border-loss/20'
					}`}>
					{testResult.ok ? (
						<CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
					) : (
						<AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
					)}
					<span className="break-all">{testResult.message}</span>
				</div>
			)}

			<div className="flex gap-2">
				<Button
					onClick={handleSave}
					className="flex-1"
					disabled={!hasChanged}>
					Save
				</Button>
				<Button
					onClick={() => void handleTest()}
					variant="outline"
					disabled={testing}
					className="gap-2">
					{testing ? (
						<RefreshCw className="h-4 w-4 animate-spin" />
					) : (
						<Wifi className="h-4 w-4" />
					)}
					{testing ? 'Testing…' : 'Test'}
				</Button>
				<Button
					variant="outline"
					className="gap-2"
					onClick={() => setTab('agent')}>
					<Bot className="h-4 w-4" />
					Open
				</Button>
			</div>

			{config && (
				<button
					type="button"
					onClick={removeConfig}
					className="text-xs text-muted-foreground hover:text-loss text-left transition-colors">
					Clear configuration
				</button>
			)}
		</div>
	);
}

// ── Main SettingsView ─────────────────────────────────────────────────────────
export function SettingsView() {
	const { state, connectFirebase, syncNow } = useApp();
	const { notify } = useNotifications();
	const { setTab } = useNavigation();
	const [connected, setConnected] = useState(() => !!localStorage.getItem('ft_firebase_config'));
	const [showQR, setShowQR] = useState(false);
	const [qrData, setQrData] = useState('');
	const [syncing, setSyncing] = useState(false);
	const [browserSupported] = useState(() => isBrowserNotificationSupported());
	const [pushSupported] = useState(() => isPushSupported());
	const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() =>
		getBrowserNotificationPermission()
	);
	const [browserEnabled, setBrowserEnabled] = useState(() => getBrowserNotificationsEnabled());
	const [pushEndpoint, setPushEndpoint] = useState<string | null>(null);
	const [subscribingPush, setSubscribingPush] = useState(false);
	const pendingReviews = state.importReviews.filter((r) => r.status === 'pending').length;
	const sync = state.sync;

	const showQRModal = () => {
		const cfg = localStorage.getItem('ft_firebase_config');
		if (!cfg) return;
		setQrData(`${window.location.href.split('?')[0]}?fbc=${btoa(cfg)}`);
		setShowQR(true);
	};

	const disconnect = () => {
		localStorage.removeItem('ft_firebase_config');
		setConnected(false);
		notify({ title: 'Firebase disconnected', tone: 'warning' });
		window.location.reload();
	};

	const handleSyncNow = async () => {
		setSyncing(true);
		try {
			await syncNow();
		} finally {
			setSyncing(false);
		}
	};

	const handleEnableBrowserNotifications = async () => {
		if (!browserSupported) {
			notify({
				title: 'Browser notifications not supported',
				description: 'This browser does not support notifications.',
				tone: 'warning',
			});
			return;
		}

		const permission = await requestBrowserNotificationPermission();
		setNotifPermission(permission);
		if (permission === 'granted') {
			setBrowserNotificationsEnabled(true);
			setBrowserEnabled(true);
			notify({
				title: 'Browser notifications enabled',
				description: 'You can now receive reminders from FinTracker.',
				tone: 'success',
			});
			return;
		}

		setBrowserNotificationsEnabled(false);
		setBrowserEnabled(false);
		notify({
			title: 'Permission denied',
			description: 'Allow notifications in browser settings to enable reminders.',
			tone: 'error',
		});
	};

	const handleDisableBrowserNotifications = () => {
		setBrowserNotificationsEnabled(false);
		setBrowserEnabled(false);
		notify({ title: 'Browser notifications disabled', tone: 'default' });
	};

	const handleTestInApp = () => {
		notify({
			title: 'In-app notification works',
			description: 'This toast confirms local in-app alerts are active.',
			tone: 'success',
		});
	};

	const handleTestBrowser = async () => {
		if (!browserEnabled || notifPermission !== 'granted') {
			notify({
				title: 'Enable browser notifications first',
				description: 'Grant permission before sending a browser alert.',
				tone: 'warning',
			});
			return;
		}

		const ok = await showBrowserNotification({
			title: 'FinTracker test notification',
			body: 'Notification channel is active.',
			tag: 'fintracker-test',
			url: `${import.meta.env.BASE_URL}#/payments`,
		});
		if (ok) {
			notify({ title: 'Browser notification sent', tone: 'success' });
		} else {
			notify({
				title: 'Could not send browser notification',
				tone: 'error',
			});
		}
	};

	const handleEnablePush = async () => {
		setSubscribingPush(true);
		try {
			const result = await ensurePushSubscription(import.meta.env.VITE_VAPID_PUBLIC_KEY);
			if (!result.ok) {
				notify({
					title: 'Push setup failed',
					description: result.reason,
					tone: 'warning',
				});
				return;
			}
			setPushEndpoint(result.endpoint ?? null);
			notify({
				title: 'Push subscription active',
				description: 'Device is now subscribed for push notifications.',
				tone: 'success',
			});
		} catch (e) {
			notify({
				title: 'Push setup failed',
				description: (e as Error).message,
				tone: 'error',
			});
		} finally {
			setSubscribingPush(false);
		}
	};

	// Human-readable time since last sync
	const lastSyncLabel = (() => {
		if (!sync.lastSyncedAt) return 'Never';
		const diff = Math.floor((Date.now() - new Date(sync.lastSyncedAt).getTime()) / 1000);
		if (diff < 60) return 'Just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return new Date(sync.lastSyncedAt).toLocaleDateString('en-IN', {
			day: 'numeric',
			month: 'short',
		});
	})();

	const phaseColor =
		sync.phase === 'error'
			? 'text-loss'
			: sync.phase === 'syncing'
				? 'text-warning'
				: sync.phase === 'success'
					? 'text-profit'
					: 'text-muted-foreground';
	const phaseLabel =
		sync.phase === 'error'
			? 'Error'
			: sync.phase === 'syncing'
				? 'Syncing…'
				: sync.phase === 'success'
					? 'Up to date'
					: connected
						? 'Connected'
						: 'Not connected';

	return (
		<div className="flex flex-col gap-4">
			<h2 className="font-display text-xl font-bold">Settings</h2>

			<Tabs defaultValue="import">
				<TabsList className="w-full grid grid-cols-4">
					<TabsTrigger value="import">Export</TabsTrigger>
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
					<TabsTrigger value="clear">Clear</TabsTrigger>
				</TabsList>
				<TabsContent value="import">
					<Card>
						<CardContent className="pt-4">
							<ExportSection />
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

			<Card>
				<CardHeader className="pb-2">
					<CardTitle>Account Heads</CardTitle>
				</CardHeader>
				<CardContent className="flex items-center justify-between gap-3">
					<p className="text-sm text-muted-foreground">
						Manage account heads in the dedicated Account Heads view.
					</p>
					<Button
						variant="outline"
						onClick={() => setTab('accountheads')}
						className="shrink-0">
						Open Account Heads
					</Button>
				</CardContent>
			</Card>

			{/* Firebase Sync + Status */}
			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle>🔥 Firebase Sync</CardTitle>
						{connected && <Badge variant="profit">Live</Badge>}
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{connected ? (
						<>
							{/* Sync status grid */}
							<div className="grid grid-cols-3 gap-0 rounded-xl overflow-hidden border border-border">
								{[
									{ label: 'Status', value: phaseLabel, cls: phaseColor },
									{
										label: 'Pending',
										value: `${sync.pendingCount} change${sync.pendingCount !== 1 ? 's' : ''}`,
										cls:
											sync.pendingCount > 0
												? 'text-warning'
												: 'text-muted-foreground',
									},
									{
										label: 'Last sync',
										value: lastSyncLabel,
										cls: 'text-muted-foreground',
									},
								].map(({ label, value, cls }, i) => (
									<div
										key={label}
										className={`flex flex-col items-center py-3 bg-muted/20 ${i < 2 ? 'border-r border-border' : ''}`}>
										<p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
											{label}
										</p>
										<p className={`font-semibold text-xs mt-0.5 ${cls}`}>
											{value}
										</p>
									</div>
								))}
							</div>

							{/* Last error */}
							{sync.lastError && (
								<div className="flex items-start gap-2.5 rounded-xl border border-loss/30 bg-loss/10 p-3 text-xs text-loss">
									<AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
									<div>
										<p className="font-semibold">Last sync error</p>
										<p className="mt-0.5 text-loss/80 font-mono break-all">
											{sync.lastError}
										</p>
									</div>
								</div>
							)}

							{/* Last sync detail */}
							{sync.lastSyncedCount > 0 && sync.phase !== 'error' && (
								<p className="text-xs text-muted-foreground">
									Last sync pushed{' '}
									<span className="font-semibold text-foreground">
										{sync.lastSyncedCount}
									</span>{' '}
									record{sync.lastSyncedCount !== 1 ? 's' : ''} to Firestore.
								</p>
							)}

							{/* Actions */}
							<div className="flex gap-2">
								<Button
									className="flex-1 gap-2"
									onClick={handleSyncNow}
									disabled={syncing || sync.phase === 'syncing'}>
									<RefreshCw
										className={`h-4 w-4 ${syncing || sync.phase === 'syncing' ? 'animate-spin' : ''}`}
									/>
									{syncing || sync.phase === 'syncing' ? 'Syncing…' : 'Sync Now'}
								</Button>
								<Button
									onClick={showQRModal}
									variant="outline"
									className="gap-2">
									📱 QR Code
								</Button>
								<Button
									variant="destructive"
									onClick={disconnect}>
									Disconnect
								</Button>
							</div>
						</>
					) : (
						<>
							<p className="text-sm text-muted-foreground">
								Connect Firestore for real-time sync across all your devices.
							</p>
							<FirebaseSetup
								onConnect={async (cfg) => {
									await connectFirebase(cfg);
									setConnected(true);
								}}
							/>
						</>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-2">
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<Bell className="h-4 w-4" />
							Notifications
						</CardTitle>
						{browserEnabled && notifPermission === 'granted' && (
							<Badge variant="profit">Enabled</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					<div className="grid grid-cols-2 gap-2">
						<div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
							<p className="text-[10px] uppercase tracking-widest text-muted-foreground">
								Browser support
							</p>
							<p className="mt-0.5 text-xs font-semibold text-foreground">
								{browserSupported ? 'Available' : 'Not available'}
							</p>
						</div>
						<div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
							<p className="text-[10px] uppercase tracking-widest text-muted-foreground">
								Permission
							</p>
							<p className="mt-0.5 text-xs font-semibold text-foreground capitalize">
								{notifPermission}
							</p>
						</div>
					</div>

					<p className="text-xs text-muted-foreground">
						In-app toasts are enabled by default. Browser notifications can alert you
						even when this tab is in the background.
					</p>

					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							onClick={handleTestInApp}>
							Test in-app toast
						</Button>
						{browserEnabled && notifPermission === 'granted' ? (
							<Button
								variant="secondary"
								onClick={handleDisableBrowserNotifications}>
								Disable browser alerts
							</Button>
						) : (
							<Button
								variant="default"
								onClick={handleEnableBrowserNotifications}>
								Enable browser alerts
							</Button>
						)}
						<Button
							variant="outline"
							onClick={handleTestBrowser}>
							<BellRing className="h-4 w-4" />
							Test browser alert
						</Button>
					</div>

					<div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
						<p className="text-[10px] uppercase tracking-widest text-muted-foreground">
							Push subscription
						</p>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{pushSupported
								? 'Push API available on this device.'
								: 'Push API is not available on this device/browser.'}
						</p>
						<div className="mt-2 flex items-center gap-2">
							<Button
								variant="outline"
								onClick={handleEnablePush}
								disabled={!pushSupported || subscribingPush}>
								{subscribingPush ? 'Subscribing…' : 'Enable push subscription'}
							</Button>
							{pushEndpoint && <Badge variant="outline">Subscribed</Badge>}
						</div>
						{pushEndpoint && (
							<p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
								Endpoint: {pushEndpoint}
							</p>
						)}
					</div>
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
					<CardTitle className="flex items-center gap-2">
						<Bot className="h-4 w-4" />
						AI Agent
					</CardTitle>
				</CardHeader>
				<CardContent>
					<AIAgentSettings />
				</CardContent>
			</Card>

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
								['Journal Entries', state.journalEntries.length],
								[
									'Expenses',
									state.journalEntries.filter((e) => e.type === 'expense').length,
								],
								[
									'Income',
									state.journalEntries.filter((e) => e.type === 'income').length,
								],
								[
									'Transfers',
									state.journalEntries.filter((e) => e.type === 'transfer')
										.length,
								],
								['Loans', state.loans.length],
								[
									'Credit Cards',
									state.accounts.filter((a) => a.type === 'credit_card').length,
								],
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
	const { route, openSubpage, goBack } = useNavigation();
	const [newName, setNewName] = useState('');
	const [newType, setNewType] = useState('expense');
	const [newParent, setNewParent] = useState('head_expense');
	const [newEntityHint, setNewEntityHint] = useState('');
	const [adding, setAdding] = useState(false);
	const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
	const [editName, setEditName] = useState('');
	const [editType, setEditType] = useState<import('@/types').RootAccountHeadType>('expense');
	const [editParentId, setEditParentId] = useState('head_expense');

	const roots = state.accountHeads.filter((h) => h.parentId === null);
	const children = (pid: string) => state.accountHeads.filter((h) => h.parentId === pid);
	const selectedHead =
		route.tab === 'accountheads' && route.subpage === 'head'
			? (state.accountHeads.find((h) => h.id === route.id) ?? null)
			: null;

	const addHead = async () => {
		if (!newName.trim()) return;
		const now = new Date().toISOString();
		const parent = state.accountHeads.find((h) => h.id === newParent);
		const parentType = parent?.type ?? newType;
		const defaultEntityHint =
			parentType === 'asset' ? 'bank' : parentType === 'liability' ? 'loan' : '';
		await save('accountHeads', {
			name: newName.trim(),
			type: parent?.type ?? newType,
			parentId: newParent || null,
			isSystem: false,
			entityHint: newEntityHint || defaultEntityHint,
			createdAt: now,
			updatedAt: now,
		});
		setNewName('');
		setNewEntityHint('');
		setAdding(false);
	};

	const selectedParentType = state.accountHeads.find((h) => h.id === newParent)?.type ?? newType;
	const editingHead = editingHeadId
		? (state.accountHeads.find((h) => h.id === editingHeadId) ?? null)
		: null;

	const relatedReceivables = selectedHead
		? state.receivables.filter(
				(r) => r.receivableHeadId === selectedHead.id || r.accountId === selectedHead.id
			)
		: [];
	const relatedJournalEntries = selectedHead
		? state.journalEntries
				.filter(
					(entry) =>
						entry.debitAccountHeadId === selectedHead.id ||
						entry.creditAccountHeadId === selectedHead.id
				)
				.sort((a, b) => {
					if (a.date !== b.date) return b.date.localeCompare(a.date);
					return b.createdAt.localeCompare(a.createdAt);
				})
		: [];

	const startEditHead = (head: import('@/types').AccountHead) => {
		if (head.isSystem || head.isAccount) return;
		setEditingHeadId(head.id);
		setEditName(head.name);
		setEditType(head.type);
		setEditParentId(head.parentId ?? `head_${head.type}`);
	};

	const saveHeadEdit = async () => {
		if (!editingHead || !editName.trim()) return;
		await save('accountHeads', {
			...editingHead,
			name: editName.trim(),
			type: editType,
			parentId: editParentId || null,
			updatedAt: new Date().toISOString(),
		});
		setEditingHeadId(null);
	};

	const editLinkedEntity = (head: import('@/types').AccountHead) => {
		const linkedAccount = state.accounts.find((a) => a.id === head.id);
		if (linkedAccount) {
			const targetTab = linkedAccount.type === 'credit_card' ? 'cards' : 'accounts';
			openSubpage('edit', { tab: targetTab, id: linkedAccount.id });
			return;
		}

		const linkedLoan = state.loans.find((loan) => loan.id === head.id);
		if (linkedLoan) {
			openSubpage('edit', { tab: 'loans', id: linkedLoan.id });
			return;
		}

		const linkedInvestment = state.investments.find((investment) => investment.id === head.id);
		if (linkedInvestment) {
			openSubpage('edit', { tab: 'investments', id: linkedInvestment.id });
			return;
		}

		const linkedReceivable = state.receivables.find((r) => r.receivableHeadId === head.id);
		if (linkedReceivable) {
			openSubpage('edit', { tab: 'receivables', id: linkedReceivable.id });
		}
	};

	const canDelete = (h: import('@/types').AccountHead) =>
		!h.isSystem &&
		!h.isAccount &&
		children(h.id).length === 0 &&
		!state.receivables.some((r) => r.receivableHeadId === h.id) &&
		!state.journalEntries.some(
			(e) => e.debitAccountHeadId === h.id || e.creditAccountHeadId === h.id
		);

	if (selectedHead) {
		const parentName =
			selectedHead.parentId === null
				? 'Root'
				: (state.accountHeads.find((h) => h.id === selectedHead.parentId)?.name ??
					selectedHead.parentId);

		return (
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={goBack}>
						Back
					</Button>
					<div className="flex items-center gap-2">
						{selectedHead.isAccount ? (
							<Button
								variant="outline"
								size="sm"
								onClick={() => editLinkedEntity(selectedHead)}>
								<Pencil className="h-3.5 w-3.5 mr-1" /> Edit linked record
							</Button>
						) : (
							<Button
								variant="outline"
								size="sm"
								onClick={() => startEditHead(selectedHead)}>
								<Pencil className="h-3.5 w-3.5 mr-1" /> Edit head
							</Button>
						)}
					</div>
				</div>

				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-lg font-semibold">{selectedHead.name}</p>
								<p className="text-xs text-muted-foreground mt-0.5">
									Parent: {parentName}
								</p>
							</div>
							<div className="flex items-center gap-1.5">
								<Badge variant="muted">{selectedHead.type}</Badge>
								{selectedHead.isSystem && <Badge variant="secondary">System</Badge>}
								{selectedHead.isAccount && <Badge variant="warning">Linked</Badge>}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle>Related Receivables ({relatedReceivables.length})</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						{relatedReceivables.length === 0 ? (
							<p className="text-xs text-muted-foreground">No related receivables.</p>
						) : (
							relatedReceivables.map((receivable) => (
								<button
									key={receivable.id}
									type="button"
									onClick={() =>
										openSubpage('edit', {
											tab: 'receivables',
											id: receivable.id,
										})
									}
									className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 transition-colors">
									<div className="flex items-center justify-between gap-2">
										<div>
											<p className="text-sm font-semibold">
												{receivable.personName}
											</p>
											<p className="text-xs text-muted-foreground mt-0.5">
												{receivable.description || 'No description'}
											</p>
										</div>
										<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
									</div>
								</button>
							))
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle>
							Related Journal Entries ({relatedJournalEntries.length})
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						{relatedJournalEntries.length === 0 ? (
							<p className="text-xs text-muted-foreground">
								No related journal entries.
							</p>
						) : (
							relatedJournalEntries.map((entry) => {
								const isDebit = entry.debitAccountHeadId === selectedHead.id;
								return (
									<button
										key={entry.id}
										type="button"
										onClick={() =>
											openSubpage('edit-entry', {
												tab: 'journalledger',
												id: entry.id,
											})
										}
										className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/40 transition-colors">
										<div className="flex items-center justify-between gap-2">
											<div>
												<p className="text-sm font-semibold">
													{entry.description}
												</p>
												<p className="text-xs text-muted-foreground mt-0.5">
													{fmtDate(entry.date)}
												</p>
											</div>
											<div className="flex items-center gap-2">
												<Badge variant={isDebit ? 'profit' : 'destructive'}>
													{isDebit ? 'Debit' : 'Credit'}
												</Badge>
												<span className="font-mono text-xs font-semibold">
													{fmt(entry.amount)}
												</span>
												<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
											</div>
										</div>
									</button>
								);
							})
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<p className="text-xs text-muted-foreground">
				Five root heads are fixed. Add sub-heads under any root.
			</p>
			{roots.map((root) => (
				<div
					key={root.id}
					className="rounded-xl border border-border overflow-hidden">
					<button
						type="button"
						onClick={() => openSubpage('head', { tab: 'accountheads', id: root.id })}
						className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/40 transition-colors">
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
					</button>
					{children(root.id).map((child) => (
						<div
							key={child.id}
							className="flex items-center justify-between px-3 py-2 border-t border-border/50 hover:bg-muted/10 transition-colors">
							<button
								type="button"
								onClick={() =>
									openSubpage('head', { tab: 'accountheads', id: child.id })
								}
								className="text-sm pl-3 text-left flex-1">
								└ {child.name}
							</button>
							<div className="flex items-center gap-1">
								{child.isAccount ? (
									<Button
										size="icon-sm"
										variant="outline"
										onClick={(e) => {
											e.stopPropagation();
											editLinkedEntity(child);
										}}
										title="Edit linked record">
										<Pencil className="h-3 w-3" />
									</Button>
								) : (
									<Button
										size="icon-sm"
										variant="outline"
										onClick={(e) => {
											e.stopPropagation();
											startEditHead(child);
										}}
										title="Edit head">
										<Pencil className="h-3 w-3" />
									</Button>
								)}
								<Button
									size="icon-sm"
									variant="destructive"
									disabled={!canDelete(child)}
									onClick={(e) => {
										e.stopPropagation();
										remove('accountHeads', child.id);
									}}
									title={canDelete(child) ? 'Delete' : 'In use or has children'}>
									<Trash2 className="h-3 w-3" />
								</Button>
							</div>
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
							onValueChange={(v) => {
								setNewParent(v);
								setNewEntityHint('');
							}}>
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
					{selectedParentType === 'asset' && (
						<FormField label="Create As">
							<Select
								value={newEntityHint || 'bank'}
								onValueChange={setNewEntityHint}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="bank">Bank Account</SelectItem>
									<SelectItem value="cash">Cash Account</SelectItem>
									<SelectItem value="investment">Investment Account</SelectItem>
									<SelectItem value="receivable">Lender / Receivable</SelectItem>
								</SelectContent>
							</Select>
						</FormField>
					)}
					{selectedParentType === 'liability' && (
						<FormField label="Create As">
							<Select
								value={newEntityHint || 'loan'}
								onValueChange={setNewEntityHint}>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="loan">Loan</SelectItem>
									<SelectItem value="credit_card">Credit Card</SelectItem>
									<SelectItem value="credit_card_loan">
										Credit Card Loan
									</SelectItem>
								</SelectContent>
							</Select>
						</FormField>
					)}
					<div className="flex gap-2">
						<Button
							variant="outline"
							className="flex-1"
							onClick={() => {
								setAdding(false);
								setNewEntityHint('');
							}}>
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

			<Dialog
				open={!!editingHeadId}
				onOpenChange={(open) => !open && setEditingHeadId(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Account Head</DialogTitle>
					</DialogHeader>
					{editingHead && (
						<div className="flex flex-col gap-3 p-5 pt-2">
							<FormField label="Name">
								<Input
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									autoFocus
								/>
							</FormField>
							<FormField label="Type">
								<Select
									value={editType}
									onValueChange={(value) => {
										const nextType =
											value as import('@/types').RootAccountHeadType;
										setEditType(nextType);
										setEditParentId(`head_${nextType}`);
									}}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{(
											[
												'asset',
												'liability',
												'income',
												'expense',
												'equity',
											] as import('@/types').RootAccountHeadType[]
										).map((type) => (
											<SelectItem
												key={type}
												value={type}>
												{type}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</FormField>
							<FormField label="Parent">
								<Select
									value={editParentId}
									onValueChange={setEditParentId}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{roots
											.filter((root) => root.type === editType)
											.map((root) => (
												<SelectItem
													key={root.id}
													value={root.id}>
													{root.name}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</FormField>
							<div className="flex gap-2">
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => setEditingHeadId(null)}>
									Cancel
								</Button>
								<Button
									className="flex-1"
									onClick={saveHeadEdit}
									disabled={!editName.trim()}>
									Save
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
