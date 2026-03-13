import { addDays, addMonths } from "./format";
import type { AppState, ForecastResult, ForecastDay, ForecastEvent } from "@/types";

export function buildForecast(data: Partial<AppState>, horizonDays = 60): ForecastResult {
  const today        = new Date();
  const totalBalance = (data.accounts ?? []).reduce((s, a) => s + (a.balance ?? 0), 0);
  const events: ForecastEvent[] = [];

  for (let i = 1; i <= horizonDays; i++) {
    const ds = addDays(today, i).toISOString().split("T")[0];

    (data.incomes ?? []).forEach((inc) => {
      if (inc.nextDate?.slice(0, 10) === ds)
        events.push({ date: ds, label: inc.name, amount: inc.amount, type: "income" });
    });

    (data.recurringPayments ?? []).forEach((rp) => {
      if (rp.nextDate?.slice(0, 10) === ds)
        events.push({ date: ds, label: rp.name, amount: -(rp.amount ?? 0), type: "payment" });
    });

    (data.loans ?? []).forEach((l) => {
      const nd = addMonths(
        new Date(l.startDate ?? today),
        (l.paidMonths ?? 0) + 1,
      ).toISOString().split("T")[0];
      if (nd === ds)
        events.push({ date: ds, label: `${l.name} EMI`, amount: -(l.emi ?? 0), type: "emi" });
    });

    (data.creditCards ?? []).forEach((cc) => {
      if (cc.dueDate?.slice(0, 10) === ds)
        events.push({ date: ds, label: `${cc.name} Bill`, amount: -(cc.outstanding ?? 0), type: "credit" });
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  let running = totalBalance;
  const timeline: ForecastDay[] = [...new Set(events.map((e) => e.date))].map((date) => {
    const dayEvents = events.filter((e) => e.date === date);
    dayEvents.forEach((e) => (running += e.amount));
    return { date, balance: running, events: dayEvents };
  });

  const shortfall   = timeline.find((t) => t.balance < 0) ?? null;
  const monthlyOut  = (data.recurringPayments ?? []).reduce((s, r) => s + (r.amount ?? 0), 0)
                    + (data.loans ?? []).reduce((s, l) => s + (l.emi ?? 0), 0);
  const safeToSpend = Math.max(0, totalBalance - monthlyOut * 1.5);

  return { timeline, shortfall, safeToSpend, totalBalance };
}
