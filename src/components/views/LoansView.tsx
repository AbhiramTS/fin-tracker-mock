import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import {
	generateAmortisation,
	outstandingPrincipal,
	totalInterest,
	totalTax,
	totalCost,
	calculateEMI,
} from '@/utils/amortisation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView } from './EntityView';
import { LoanForm } from '@/components/forms';
import { LoanLedgerDialog } from './AccountLedger';
import type { Loan } from '@/types';

// ── Amortisation table with tax column ───────────────────────────────────────
function AmortisationTable({ loan }: { loan: Loan }) {
	const schedule = generateAmortisation(loan);
	const future = schedule.filter((r) => !r.isPaid);
	const hasTax = loan.taxRate && loan.taxRate > 0;
	const headers = [
		'#',
		'Date',
		'Opening',
		'EMI',
		'Principal',
		'Interest',
		...(hasTax ? ['Tax'] : []),
		...(hasTax ? ['Total'] : []),
		'Closing',
	];

	return (
		<div className="mt-3">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
				Amortisation Schedule
			</p>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-xs">
					<thead>
						<tr className="border-b border-border bg-muted/40">
							{headers.map((h) => (
								<th
									key={h}
									className="px-2 py-2 text-right first:text-left font-semibold text-muted-foreground whitespace-nowrap">
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{future.slice(0, 24).map((row) => (
							<tr
								key={row.month}
								className="border-b border-border/50 hover:bg-muted/20">
								<td className="px-2 py-1.5 text-muted-foreground">{row.month}</td>
								<td className="px-2 py-1.5 whitespace-nowrap">
									{fmtDate(row.date)}
								</td>
								<td className="px-2 py-1.5 text-right font-mono">
									{fmt(row.openingBalance)}
								</td>
								<td className="px-2 py-1.5 text-right font-mono font-semibold">
									{fmt(row.emi)}
								</td>
								<td className="px-2 py-1.5 text-right font-mono text-profit">
									{fmt(row.principal)}
								</td>
								<td className="px-2 py-1.5 text-right font-mono text-loss">
									{fmt(row.interest)}
								</td>
								{hasTax && (
									<td className="px-2 py-1.5 text-right font-mono text-warning">
										{fmt(row.tax)}
									</td>
								)}
								{hasTax && (
									<td className="px-2 py-1.5 text-right font-mono font-bold">
										{fmt(row.totalPayable)}
									</td>
								)}
								<td className="px-2 py-1.5 text-right font-mono">
									{fmt(row.closingBalance)}
								</td>
							</tr>
						))}
						{future.length > 24 && (
							<tr>
								<td
									colSpan={headers.length}
									className="px-2 py-1.5 text-center text-muted-foreground">
									+{future.length - 24} more rows
								</td>
							</tr>
						)}
					</tbody>
					{/* Totals footer */}
					{hasTax && (
						<tfoot>
							<tr className="border-t border-border bg-muted/30 font-semibold">
								<td
									colSpan={4}
									className="px-2 py-2 text-xs text-muted-foreground">
									Totals (remaining)
								</td>
								<td className="px-2 py-2 text-right font-mono text-xs text-profit">
									{fmt(future.reduce((s, r) => s + r.principal, 0))}
								</td>
								<td className="px-2 py-2 text-right font-mono text-xs text-loss">
									{fmt(future.reduce((s, r) => s + r.interest, 0))}
								</td>
								<td className="px-2 py-2 text-right font-mono text-xs text-warning">
									{fmt(future.reduce((s, r) => s + r.tax, 0))}
								</td>
								<td className="px-2 py-2 text-right font-mono text-xs font-bold">
									{fmt(future.reduce((s, r) => s + r.totalPayable, 0))}
								</td>
								<td />
							</tr>
						</tfoot>
					)}
				</table>
			</div>
			{hasTax && (
				<p className="text-[10px] text-muted-foreground mt-1.5">
					Tax ({loan.taxRate}%
					{loan.taxIncludedInRate ? ', included in rate' : ' on top of interest'}) is
					charged on the interest component each period.
				</p>
			)}
		</div>
	);
}

// ── Individual loan card ──────────────────────────────────────────────────────
function LoanCard({
	l,
	onRemove,
	expanded,
	onToggle,
	onViewHistory,
}: {
	l: Loan;
	onRemove: () => void;
	expanded: boolean;
	onToggle: () => void;
	onViewHistory: () => void;
}) {
	const outstanding = outstandingPrincipal(l);
	const progress = Math.min(100, ((l.paidMonths ?? 0) / Math.max(l.tenureMonths ?? 1, 1)) * 100);
	const monthsLeft = Math.max(0, (l.tenureMonths ?? 0) - (l.paidMonths ?? 0));
	const intTotal = totalInterest(l);
	const taxTotal = totalTax(l);
	const costTotal = totalCost(l);
	const hasTax = (l.taxRate ?? 0) > 0;
	const emi = l.emi || calculateEMI(l.principalAmount, l.interestRate, l.tenureMonths);

	// Estimated tax on next EMI interest portion
	const nextInterest = Math.round(outstanding * (l.interestRate / 12 / 100));
	const nextTax = hasTax ? Math.round((nextInterest * (l.taxRate ?? 0)) / 100) : 0;
	const nextTotal = emi + nextTax;

	return (
		<Card>
			<CardContent className="p-4">
				{/* Header */}
				<div className="flex items-start justify-between mb-3">
					<div
						className="flex-1 min-w-0 cursor-pointer"
						onClick={onViewHistory}>
						<div className="flex items-center gap-2 flex-wrap">
							<p className="font-semibold">{l.name}</p>
							<Badge variant={l.loanType === 'credit_card' ? 'warning' : 'muted'}>
								{l.loanType === 'credit_card' ? 'CC Loan' : 'Normal'}
							</Badge>
							{hasTax && (
								<Badge variant="warning">
									{l.taxRate}% tax{l.taxIncludedInRate ? ' (incl.)' : ''}
								</Badge>
							)}
						</div>
						<p className="text-xs text-muted-foreground mt-0.5">
							EMI: {fmt(emi)}
							{hasTax && (
								<span className="text-warning">
									{' '}
									+{fmt(nextTax)} tax = {fmt(nextTotal)} total
								</span>
							)}{' '}
							· {monthsLeft} months left
						</p>
					</div>
					<div className="flex items-start gap-2 ml-3">
						<div
							className="text-right cursor-pointer"
							onClick={onViewHistory}>
							<p className="font-mono font-bold text-loss">{fmt(outstanding)}</p>
							<p className="text-xs text-muted-foreground">outstanding</p>
						</div>
						<Button
							size="icon-sm"
							variant="destructive"
							onClick={onRemove}>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
						<button
							onClick={onViewHistory}
							className="self-center">
							<ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
						</button>
					</div>
				</div>

				{/* Progress */}
				<div className="flex justify-between text-xs text-muted-foreground mb-1">
					<span>
						{l.paidMonths} of {l.tenureMonths} paid
					</span>
					<span>{progress.toFixed(0)}%</span>
				</div>
				<Progress
					value={progress}
					className="h-1.5"
					indicatorClassName={progress > 75 ? 'bg-profit' : ''}
				/>

				{/* Summary grid */}
				<div className={`grid gap-2 mt-3 ${hasTax ? 'grid-cols-4' : 'grid-cols-3'}`}>
					{[
						['Principal', fmt(l.principalAmount)],
						['Rate', `${l.interestRate}% p.a.`],
						['Total Interest', fmt(intTotal)],
						...(hasTax ? [['Total Tax', fmt(taxTotal)]] : []),
					].map(([label, val]) => (
						<div
							key={label}
							className="rounded-lg bg-muted/40 p-2">
							<p className="text-[10px] text-muted-foreground">{label}</p>
							<p className="text-xs font-mono font-semibold mt-0.5">{val}</p>
						</div>
					))}
				</div>

				{/* Total cost callout when tax applies */}
				{hasTax && (
					<div className="mt-2 rounded-lg bg-warning/10 border border-warning/25 px-3 py-2 flex justify-between text-xs">
						<span className="text-warning font-semibold">
							Total cost (principal + interest + tax)
						</span>
						<span className="font-mono font-bold text-warning">{fmt(costTotal)}</span>
					</div>
				)}

				{/* Toggle amortisation */}
				<button
					onClick={onToggle}
					className="mt-3 flex items-center gap-1 text-xs text-primary font-semibold">
					{expanded ? (
						<ChevronUp className="h-3.5 w-3.5" />
					) : (
						<ChevronDown className="h-3.5 w-3.5" />
					)}
					{expanded ? 'Hide' : 'View'} Amortisation Schedule
				</button>

				{expanded && <AmortisationTable loan={l} />}
			</CardContent>
		</Card>
	);
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function LoansView() {
	const { state, remove } = useApp();
	const [expanded, setExpanded] = useState<string | null>(null);
	const [ledgerLoan, setLedgerLoan] = useState<Loan | null>(null);

	const normalLoans = state.loans.filter((l) => l.loanType === 'normal');
	const ccLoans = state.loans.filter((l) => l.loanType === 'credit_card');
	const totalDebt = state.loans.reduce((s, l) => s + outstandingPrincipal(l), 0);
	const totalTaxAll = state.loans.reduce((s, l) => s + totalTax(l), 0);

	return (
		<EntityView
			title="Loans & EMIs"
			subtitle={`Outstanding: ${fmt(totalDebt)}${totalTaxAll > 0 ? ` · Est. total tax: ${fmt(totalTaxAll)}` : ''}`}
			entity="loans"
			FormComp={LoanForm}
			formProps={{ accounts: state.accounts }}>
			{state.loans.length === 0 && (
				<EmptyState
					icon="🏠"
					title="No loans"
					description="Home loan, personal loan, car loan, credit card EMIs…"
				/>
			)}

			{normalLoans.length > 0 && (
				<div className="flex flex-col gap-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Normal Loans
					</p>
					{normalLoans.map((l) => (
						<LoanCard
							key={l.id}
							l={l}
							onRemove={() => remove('loans', l.id)}
							expanded={expanded === l.id}
							onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
							onViewHistory={() => setLedgerLoan(l)}
						/>
					))}
				</div>
			)}

			{ccLoans.length > 0 && (
				<div className="flex flex-col gap-3">
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Credit Card Loans
					</p>
					{ccLoans.map((l) => (
						<LoanCard
							key={l.id}
							l={l}
							onRemove={() => remove('loans', l.id)}
							expanded={expanded === l.id}
							onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
							onViewHistory={() => setLedgerLoan(l)}
						/>
					))}
				</div>
			)}

			<LoanLedgerDialog
				loan={ledgerLoan}
				onClose={() => setLedgerLoan(null)}
			/>
		</EntityView>
	);
}
