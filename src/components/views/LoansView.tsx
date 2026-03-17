import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import {
	generateAmortisation,
	outstandingPrincipal,
	totalInterest,
	calculateEMI,
} from '@/utils/amortisation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView } from './EntityView';
import { LoanForm } from '@/components/forms';

function AmortisationTable({ loanId }: { loanId: string }) {
	const { state } = useApp();
	const loan = state.loans.find((l) => l.id === loanId);
	if (!loan) return null;
	const schedule = generateAmortisation(loan);
	const future = schedule.filter((r) => !r.isPaid);

	return (
		<div className="mt-3">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
				Amortisation Schedule
			</p>
			<div className="overflow-x-auto rounded-lg border border-border">
				<table className="w-full text-xs">
					<thead>
						<tr className="border-b border-border bg-muted/40">
							{[
								'#',
								'Date',
								'Opening',
								'EMI',
								'Principal',
								'Interest',
								'Closing',
							].map((h) => (
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
								<td className="px-2 py-1.5 text-right font-mono">
									{fmt(row.closingBalance)}
								</td>
							</tr>
						))}
						{future.length > 24 && (
							<tr>
								<td
									colSpan={7}
									className="px-2 py-1.5 text-center text-muted-foreground">
									+{future.length - 24} more rows
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

export function LoansView() {
	const { state, remove } = useApp();
	const [expanded, setExpanded] = useState<string | null>(null);

	const normalLoans = state.loans.filter((l) => l.loanType === 'normal');
	const ccLoans = state.loans.filter((l) => l.loanType === 'credit_card');
	const totalDebt = state.loans.reduce((s, l) => s + outstandingPrincipal(l), 0);

	const LoanCard = ({ l }: { l: (typeof state.loans)[0] }) => {
		const outstanding = outstandingPrincipal(l);
		const progress = Math.min(
			100,
			((l.paidMonths ?? 0) / Math.max(l.tenureMonths ?? 1, 1)) * 100
		);
		const monthsLeft = Math.max(0, (l.tenureMonths ?? 0) - (l.paidMonths ?? 0));
		const intTotal = totalInterest(l);
		const isOpen = expanded === l.id;
		const emi = l.emi || calculateEMI(l.principalAmount, l.interestRate, l.tenureMonths);

		return (
			<Card key={l.id}>
				<CardContent className="p-4">
					<div className="flex items-start justify-between mb-3">
						<div>
							<div className="flex items-center gap-2">
								<p className="font-semibold">{l.name}</p>
								<Badge variant={l.loanType === 'credit_card' ? 'warning' : 'muted'}>
									{l.loanType === 'credit_card' ? 'CC Loan' : 'Normal'}
								</Badge>
							</div>
							<p className="text-xs text-muted-foreground mt-0.5">
								EMI: {fmt(emi)} · {monthsLeft} months left
							</p>
						</div>
						<div className="flex items-start gap-2">
							<div className="text-right">
								<p className="font-mono font-bold text-loss">{fmt(outstanding)}</p>
								<p className="text-xs text-muted-foreground">outstanding</p>
							</div>
							<Button
								size="icon-sm"
								variant="destructive"
								onClick={() => remove('loans', l.id)}>
								<Trash2 className="h-3.5 w-3.5" />
							</Button>
						</div>
					</div>

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

					<div className="grid grid-cols-3 gap-2 mt-3">
						{[
							['Principal', fmt(l.principalAmount)],
							['Rate', `${l.interestRate}% p.a.`],
							['Total Interest', fmt(intTotal)],
						].map(([label, val]) => (
							<div
								key={label}
								className="rounded-lg bg-muted/40 p-2">
								<p className="text-[10px] text-muted-foreground">{label}</p>
								<p className="text-xs font-mono font-semibold mt-0.5">{val}</p>
							</div>
						))}
					</div>

					<button
						onClick={() => setExpanded(isOpen ? null : l.id)}
						className="mt-3 flex items-center gap-1 text-xs text-primary font-semibold">
						{isOpen ? (
							<ChevronUp className="h-3.5 w-3.5" />
						) : (
							<ChevronDown className="h-3.5 w-3.5" />
						)}
						{isOpen ? 'Hide' : 'View'} Amortisation Schedule
					</button>

					{isOpen && <AmortisationTable loanId={l.id} />}
				</CardContent>
			</Card>
		);
	};

	return (
		<EntityView
			title="Loans & EMIs"
			subtitle={`Outstanding: ${fmt(totalDebt)}`}
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
						/>
					))}
				</div>
			)}
		</EntityView>
	);
}
