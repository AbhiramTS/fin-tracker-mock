import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { buildForecast } from '@/utils/forecast';
import { fmt, fmtDate, fmtDateFull } from '@/utils/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ForecastChart } from '@/components/charts';

export function ForecastView() {
	const { state } = useApp();
	const { timeline, shortfall } = useMemo(() => buildForecast(state, 90), [state]);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<h2 className="font-display text-xl font-bold">90-Day Forecast</h2>
				<Badge variant={shortfall ? 'destructive' : 'profit'}>
					{shortfall ? `⚠ Shortfall ${fmtDate(shortfall.date)}` : '✓ Stable'}
				</Badge>
			</div>

			{timeline.length > 0 && (
				<Card>
					<CardContent className="pt-4">
						<ForecastChart
							timeline={timeline}
							height={160}
						/>
					</CardContent>
				</Card>
			)}

			{timeline.length === 0 ? (
				<EmptyState
					icon="🔮"
					title="Nothing to forecast"
					description="Add recurring income, payments, or loan EMIs to build a forecast"
				/>
			) : (
				timeline.map((t, i) => (
					<Card
						key={i}
						className={`border-l-2 ${t.balance < 0 ? 'border-l-loss' : 'border-l-primary'}`}>
						<CardContent className="p-4">
							<div className="flex justify-between items-center">
								<span className="text-sm font-semibold text-muted-foreground">
									{fmtDateFull(t.date)}
								</span>
								<span
									className={`font-mono font-bold ${t.balance < 0 ? 'text-loss' : 'text-profit'}`}>
									{fmt(t.balance)}
								</span>
							</div>
							{t.events.map((e, j) => (
								<div
									key={j}
									className="flex items-center gap-2 mt-2 text-xs">
									<span className={e.amount > 0 ? 'text-profit' : 'text-loss'}>
										{e.amount > 0 ? '▲' : '▼'}
									</span>
									<span className="text-muted-foreground">{e.label}</span>
									<span className="font-mono ml-auto">
										{fmt(Math.abs(e.amount))}
									</span>
								</div>
							))}
						</CardContent>
					</Card>
				))
			)}
		</div>
	);
}
