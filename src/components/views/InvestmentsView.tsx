import { useApp } from '@/context/AppContext';
import { fmt, fmtPct } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PortfolioDonut } from '@/components/charts';
import { EntityView, RowActions, useEditDelete } from './EntityView';
import { InvestmentForm } from '@/components/forms';
import type { Investment } from '@/types';

const TYPE_COLORS: Record<string, string> = {
	stocks: 'text-cyan',
	mutual_fund: 'text-profit',
	ppf: 'text-[#a78bfa]',
	fd: 'text-warning',
	nps: 'text-[#06d6a0]',
	crypto: 'text-loss',
	real_estate: 'text-muted-foreground',
	gold: 'text-[#ffd700]',
	other: 'text-muted-foreground',
};

export function InvestmentsView() {
	const { state } = useApp();
	const total = state.investments.reduce((s, i) => s + (i.value ?? 0), 0);
	const totalCost = state.investments.reduce((s, i) => s + (i.costBasis ?? i.value ?? 0), 0);
	const totalPnL = total - totalCost;

	const { startEdit, doRemove, EditDialog } = useEditDelete<Investment>({
		entity: 'investments',
		FormComp: InvestmentForm,
		formTitle: 'Investment',
	});

	return (
		<EntityView
			title="Investments"
			subtitle={`Portfolio: ${fmt(total)}`}
			entity="investments"
			FormComp={InvestmentForm}>
			{total > 0 && (
				<Card>
					<CardContent className="p-4">
						<div className="grid grid-cols-3 gap-3 mb-4">
							<div>
								<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
									Value
								</p>
								<p className="font-mono font-bold text-cyan">{fmt(total)}</p>
							</div>
							<div>
								<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
									Cost
								</p>
								<p className="font-mono font-bold">{fmt(totalCost)}</p>
							</div>
							<div>
								<p className="text-[10px] uppercase tracking-wide text-muted-foreground">
									P&L
								</p>
								<p
									className={`font-mono font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>
									{totalPnL >= 0 ? '+' : ''}
									{fmt(totalPnL)}
								</p>
							</div>
						</div>
						{state.investments.length > 1 && (
							<div className="flex items-center gap-4">
								<PortfolioDonut
									investments={state.investments}
									height={120}
								/>
								<div className="flex flex-col gap-1.5">
									{Object.entries(
										state.investments.reduce<Record<string, number>>((a, i) => {
											a[i.type] = (a[i.type] ?? 0) + (i.value ?? 0);
											return a;
										}, {})
									)
										.sort((a, b) => b[1] - a[1])
										.map(([type, val]) => (
											<div
												key={type}
												className="flex items-center gap-2 text-xs">
												<span
													className={`font-medium ${TYPE_COLORS[type] ?? 'text-muted-foreground'}`}>
													{type.replace(/_/g, ' ')}
												</span>
												<span className="font-mono text-muted-foreground">
													{fmtPct((val / Math.max(total, 1)) * 100)}
												</span>
											</div>
										))}
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{state.investments.length === 0 ? (
				<EmptyState
					icon="📊"
					title="No investments"
					description="Stocks, mutual funds, PPF, FD, NPS, crypto…"
				/>
			) : (
				state.investments.map((inv) => {
					const pnl = (inv.value ?? 0) - (inv.costBasis ?? inv.value ?? 0);
					const pnlPct = inv.costBasis ? (pnl / inv.costBasis) * 100 : 0;
					return (
						<Card key={inv.id}>
							<CardContent className="flex items-center justify-between p-4">
								<div>
									<p className="font-semibold">{inv.name}</p>
									<Badge
										variant="muted"
										className={`mt-1 ${TYPE_COLORS[inv.type] ?? ''}`}>
										{inv.type.replace(/_/g, ' ')}
									</Badge>
									{inv.costBasis && (
										<p
											className={`text-xs mt-1 ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
											{pnl >= 0 ? '+' : ''}
											{fmt(pnl)} ({pnlPct >= 0 ? '+' : ''}
											{pnlPct.toFixed(1)}%)
										</p>
									)}
								</div>
								<div className="flex items-center gap-2">
									<span className="font-mono font-bold text-profit">
										{fmt(inv.value)}
									</span>
									<RowActions
										onEdit={() => startEdit(inv)}
										onDelete={() => doRemove(inv.id)}
									/>
								</div>
							</CardContent>
						</Card>
					);
				})
			)}
			{EditDialog}
		</EntityView>
	);
}
