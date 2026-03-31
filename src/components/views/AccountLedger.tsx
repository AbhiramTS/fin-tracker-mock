// AccountLedger.tsx — per-account ledger pages using JournalLedgerView
import { Badge } from '@/components/ui/badge';
import { SubpageLayout } from '@/components/ui/subpage-layout';
import { fmt } from '@/utils/format';
import { getReceivableJournalStats } from '@/utils/receivables';
import { useApp } from '@/context/AppContext';
import { JournalLedgerView } from '@/components/views/JournalLedgerView';
import type { Account, Loan, Receivable, Investment } from '@/types';

function LedgerBody({ children }: { children: React.ReactNode }) {
	return <div className="flex flex-col gap-4">{children}</div>;
}

// ── Account ledger page ──────────────────────────────────────────────────────
export function AccountLedgerPage({
	account,
	onBack,
}: {
	account: Account | null;
	onBack: () => void;
}) {
	const { state } = useApp();
	if (!account) return null;
	const balance = state.computedBalances[account.id] ?? account.openingBalance ?? 0;

	return (
		<SubpageLayout
			title={account.name}
			subtitle={`Balance: ${fmt(balance)}${account.openingBalance !== 0 ? ` · Opening: ${fmt(account.openingBalance)}` : ''}`}
			onBack={onBack}>
			<LedgerBody>
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<span
						className="inline-block h-3 w-3 rounded-full shrink-0"
						style={{ background: account.color ?? 'hsl(191 100% 47%)' }}
					/>
					<Badge variant="muted">{account.type.replace('_', ' ')}</Badge>
				</div>
				<JournalLedgerView filterAccountHeadId={account.id} />
			</LedgerBody>
		</SubpageLayout>
	);
}

// ── Loan ledger page ──────────────────────────────────────────────────────────
export function LoanLedgerPage({ loan, onBack }: { loan: Loan | null; onBack: () => void }) {
	if (!loan) return null;
	return (
		<SubpageLayout
			title={loan.name}
			subtitle="Loan ledger and journal history for this account"
			onBack={onBack}>
			<JournalLedgerView filterAccountHeadId={loan.id} />
		</SubpageLayout>
	);
}

// ── Credit card ledger page ───────────────────────────────────────────────────
export function CreditCardLedgerPage({
	card,
	onBack,
}: {
	card: Account | null;
	onBack: () => void;
}) {
	const { state } = useApp();
	if (!card) return null;
	const details = card.creditCard;
	const limit = details?.limit ?? 0;
	const trackedBalance = state.computedBalances[card.id] ?? card.openingBalance ?? 0;
	const outstanding = Math.max(0, -trackedBalance);
	return (
		<SubpageLayout
			title={card.name}
			subtitle={`Credit limit: ${fmt(limit)} · Outstanding: ${fmt(outstanding)}`}
			onBack={onBack}>
			<JournalLedgerView filterAccountHeadId={card.id} />
		</SubpageLayout>
	);
}

// ── Receivable ledger page ────────────────────────────────────────────────────
export function ReceivableLedgerPage({
	receivable,
	onBack,
}: {
	receivable: Receivable | null;
	onBack: () => void;
}) {
	const { state } = useApp();
	if (!receivable || !receivable.receivableHeadId) return null;
	const stats = getReceivableJournalStats(receivable, state.journalEntries);
	return (
		<SubpageLayout
			title={receivable.personName}
			subtitle={`Opening: ${fmt(stats.openingBalance)} · Lent: ${fmt(stats.totalDisbursed)} · Repaid: ${fmt(stats.totalRepaid)}`}
			onBack={onBack}>
			<JournalLedgerView filterAccountHeadId={receivable.receivableHeadId} />
		</SubpageLayout>
	);
}

// ── Investment ledger page ────────────────────────────────────────────────────
export function InvestmentLedgerPage({
	investment,
	onBack,
}: {
	investment: Investment | null;
	onBack: () => void;
}) {
	if (!investment) return null;
	return (
		<SubpageLayout
			title={investment.name}
			subtitle={`Value: ${fmt(investment.value)}${investment.costBasis != null ? ` · Cost: ${fmt(investment.costBasis)}` : ''}`}
			onBack={onBack}>
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Badge variant="muted">{investment.type.replace(/_/g, ' ')}</Badge>
			</div>
			<JournalLedgerView filterAccountHeadId={investment.id} />
		</SubpageLayout>
	);
}

// ── Generic account head ledger page ─────────────────────────────────────────
// Used from AccountHeadsView to show all entries under any head
export function AccountHeadLedgerPage({
	headId,
	headName,
	onBack,
}: {
	headId: string | null;
	headName: string;
	onBack: () => void;
}) {
	if (!headId) return null;

	return (
		<SubpageLayout
			title={headName}
			subtitle="All journal entries for this account head"
			onBack={onBack}>
			<JournalLedgerView filterAccountHeadId={headId} />
		</SubpageLayout>
	);
}
