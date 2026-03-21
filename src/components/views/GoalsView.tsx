import { useApp } from '@/context/AppContext';
import { fmt, fmtDateFull, todayStr } from '@/utils/format';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { EntityView, RowActions, useEntityFormPage } from './EntityView';
import { GoalForm, GOAL_ICONS } from '@/components/forms';
import type { Goal } from '@/types';

function estimateCompletion(g: Goal): string | null {
	if (!g.monthlyContribution || g.monthlyContribution <= 0) return null;
	const remaining = Math.max(0, g.targetAmount - g.currentAmount);
	const months = Math.ceil(remaining / g.monthlyContribution);
	if (months <= 0) return 'Already funded';
	const target = new Date();
	target.setMonth(target.getMonth() + months);
	return fmtDateFull(target.toISOString().split('T')[0]);
}

export function GoalsView() {
	const { state, save } = useApp();
	const active = state.goals.filter((g) => g.status === 'active');
	const completed = state.goals.filter((g) => g.status === 'completed');
	const paused = state.goals.filter((g) => g.status === 'paused');

	const { openAdd, startEdit, doRemove, FormPage } = useEntityFormPage<Goal>({
		tab: 'goals',
		records: state.goals,
		entity: 'goals',
		FormComp: GoalForm,
		pageTitle: 'Financial Goals',
		formTitle: 'Goal',
	});

	if (FormPage) return FormPage;

	const GoalCard = ({ g }: { g: Goal }) => {
		const pct = Math.min(100, (g.currentAmount / Math.max(g.targetAmount, 1)) * 100);
		const remaining = Math.max(0, g.targetAmount - g.currentAmount);
		const completion = estimateCompletion(g);
		const isOverdue = g.targetDate && g.targetDate < todayStr() && g.status === 'active';

		return (
			<Card className={g.status === 'completed' ? 'opacity-70' : ''}>
				<CardContent className="p-4">
					<div className="flex items-start justify-between mb-3">
						<div className="flex items-start gap-2">
							<span className="text-xl">{g.icon ?? GOAL_ICONS[g.type] ?? '🎯'}</span>
							<div>
								<p className="font-semibold">{g.name}</p>
								<div className="flex flex-wrap gap-1.5 mt-1">
									<Badge variant="muted">{g.type.replace(/_/g, ' ')}</Badge>
									{g.status === 'completed' && (
										<Badge variant="profit">✓ Done</Badge>
									)}
									{g.status === 'paused' && (
										<Badge variant="secondary">Paused</Badge>
									)}
									{isOverdue && <Badge variant="destructive">Overdue</Badge>}
								</div>
							</div>
						</div>
						<RowActions
							onEdit={() => startEdit(g)}
							onDelete={() => doRemove(g.id)}
						/>
					</div>

					<div className="flex justify-between text-xs text-muted-foreground mb-1">
						<span>{fmt(g.currentAmount)} saved</span>
						<span className="font-semibold text-foreground">{pct.toFixed(0)}%</span>
					</div>
					<Progress
						value={pct}
						className="h-2"
						indicatorClassName={g.status === 'completed' ? 'bg-profit' : ''}
					/>
					<div className="flex justify-between text-xs text-muted-foreground mt-1">
						<span>{fmt(remaining)} to go</span>
						<span>{fmt(g.targetAmount)} target</span>
					</div>

					<div className="grid grid-cols-2 gap-2 mt-3">
						{g.targetDate && (
							<div className="rounded-lg bg-muted/40 p-2">
								<p className="text-[10px] text-muted-foreground">Target Date</p>
								<p className="text-xs font-semibold mt-0.5">
									{fmtDateFull(g.targetDate)}
								</p>
							</div>
						)}
						{g.monthlyContribution && (
							<div className="rounded-lg bg-muted/40 p-2">
								<p className="text-[10px] text-muted-foreground">Monthly</p>
								<p className="text-xs font-mono font-semibold mt-0.5">
									{fmt(g.monthlyContribution)}
								</p>
							</div>
						)}
						{completion && (
							<div className="rounded-lg bg-muted/40 p-2">
								<p className="text-[10px] text-muted-foreground">Est. Done</p>
								<p className="text-xs font-semibold mt-0.5">{completion}</p>
							</div>
						)}
					</div>

					{g.status === 'active' && pct >= 100 && (
						<Button
							size="sm"
							variant="profit"
							className="mt-3 w-full"
							onClick={() => save('goals', { ...g, status: 'completed' })}>
							✓ Mark as Completed
						</Button>
					)}
				</CardContent>
			</Card>
		);
	};

	return (
		<EntityView
			title="Financial Goals"
			subtitle={`${active.length} active · ${completed.length} completed`}
			onAdd={openAdd}>
			{state.goals.length === 0 && (
				<EmptyState
					icon="🎯"
					title="No goals yet"
					description="Set targets for emergency fund, house down payment, vacation, debt payoff…"
				/>
			)}
			{active.length > 0 && (
				<div className="flex flex-col gap-3">
					{active.map((g) => (
						<GoalCard
							key={g.id}
							g={g}
						/>
					))}
				</div>
			)}
			{paused.length > 0 && (
				<>
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">
						Paused
					</p>
					<div className="flex flex-col gap-3">
						{paused.map((g) => (
							<GoalCard
								key={g.id}
								g={g}
							/>
						))}
					</div>
				</>
			)}
			{completed.length > 0 && (
				<>
					<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-2">
						Completed
					</p>
					<div className="flex flex-col gap-3">
						{completed.map((g) => (
							<GoalCard
								key={g.id}
								g={g}
							/>
						))}
					</div>
				</>
			)}
		</EntityView>
	);
}
