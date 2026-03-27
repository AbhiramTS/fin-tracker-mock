import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fmt } from '@/utils/format';
import type { EntityPreview, ParsedEntities } from '@/agent/types';

function countEntities(entities: ParsedEntities): number {
	return Object.values(entities).reduce(
		(sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
		0
	);
}

function EntityRow({
	icon,
	label,
	detail,
}: {
	icon: string;
	label: string;
	detail: string;
}) {
	return (
		<div className="flex items-start gap-2.5 px-3 py-2">
			<span className="text-base shrink-0 leading-tight mt-0.5">{icon}</span>
			<div className="min-w-0">
				<p className="text-sm font-medium text-foreground truncate">{label}</p>
				<p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
			</div>
		</div>
	);
}

interface EntityPreviewCardProps {
	messageId: string;
	preview: EntityPreview;
	onSave: (messageId: string) => Promise<void>;
	onDismiss: (messageId: string) => void;
}

export function EntityPreviewCard({
	messageId,
	preview,
	onSave,
	onDismiss,
}: EntityPreviewCardProps) {
	if (preview.saveStatus === 'dismissed') return null;

	const { entities, summary, saveStatus, errorMessage } = preview;
	const totalCount = countEntities(entities);

	return (
		<div className="mt-2 ml-8 rounded-xl border border-primary/25 bg-primary/5 overflow-hidden animate-fade-in">
			{/* Header */}
			<div className="px-3 py-2.5 border-b border-primary/15">
				<p className="text-xs font-semibold text-primary leading-snug">{summary}</p>
				<p className="text-[10px] text-muted-foreground mt-0.5">
					{totalCount} {totalCount === 1 ? 'item' : 'items'} ready to save
				</p>
			</div>

			{/* Entity rows */}
			<div className="divide-y divide-border/40">
				{entities.journalEntries?.map((je, i) => (
					<EntityRow
						key={`je-${i}`}
						icon={
							je.type === 'income' ? '💰' : je.type === 'transfer' ? '🔄' : '💳'
						}
						label={je.description}
						detail={`${je.type} · ${fmt(je.amount)} · ${je.date}`}
					/>
				))}
				{entities.accounts?.map((acc, i) => (
					<EntityRow
						key={`acc-${i}`}
						icon="🏦"
						label={acc.name}
						detail={`${acc.type} · opening ${fmt(acc.openingBalance ?? 0)}`}
					/>
				))}
				{entities.loans?.map((loan, i) => (
					<EntityRow
						key={`loan-${i}`}
						icon="🏠"
						label={loan.name}
						detail={`${fmt(loan.principalAmount)} · ${loan.interestRate}% · ${loan.tenureMonths}m`}
					/>
				))}
				{entities.investments?.map((inv, i) => (
					<EntityRow
						key={`inv-${i}`}
						icon="📈"
						label={inv.name}
						detail={`${inv.type} · ${fmt(inv.value)}`}
					/>
				))}
				{entities.goals?.map((goal, i) => (
					<EntityRow
						key={`goal-${i}`}
						icon="🎯"
						label={goal.name}
						detail={`${goal.type} · target ${fmt(goal.targetAmount)}`}
					/>
				))}
				{entities.receivables?.map((rec, i) => (
					<EntityRow
						key={`rec-${i}`}
						icon="🤝"
						label={rec.personName}
						detail={`lent ${fmt(rec.amountLent)} · ${rec.dateLent}`}
					/>
				))}
				{entities.recurringPayments?.map((rp, i) => (
					<EntityRow
						key={`rp-${i}`}
						icon="🔁"
						label={rp.name}
						detail={`${fmt(rp.amount)} · ${rp.frequency} · ${rp.category}`}
					/>
				))}
				{entities.recurringIncomes?.map((ri, i) => (
					<EntityRow
						key={`ri-${i}`}
						icon="💵"
						label={ri.name}
						detail={`${fmt(ri.amount)} · ${ri.frequency}`}
					/>
				))}
			</div>

			{/* Error */}
			{errorMessage && (
				<div className="px-3 py-2 text-xs text-destructive bg-destructive/5 border-t border-destructive/20">
					{errorMessage}
				</div>
			)}

			{/* Actions */}
			{saveStatus === 'pending' && (
				<div className="flex gap-2 p-2.5 border-t border-primary/10">
					<Button
						size="sm"
						className="flex-1 gap-1.5 text-xs"
						onClick={() => void onSave(messageId)}>
						Save All
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="gap-1.5 text-xs shrink-0"
						onClick={() => onDismiss(messageId)}>
						<X className="h-3.5 w-3.5" />
						Dismiss
					</Button>
				</div>
			)}

			{saveStatus === 'saving' && (
				<div className="flex items-center gap-2 px-3 py-2.5 text-xs text-primary border-t border-primary/10">
					<RefreshCw className="h-3.5 w-3.5 animate-spin" />
					Saving…
				</div>
			)}

			{saveStatus === 'saved' && (
				<div className="flex items-center gap-2 px-3 py-2.5 text-xs text-profit border-t border-profit/15">
					<CheckCircle2 className="h-3.5 w-3.5" />
					Saved successfully
				</div>
			)}
		</div>
	);
}
