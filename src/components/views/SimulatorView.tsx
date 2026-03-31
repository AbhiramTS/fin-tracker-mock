import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { fmt } from '@/utils/format';
import { calculateEMI } from '@/utils/amortisation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField, FormGrid } from '@/components/ui/form-field';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface SimResult {
	safe: boolean;
	label: string;
	items: [string, string, string?][];
}

export function SimulatorView() {
	const { state } = useApp();
	const totalBalance = state.accounts
		.filter((account) => account.type === 'bank' || account.type === 'cash')
		.reduce(
			(sum, account) =>
				sum + (state.computedBalances[account.id] ?? account.openingBalance ?? 0),
			0
		);
	const monthlyOut =
		state.recurringPayments.filter((r) => r.isActive).reduce((s, r) => s + (r.amount ?? 0), 0) +
		state.loans.reduce((s, l) => s + (l.emi ?? 0), 0);

	// Loan simulator
	const [lPrincipal, setLPrincipal] = useState('');
	const [lRate, setLRate] = useState('');
	const [lTenure, setLTenure] = useState('');
	const [lResult, setLResult] = useState<SimResult | null>(null);

	// Purchase simulator
	const [pAmount, setPAmount] = useState('');
	const [pResult, setPResult] = useState<SimResult | null>(null);

	// Recurring simulator
	const [rAmount, setRAmount] = useState('');
	const [rResult, setRResult] = useState<SimResult | null>(null);

	const simulateLoan = () => {
		const p = parseFloat(lPrincipal) || 0,
			r = parseFloat(lRate) || 0,
			t = parseInt(lTenure) || 0;
		if (!p || !t) return;
		const emi = calculateEMI(p, r, t);
		const newMonthly = monthlyOut + emi;
		const bufferMonths = emi > 0 ? Math.floor(totalBalance / emi) : 999;
		const safe = emi < totalBalance * 0.15 && bufferMonths > 6;
		setLResult({
			safe,
			label: safe ? 'Manageable' : 'Risky',
			items: [
				['Monthly EMI', fmt(emi), emi < totalBalance * 0.1 ? 'low' : 'high'],
				['New total monthly obligations', fmt(newMonthly)],
				[
					'Buffer months (balance / EMI)',
					`${bufferMonths} months`,
					bufferMonths > 6 ? 'safe' : 'risky',
				],
				['Total interest payable', fmt(emi * t - p)],
			],
		});
	};

	const simulatePurchase = () => {
		const spend = parseFloat(pAmount) || 0;
		if (!spend) return;
		const after = totalBalance - spend;
		const monthsCovered = monthlyOut > 0 ? Math.floor(after / monthlyOut) : 999;
		const safe = after > monthlyOut * 3;
		setPResult({
			safe,
			label: safe ? 'Manageable' : 'Risky',
			items: [
				['Balance after purchase', fmt(after), after < 0 ? 'negative' : 'ok'],
				[
					'Months of obligations covered',
					`${Math.max(0, monthsCovered)} months`,
					monthsCovered > 3 ? 'safe' : 'risky',
				],
				['Current monthly obligations', fmt(monthlyOut)],
			],
		});
	};

	const simulateRecurring = () => {
		const amt = parseFloat(rAmount) || 0;
		if (!amt) return;
		const newMonthly = monthlyOut + amt;
		const safe = newMonthly < totalBalance * 0.4;
		setRResult({
			safe,
			label: safe ? 'Manageable' : 'Risky',
			items: [
				['New monthly total', fmt(newMonthly)],
				[
					'% of balance per month',
					`${((newMonthly / Math.max(totalBalance, 1)) * 100).toFixed(1)}%`,
					safe ? 'ok' : 'high',
				],
				['Annual cost', fmt(amt * 12)],
			],
		});
	};

	const ResultCard = ({ result }: { result: SimResult }) => (
		<Card className={`border-l-2 ${result.safe ? 'border-l-profit' : 'border-l-loss'}`}>
			<CardContent className="p-4">
				<div className="flex items-center gap-2 mb-3">
					<span className="text-xl">{result.safe ? '✅' : '⚠️'}</span>
					<p className={`font-bold text-lg ${result.safe ? 'text-profit' : 'text-loss'}`}>
						{result.label}
					</p>
				</div>
				<div className="grid grid-cols-1 gap-2">
					{result.items.map(([label, val, status]) => (
						<div
							key={label}
							className="flex justify-between items-center rounded-lg bg-muted/40 p-2.5">
							<span className="text-xs text-muted-foreground">{label}</span>
							<span
								className={`font-mono text-sm font-bold ${status === 'risky' || status === 'high' || status === 'negative' ? 'text-loss' : status === 'safe' || status === 'ok' ? 'text-profit' : 'text-foreground'}`}>
								{val}
							</span>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="font-display text-xl font-bold">Financial Simulator</h2>
				<p className="text-sm text-muted-foreground mt-0.5">
					Model the impact of decisions before you commit
				</p>
			</div>

			{/* Context */}
			<Card>
				<CardContent className="grid grid-cols-2 gap-3 p-4">
					<div className="rounded-lg bg-muted/40 p-3">
						<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
							Current Balance
						</p>
						<p className="font-mono font-bold text-cyan mt-1">{fmt(totalBalance)}</p>
					</div>
					<div className="rounded-lg bg-muted/40 p-3">
						<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
							Monthly Out
						</p>
						<p className="font-mono font-bold text-warning mt-1">{fmt(monthlyOut)}</p>
					</div>
				</CardContent>
			</Card>

			<Tabs defaultValue="loan">
				<TabsList className="w-full">
					<TabsTrigger
						value="loan"
						className="flex-1">
						Loan
					</TabsTrigger>
					<TabsTrigger
						value="purchase"
						className="flex-1">
						Purchase
					</TabsTrigger>
					<TabsTrigger
						value="recurring"
						className="flex-1">
						Recurring
					</TabsTrigger>
				</TabsList>

				<TabsContent value="loan">
					<Card>
						<CardContent className="p-4">
							<p className="text-sm text-muted-foreground mb-3">
								See the impact of taking a new loan or EMI commitment.
							</p>
							<FormGrid>
								<FormField label="Principal (₹)">
									<Input
										type="number"
										value={lPrincipal}
										onChange={(e) => setLPrincipal(e.target.value)}
										placeholder="500000"
									/>
								</FormField>
								<FormField label="Rate (% p.a.)">
									<Input
										type="number"
										step="0.1"
										value={lRate}
										onChange={(e) => setLRate(e.target.value)}
										placeholder="10.5"
									/>
								</FormField>
								<FormField
									label="Tenure (months)"
									span={2}>
									<Input
										type="number"
										value={lTenure}
										onChange={(e) => setLTenure(e.target.value)}
										placeholder="60"
									/>
								</FormField>
							</FormGrid>
							<Button
								className="mt-3 w-full"
								onClick={simulateLoan}>
								🔮 Simulate Loan
							</Button>
						</CardContent>
					</Card>
					{lResult && <ResultCard result={lResult} />}
				</TabsContent>

				<TabsContent value="purchase">
					<Card>
						<CardContent className="p-4">
							<p className="text-sm text-muted-foreground mb-3">
								Model a large one-off purchase and its impact on your buffer.
							</p>
							<FormField label="Purchase Amount (₹)">
								<Input
									type="number"
									value={pAmount}
									onChange={(e) => setPAmount(e.target.value)}
									placeholder="150000"
								/>
							</FormField>
							<Button
								className="mt-3 w-full"
								onClick={simulatePurchase}>
								🔮 Simulate Purchase
							</Button>
						</CardContent>
					</Card>
					{pResult && <ResultCard result={pResult} />}
				</TabsContent>

				<TabsContent value="recurring">
					<Card>
						<CardContent className="p-4">
							<p className="text-sm text-muted-foreground mb-3">
								See what happens if you add a new monthly commitment.
							</p>
							<FormField label="Monthly Amount (₹)">
								<Input
									type="number"
									value={rAmount}
									onChange={(e) => setRAmount(e.target.value)}
									placeholder="5000"
								/>
							</FormField>
							<Button
								className="mt-3 w-full"
								onClick={simulateRecurring}>
								🔮 Simulate
							</Button>
						</CardContent>
					</Card>
					{rResult && <ResultCard result={rResult} />}
				</TabsContent>
			</Tabs>
		</div>
	);
}
