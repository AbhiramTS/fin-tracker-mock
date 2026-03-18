import { useApp } from '@/context/AppContext';
import { fmt, fmtDate, daysFromNow } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEditDelete } from './EntityView';
import { RecurringPaymentForm } from '@/components/forms';
import type { RecurringPayment } from '@/types';

export function RecurringView() {
	const { state } = useApp();
	const active = state.recurringPayments.filter((r) => r.isActive);
	const monthly = active.reduce((s, r) => s + (r.amount ?? 0), 0);

	const { startEdit, doRemove, EditDialog } = useEditDelete<RecurringPayment>({
		entity: 'recurringPayments',
		FormComp: RecurringPaymentForm,
		formProps: { accounts: state.accounts },
		formTitle: 'Recurring Payment',
	});

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
										<RowActions
											onEdit={() => startEdit(r)}
											onDelete={() => doRemove(r.id)}
										/>
									</div>
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
