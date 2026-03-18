import { useApp } from '@/context/AppContext';
import { fmt, fmtDateFull } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

export function ReconciliationView() {
	const { state } = useApp();
	const sorted = [...state.reconciliations].sort((a, b) =>
		(b.reconciledDate ?? '').localeCompare(a.reconciledDate ?? '')
	);

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="font-display text-xl font-bold">Reconciliation History</h2>
				<p className="text-sm text-muted-foreground mt-0.5">
					Past account reconciliations · Use the Accounts page to reconcile
				</p>
			</div>

			{sorted.length === 0 ? (
				<EmptyState
					icon="⚖️"
					title="No reconciliations yet"
					description="Go to Accounts and tap the reconcile icon to compare your tracked vs actual balance"
				/>
			) : (
				sorted.map((r) => {
					const account = state.accounts.find((a) => a.id === r.accountId);
					const isOk = Math.abs(r.difference ?? 0) < 1;
					return (
						<Card
							key={r.id}
							className={`border-l-2 ${isOk ? 'border-l-profit' : 'border-l-warning'}`}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between mb-3">
									<div>
										<p className="font-semibold">
											{account?.name ?? 'Unknown Account'}
										</p>
										<p className="text-xs text-muted-foreground mt-0.5">
											{fmtDateFull(r.reconciledDate)}
										</p>
									</div>
									<Badge variant={isOk ? 'profit' : 'warning'}>
										{isOk
											? 'Balanced'
											: `Diff: ${fmt(Math.abs(r.difference ?? 0))}`}
									</Badge>
								</div>
								<div className="grid grid-cols-3 gap-2">
									{[
										['Tracked', fmt(r.trackedBalance), 'text-foreground'],
										['Actual', fmt(r.actualBalance), 'text-foreground'],
										[
											'Difference',
											fmt(r.difference ?? 0),
											(r.difference ?? 0) === 0
												? 'text-profit'
												: (r.difference ?? 0) > 0
													? 'text-profit'
													: 'text-loss',
										],
									].map(([label, val, cls]) => (
										<div
											key={label}
											className="rounded-lg bg-muted/40 p-2">
											<p className="text-[10px] text-muted-foreground">
												{label}
											</p>
											<p
												className={`font-mono text-xs font-bold mt-0.5 ${cls}`}>
												{val}
											</p>
										</div>
									))}
								</div>
								{r.notes && (
									<p className="text-xs text-muted-foreground mt-2 italic">
										"{r.notes}"
									</p>
								)}
							</CardContent>
						</Card>
					);
				})
			)}
		</div>
	);
}
