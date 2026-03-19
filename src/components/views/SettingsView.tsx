import { useState, useEffect, useRef } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { renderQR } from '@/qr/qrcode';
import type { FirebaseConfig, EntityName } from '@/types';

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
// Handles all common Firebase SDK snippet formats:
//   • Plain JS object:  { apiKey: "...", ... }
//   • With assignment:  const firebaseConfig = { ... };
//   • JSON:             { "apiKey": "...", ... }
//   • Quoted or unquoted property names
//   • Single or double quoted values
function parseFirebaseConfig(raw: string): FirebaseConfig {
	let text = raw.trim();

	// Strip  `const X = ` prefix and trailing semicolon
	text = text.replace(/^(?:const|let|var)\s+\w+\s*=\s*/, '');
	text = text.replace(/;?\s*$/, '').trim();

	// Extract the { ... } object body
	const braceStart = text.indexOf('{');
	const braceEnd = text.lastIndexOf('}');
	if (braceStart === -1 || braceEnd === -1) throw new Error('No object literal found');
	text = text.slice(braceStart, braceEnd + 1);

	// Normalise to valid JSON:
	// 1. Quote unquoted keys:   apiKey:  →  "apiKey":
	text = text.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:/g, '$1"$2":');
	// 2. Convert single-quoted strings to double-quoted
	//    Handle escaped single quotes inside: \'
	text = text.replace(
		/'((?:[^'\\]|\\.)*)'/g,
		(_, inner) => '"' + inner.replace(/\\'/g, "'").replace(/"/g, '\\"') + '"'
	);
	// 3. Remove trailing commas before } or ]
	text = text.replace(/,(\s*[}\]])/g, '$1');

	const parsed = JSON.parse(text) as Record<string, string>;
	if (!parsed.apiKey || !parsed.projectId) {
		throw new Error('apiKey and projectId are required');
	}
	return parsed as unknown as FirebaseConfig;
}

// ── Firebase setup card ───────────────────────────────────────────────────────
function FirebaseSetup({ onConnect }: { onConnect: (cfg: FirebaseConfig) => void }) {
	const [raw, setRaw] = useState('');
	const [cfg, setCfg] = useState<Partial<FirebaseConfig>>({
		apiKey: '',
		authDomain: '',
		projectId: '',
		appId: '',
	});
	const [err, setErr] = useState('');
	const [mode, setMode] = useState<'fields' | 'paste'>('paste'); // default to paste — easier

	const connect = () => {
		try {
			let parsed: FirebaseConfig;
			if (mode === 'paste') {
				parsed = parseFirebaseConfig(raw);
			} else {
				if (!cfg.apiKey || !cfg.projectId) {
					setErr('apiKey and projectId are required');
					return;
				}
				parsed = cfg as FirebaseConfig;
			}
			setErr('');
			onConnect(parsed);
		} catch (e) {
			setErr(
				(e as Error).message || 'Could not parse config. Try pasting the full SDK snippet.'
			);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<Tabs
				value={mode}
				onValueChange={(v) => setMode(v as 'fields' | 'paste')}>
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
						placeholder={`const firebaseConfig = {\n  apiKey: "AIzaSy...",\n  authDomain: "app.firebaseapp.com",\n  databaseURL: "...",\n  projectId: "my-app",\n  storageBucket: "my-app.appspot.com",\n  messagingSenderId: "123456",\n  appId: "1:123:web:abc"\n};`}
					/>
					<p className="text-[10px] text-muted-foreground mt-1.5">
						Paste the entire <code>firebaseConfig</code> object from your Firebase
						console. JS or JSON format both work.
					</p>
				</TabsContent>
				<TabsContent value="fields">
					<div className="flex flex-col gap-2">
						<FormField label="API Key">
							<Input
								value={cfg.apiKey ?? ''}
								onChange={(e) => setCfg({ ...cfg, apiKey: e.target.value })}
								placeholder="AIzaSy..."
							/>
						</FormField>
						<FormField label="Auth Domain">
							<Input
								value={cfg.authDomain ?? ''}
								onChange={(e) => setCfg({ ...cfg, authDomain: e.target.value })}
								placeholder="app.firebaseapp.com"
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
								placeholder="1:123:web:abc"
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
			<p className="text-xs text-muted-foreground">
				Firebase Console → Project Settings → Your apps → SDK setup
			</p>
		</div>
	);
}

// ── Export / Import ───────────────────────────────────────────────────────────

const EXPORT_ENTITIES: EntityName[] = [
	'accounts',
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

// Entities that are supported in the simple user-authored import format
const IMPORTABLE: EntityName[] = [
	'accounts',
	'expenses',
	'incomes',
	'loans',
	'creditCards',
	'transfers',
	'recurringPayments',
	'recurringIncomes',
	'receivables',
	'investments',
	'goals',
];

// Entity-friendly display names for the UI
const ENTITY_LABELS: Record<EntityName, string> = {
	accounts: 'Accounts',
	expenses: 'Expenses',
	incomes: 'Incomes',
	transfers: 'Transfers',
	recurringPayments: 'Recurring Payments',
	recurringIncomes: 'Recurring Incomes',
	loans: 'Loans',
	creditCards: 'Credit Cards',
	receivables: 'Receivables',
	repaymentRecords: 'Repayment Records',
	investments: 'Investments',
	reconciliations: 'Reconciliations',
	goals: 'Goals',
	paymentOccurrences: 'Payment Occurrences',
};

// Generate a simple deterministic id from a string (for stable account cross-refs)
function stableId(seed: string): string {
	// Simple but sufficient for import — collision probability is negligible
	let h = 5381;
	for (let i = 0; i < seed.length; i++) h = ((h << 5) + h) ^ seed.charCodeAt(i);
	return 'imp_' + (h >>> 0).toString(36) + '_' + Date.now().toString(36);
}

function ts() {
	return new Date().toISOString();
}

/** Ensure a record has id/createdAt/updatedAt, generating them if missing */
function ensureBase(r: Record<string, unknown>): Record<string, unknown> {
	return {
		...r,
		id: r.id ?? stableId(JSON.stringify(r)),
		createdAt: r.createdAt ?? ts(),
		updatedAt: r.updatedAt ?? ts(),
	};
}

/**
 * Resolve accountId: if the record has accountId as a name string (not an
 * existing ID), look it up by name in the account map and return the matched ID.
 */
function resolveAccountId(
	r: Record<string, unknown>,
	field: string,
	nameMap: Map<string, string> // account name → account id
): Record<string, unknown> {
	const val = r[field] as string | undefined;
	if (!val) return r;
	// If it already matches a known ID, leave it alone
	if ([...nameMap.values()].includes(val)) return r;
	// Try to look up by name
	const resolved = nameMap.get(val.toLowerCase().trim());
	if (resolved) return { ...r, [field]: resolved };
	return r;
}

function DataPortability() {
	const { state, save } = useApp();
	const fileRef = useRef<HTMLInputElement>(null);

	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<{
		ok: number;
		err: number;
		entities: Record<string, number>;
	} | null>(null);
	const [importError, setImportError] = useState('');
	const [showConfirm, setShowConfirm] = useState(false);
	const [pendingData, setPendingData] = useState<Record<string, unknown[]> | null>(null);

	// ── Export all ──────────────────────────────────────────────────────────────
	const handleExport = () => {
		const payload: Record<string, unknown[]> = {};
		for (const entity of EXPORT_ENTITIES) {
			payload[entity] = (state[entity] as unknown[]) ?? [];
		}
		const json = JSON.stringify(
			{ version: '4.0', exportedAt: new Date().toISOString(), data: payload },
			null,
			2
		);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `fintracker-export-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	// ── Download sample JSON ───────────────────────────────────────────────────
	const handleDownloadSample = () => {
		const today = new Date().toISOString().slice(0, 10);
		const thisMonth = today.slice(0, 7);
		const sample = {
			_comment: [
				'FinTracker import format — remove the _comment key before importing if it causes issues.',
				'You can include any subset of the arrays below.',
				"accountId in expenses/incomes/loans can be the account's NAME (e.g. 'HDFC Savings') or its id.",
				'id, createdAt, updatedAt are optional — they will be auto-generated if missing.',
				'Dates must be yyyy-MM-dd format.',
			],
			accounts: [
				{
					name: 'HDFC Savings',
					type: 'bank',
					balance: 45000,
					color: '#00d4f5',
					currency: 'INR',
				},
				{
					name: 'Cash Wallet',
					type: 'cash',
					balance: 2500,
				},
				{
					name: 'SBI Salary Account',
					type: 'bank',
					balance: 82000,
					color: '#00e5a0',
				},
			],
			expenses: [
				{
					name: 'Swiggy dinner',
					amount: 450,
					date: today,
					category: 'Food',
					accountId: 'HDFC Savings',
					notes: 'Biryani',
				},
				{
					name: 'Electricity bill',
					amount: 1200,
					date: `${thisMonth}-05`,
					category: 'Bills',
					accountId: 'HDFC Savings',
				},
				{
					name: 'Petrol',
					amount: 2000,
					date: `${thisMonth}-10`,
					category: 'Transport',
					accountId: 'Cash Wallet',
				},
			],
			incomes: [
				{
					name: 'July Salary',
					amount: 85000,
					date: `${thisMonth}-01`,
					accountId: 'SBI Salary Account',
					category: 'Salary',
				},
				{
					name: 'Freelance payment',
					amount: 15000,
					date: `${thisMonth}-15`,
					accountId: 'HDFC Savings',
					category: 'Freelance',
				},
			],
			creditCards: [
				{
					name: 'HDFC Regalia',
					limit: 300000,
					outstanding: 18500,
					statementDay: 15,
					billingCycleDays: 30,
					gracePeriodDays: 20,
					dueDate: `${thisMonth}-05`,
					statementDate: `${thisMonth}-15`,
				},
			],
			loans: [
				{
					name: 'Home Loan',
					loanType: 'normal',
					principalAmount: 2500000,
					interestRate: 8.5,
					tenureMonths: 240,
					startDate: '2022-04-01',
					emi: 21695,
					paidMonths: 27,
					accountId: 'HDFC Savings',
				},
				{
					name: 'Car Loan',
					loanType: 'normal',
					principalAmount: 600000,
					interestRate: 9.2,
					tenureMonths: 60,
					startDate: '2023-01-01',
					emi: 12489,
					paidMonths: 18,
					accountId: 'SBI Salary Account',
				},
			],
			recurringPayments: [
				{
					name: 'Netflix',
					amount: 649,
					frequency: 'monthly',
					nextDate: `${thisMonth}-20`,
					category: 'Subscriptions',
					accountId: 'HDFC Savings',
					isActive: true,
				},
				{
					name: 'House Rent',
					amount: 22000,
					frequency: 'monthly',
					nextDate: `${thisMonth}-01`,
					category: 'Housing',
					accountId: 'HDFC Savings',
					isActive: true,
				},
			],
		};

		const json = JSON.stringify(sample, null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'fintracker-sample-import.json';
		a.click();
		URL.revokeObjectURL(url);
	};

	// ── Parse uploaded file ────────────────────────────────────────────────────
	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setImportError('');
		setImportResult(null);

		try {
			const text = await file.text();
			const parsed = JSON.parse(text) as Record<string, unknown>;

			// Accept { data: { accounts: [...] } } wrapper OR bare { accounts: [...] }
			const raw =
				(parsed.data as Record<string, unknown[]>) ?? (parsed as Record<string, unknown[]>);

			// Accept the file if it has at least one recognised entity key
			const hasAny = IMPORTABLE.some(
				(e) => Array.isArray(raw[e]) && (raw[e] as unknown[]).length > 0
			);
			if (!hasAny) {
				throw new Error(
					`No recognised data found. Expected at least one of: ${IMPORTABLE.join(', ')}.`
				);
			}

			setPendingData(raw as Record<string, unknown[]>);
			setShowConfirm(true);
		} catch (err) {
			setImportError(
				(err as Error).message || 'Could not read file. Make sure it is valid JSON.'
			);
		}
		e.target.value = '';
	};

	// ── Execute import after confirmation ──────────────────────────────────────
	const executeImport = async () => {
		if (!pendingData) return;
		setShowConfirm(false);
		setImporting(true);

		let ok = 0,
			errCount = 0;
		const entities: Record<string, number> = {};

		// Build a name→id map from EXISTING accounts + accounts in the import file
		// so that accountId values that are names get resolved correctly.
		const nameMap = new Map<string, string>();

		// 1. Seed with existing accounts
		state.accounts.forEach((a) => nameMap.set(a.name.toLowerCase().trim(), a.id));

		// 2. Import accounts first and update the map with newly created IDs
		const rawAccounts = pendingData.accounts;
		if (Array.isArray(rawAccounts)) {
			for (const raw of rawAccounts) {
				try {
					const rec = ensureBase(raw as Record<string, unknown>);
					const saved = await save('accounts', rec);
					// Map by name so subsequent entities can resolve references
					const name = (rec.name as string | undefined)?.toLowerCase().trim();
					if (name) nameMap.set(name, saved.id);
					ok++;
					entities.accounts = (entities.accounts ?? 0) + 1;
				} catch {
					errCount++;
				}
			}
		}

		// 3. Import remaining entities with accountId resolution
		const RESOLVE_FIELDS: Partial<Record<EntityName, string[]>> = {
			expenses: ['accountId'],
			incomes: ['accountId'],
			transfers: ['fromAccountId', 'toAccountId'],
			recurringPayments: ['accountId'],
			recurringIncomes: ['accountId'],
			loans: ['accountId'],
			receivables: ['accountId'],
			investments: ['accountId'],
		};

		for (const entity of IMPORTABLE.filter((e) => e !== 'accounts')) {
			const records = pendingData[entity];
			if (!Array.isArray(records)) continue;
			const fields = RESOLVE_FIELDS[entity] ?? [];

			for (const raw of records) {
				try {
					let rec = ensureBase(raw as Record<string, unknown>);
					// Resolve account name references to IDs
					for (const field of fields) {
						rec = resolveAccountId(rec, field, nameMap);
					}
					await save(entity, rec);
					ok++;
					entities[entity] = (entities[entity] ?? 0) + 1;
				} catch {
					errCount++;
				}
			}
		}

		setImporting(false);
		setImportResult({ ok, err: errCount, entities });
		setPendingData(null);
	};

	// Pending import summary per entity
	const pendingBreakdown = pendingData
		? IMPORTABLE.filter(
				(e) => Array.isArray(pendingData[e]) && (pendingData[e] as unknown[]).length > 0
			).map((e) => ({ label: ENTITY_LABELS[e], count: (pendingData[e] as unknown[]).length }))
		: [];

	return (
		<div className="flex flex-col gap-3">
			{/* Export */}
			<Button
				variant="outline"
				onClick={handleExport}
				className="w-full justify-start gap-2">
				<Download className="h-4 w-4 text-cyan" />
				Export all data as JSON
			</Button>

			{/* Sample */}
			<Button
				variant="outline"
				onClick={handleDownloadSample}
				className="w-full justify-start gap-2">
				<Download className="h-4 w-4 text-muted-foreground" />
				Download sample import file
			</Button>
			<p className="text-xs text-muted-foreground -mt-1">
				Shows the format for accounts, expenses, incomes, credit cards, loans and recurring
				payments. Use account <strong>names</strong> (not IDs) in the <code>accountId</code>{' '}
				field — they'll be resolved automatically.
			</p>

			{/* Import */}
			<input
				ref={fileRef}
				type="file"
				accept=".json,application/json"
				onChange={handleFileChange}
				className="hidden"
			/>
			<Button
				variant="outline"
				onClick={() => fileRef.current?.click()}
				disabled={importing}
				className="w-full justify-start gap-2">
				<Upload className="h-4 w-4 text-warning" />
				{importing ? 'Importing…' : 'Import from JSON'}
			</Button>

			{importError && (
				<div className="flex items-start gap-2 text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">
					<AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
					{importError}
				</div>
			)}

			{importResult && (
				<div
					className={`flex flex-col gap-1 text-xs rounded-lg px-3 py-2.5 ${importResult.err > 0 ? 'bg-warning/10 text-warning' : 'bg-profit/10 text-profit'}`}>
					<div className="flex items-center gap-2 font-semibold">
						<CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
						Imported {importResult.ok} records
						{importResult.err > 0 ? ` (${importResult.err} failed)` : ' successfully'}
					</div>
					{Object.entries(importResult.entities).map(([e, n]) => (
						<span
							key={e}
							className="ml-5 text-[10px] opacity-80">
							{n} {ENTITY_LABELS[e as EntityName] ?? e}
						</span>
					))}
				</div>
			)}

			{/* Confirmation dialog */}
			<Dialog
				open={showConfirm}
				onOpenChange={(o) => !o && setShowConfirm(false)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Confirm Import</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-4 p-5 pt-2">
						<div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-1">
							{pendingBreakdown.map(({ label, count }) => (
								<div
									key={label}
									className="flex justify-between text-sm">
									<span className="text-muted-foreground">{label}</span>
									<span className="font-mono font-semibold">{count}</span>
								</div>
							))}
						</div>
						<p className="text-xs text-muted-foreground">
							Account names in <code>accountId</code> fields will be matched to
							existing accounts. If an account name doesn't exist, it will be created.
							Records with existing IDs will be updated.
						</p>
						<div className="flex gap-2">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => setShowConfirm(false)}>
								Cancel
							</Button>
							<Button
								className="flex-1"
								onClick={executeImport}>
								Import
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ── Main Settings view ────────────────────────────────────────────────────────
export function SettingsView() {
	const { state, connectFirebase } = useApp();
	const [connected, setConnected] = useState(() => !!localStorage.getItem('ft_firebase_config'));
	const [showQR, setShowQR] = useState(false);
	const [qrData, setQrData] = useState('');

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

			{/* Export / Import */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle>📦 Export & Import</CardTitle>
				</CardHeader>
				<CardContent>
					<DataPortability />
				</CardContent>
			</Card>

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
								Real-time sync is active. Changes propagate to all connected devices
								instantly.
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

			{/* QR Modal */}
			<Dialog
				open={showQR}
				onOpenChange={setShowQR}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Scan on Your Phone</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col items-center gap-4 p-5">
						<div className="rounded-2xl bg-white p-4 shadow-lg shadow-primary/20">
							<QRCanvas
								data={qrData}
								size={220}
							/>
						</div>
						<div className="text-sm text-muted-foreground text-center space-y-2">
							<p>
								Scan this QR to open FinTracker on your phone with Firebase already
								connected.
							</p>
							<p className="text-warning font-semibold">
								⚠ Contains your Firebase config. Only scan on your own devices.
							</p>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* PWA */}
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

			{/* Data summary */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle>📊 Data Summary</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-2 gap-2 text-sm">
						{[
							['Accounts', state.accounts.length],
							['Expenses', state.expenses.length],
							['Incomes', state.incomes.length],
							['Transfers', state.transfers.length],
							['Recurring Payments', state.recurringPayments.length],
							['Recurring Incomes', state.recurringIncomes.length],
							['Loans', state.loans.length],
							['Credit Cards', state.creditCards.length],
							['Receivables', state.receivables.length],
							['Investments', state.investments.length],
							['Goals', state.goals.length],
							['Reconciliations', state.reconciliations.length],
						].map(([label, count]) => (
							<div
								key={label as string}
								className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
								<span className="text-muted-foreground text-xs">{label}</span>
								<span className="font-mono font-semibold text-xs">{count}</span>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			{/* Architecture note */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle>💾 Data & Storage</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="text-sm text-muted-foreground mb-3">
						All data is stored in{' '}
						<span className="text-cyan font-semibold">IndexedDB</span> on your device
						first. The app works fully offline. Firebase is an optional sync layer.
					</p>
					<code className="text-xs text-cyan bg-muted rounded-md px-2 py-1 block font-mono">
						IDB → Repository → SyncQueue → Firebase
					</code>
				</CardContent>
			</Card>
		</div>
	);
}
