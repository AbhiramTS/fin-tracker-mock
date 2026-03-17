import { addDays, addMonths } from './format';
import { nextEMIDate } from './amortisation';
import type { AppState, ForecastResult, ForecastDay, ForecastEvent } from '@/types';

export function buildForecast(data: Partial<AppState>, horizonDays = 60): ForecastResult {
	const today = new Date();
	const totalBalance = (data.accounts ?? [])
		.filter((a) => a.type !== 'credit_card' && a.type !== 'loan')
		.reduce((s, a) => s + (a.balance ?? 0), 0);

	const events: ForecastEvent[] = [];

	for (let i = 1; i <= horizonDays; i++) {
		const ds = addDays(today, i).toISOString().split('T')[0];

		// Recurring incomes
		(data.recurringIncomes ?? [])
			.filter((r) => r.isActive)
			.forEach((inc) => {
				if (inc.nextDate?.slice(0, 10) === ds)
					events.push({
						date: ds,
						label: inc.name,
						amount: inc.amount,
						type: 'income',
					});
			});

		// Recurring payments
		(data.recurringPayments ?? [])
			.filter((r) => r.isActive)
			.forEach((rp) => {
				if (rp.nextDate?.slice(0, 10) === ds)
					events.push({
						date: ds,
						label: rp.name,
						amount: -(rp.amount ?? 0),
						type: 'payment',
					});
			});

		// Loan EMIs
		(data.loans ?? []).forEach((l) => {
			const nd = nextEMIDate(l);
			if (nd === ds)
				events.push({
					date: ds,
					label: `${l.name} EMI`,
					amount: -(l.emi ?? 0),
					type: 'emi',
				});
		});

		// Credit card dues
		(data.creditCards ?? []).forEach((cc) => {
			if (cc.dueDate?.slice(0, 10) === ds)
				events.push({
					date: ds,
					label: `${cc.name} bill`,
					amount: -(cc.outstanding ?? 0),
					type: 'credit',
				});
		});

		// Goal contributions (if monthly contribution set)
		(data.goals ?? [])
			.filter((g) => g.status === 'active' && g.monthlyContribution)
			.forEach((g) => {
				// Contribute on 1st of each month in horizon
				const d = addDays(today, i);
				if (d.getDate() === 1)
					events.push({
						date: ds,
						label: `${g.name} contribution`,
						amount: -(g.monthlyContribution ?? 0),
						type: 'goal_contribution',
					});
			});
	}

	events.sort((a, b) => a.date.localeCompare(b.date));

	let running = totalBalance;
	const dates = [...new Set(events.map((e) => e.date))];
	const timeline: ForecastDay[] = dates.map((date) => {
		const dayEvents = events.filter((e) => e.date === date);
		dayEvents.forEach((e) => (running += e.amount));
		return { date, balance: running, events: dayEvents };
	});

	const shortfall = timeline.find((t) => t.balance < 0) ?? null;

	const monthlyObligations =
		(data.recurringPayments ?? [])
			.filter((r) => r.isActive)
			.reduce((s, r) => s + (r.amount ?? 0), 0) +
		(data.loans ?? []).reduce((s, l) => s + (l.emi ?? 0), 0) +
		(data.goals ?? [])
			.filter((g) => g.status === 'active')
			.reduce((s, g) => s + (g.monthlyContribution ?? 0), 0);

	const safeToSpend = Math.max(0, totalBalance - monthlyObligations * 1.5);

	return { timeline, shortfall, safeToSpend, totalBalance, monthlyObligations };
}
