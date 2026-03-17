import { Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate, daysFromNow } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView } from './EntityView';
import { RecurringPaymentForm } from '@/components/forms';

export function RecurringView() {
	const { state, remove } = useApp();
	const active = state.recurringPayments.filter((r) => r.isActive);
	const monthly = active.reduce((s, r) => s + (r.amount ?? 0), 0);

	return (
		<EntityView
			title="Recurring Payments"
			subtitle={`${fmt(monthly)}/mo · ${fmt(monthly * 12)}/yr`}
			entity="recurringPayments"
			FormComp={RecurringPaymentForm}
			formProps={{ accounts: state.accounts }}>
			{state.recurringPayments.length === 0 ? (
				<EmptyState
					icon="🔁"
					title="No recurring payments"
					description="Rent, subscriptions, insurance, SIPs…"
				/>
			) : (
				state.recurringPayments.map((r) => {
					const days = daysFromNow(r.nextDate);
					return (
						<Card key={r.id}>
							<CardContent className="p-4">
								<div className="flex items-start justify-between">
									<div>
										<p className="font-semibold">{r.name}</p>
										<div className="flex gap-2 mt-1.5">
											<Badge variant="muted">{r.category}</Badge>
											<Badge variant="muted">{r.frequency}</Badge>
											{!r.isActive && (
												<Badge variant="secondary">paused</Badge>
											)}
										</div>
									</div>
									<div className="flex items-start gap-2">
										<div className="text-right">
											<p className="font-mono font-bold text-warning">
												{fmt(r.amount)}
											</p>
											<p
												className={`text-xs mt-0.5 ${days <= 3 ? 'text-loss' : 'text-muted-foreground'}`}>
												{days <= 0 ? 'Due today' : `In ${days}d`} ·{' '}
												{fmtDate(r.nextDate)}
											</p>
										</div>
										<Button
											size="icon-sm"
											variant="destructive"
											onClick={() => remove('recurringPayments', r.id)}>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							</CardContent>
						</Card>
					);
				})
			)}
		</EntityView>
	);
}
