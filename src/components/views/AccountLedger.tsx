// AccountLedger.tsx — per-account ledger dialog using JournalLedgerView
// Opened by AccountsView when user taps an account card.
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { fmt } from '@/utils/format';
import { useApp } from '@/context/AppContext';
import { JournalLedgerView } from '@/components/views/JournalLedgerView';
import type { Account, Loan } from '@/types';

// ── Account ledger dialog ─────────────────────────────────────────────────────
export function AccountLedgerDialog({
	account,
	onClose,
}: {
	account: Account | null;
	onClose: () => void;
}) {
	const { state } = useApp();
	if (!account) return null;
	const balance = state.computedBalances[account.id] ?? account.openingBalance ?? 0;

	return (
		<Dialog
			open={!!account}
			onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl h-[90dvh] flex flex-col p-0">
				<DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
					<DialogTitle className="flex items-center gap-2">
						<span
							className="inline-block h-3 w-3 rounded-full shrink-0"
							style={{ background: account.color ?? 'hsl(191 100% 47%)' }}
						/>
						{account.name}
						<Badge
							variant="muted"
							className="ml-1 text-[10px]">
							{account.type.replace('_', ' ')}
						</Badge>
					</DialogTitle>
					<p className="text-sm text-muted-foreground mt-0.5">
						Balance:{' '}
						<span
							className={`font-mono font-bold ${balance < 0 ? 'text-loss' : 'text-cyan'}`}>
							{fmt(balance)}
						</span>
						{account.openingBalance !== 0 && (
							<span className="ml-2 text-xs">
								Opening: {fmt(account.openingBalance)}
							</span>
						)}
					</p>
				</DialogHeader>
				<div className="flex-1 overflow-y-auto p-5">
					<JournalLedgerView filterAccountHeadId={account.id} />
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── Loan ledger dialog ────────────────────────────────────────────────────────
export function LoanLedgerDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
	if (!loan) return null;
	return (
		<Dialog
			open={!!loan}
			onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl h-[90dvh] flex flex-col p-0">
				<DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
					<DialogTitle>{loan.name}</DialogTitle>
					<p className="text-sm text-muted-foreground">
						Loan ledger — journal entries referencing this loan account
					</p>
				</DialogHeader>
				<div className="flex-1 overflow-y-auto p-5">
					<JournalLedgerView filterAccountHeadId={loan.id} />
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── Credit card ledger dialog ─────────────────────────────────────────────────
export function CreditCardLedgerDialog({
	card,
	onClose,
}: {
	card: Account | null;
	onClose: () => void;
}) {
	if (!card) return null;
	const details = card.creditCard;
	const limit = details?.limit ?? 0;
	const outstanding = details?.outstanding ?? Math.max(0, -(card.openingBalance ?? 0));
	return (
		<Dialog
			open={!!card}
			onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl h-[90dvh] flex flex-col p-0">
				<DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
					<DialogTitle>{card.name}</DialogTitle>
					<p className="text-sm text-muted-foreground">
						Credit limit:{' '}
						<span className="font-mono font-bold text-foreground">{fmt(limit)}</span>
						{' · '}Outstanding:{' '}
						<span className="font-mono font-bold text-loss">{fmt(outstanding)}</span>
					</p>
				</DialogHeader>
				<div className="flex-1 overflow-y-auto p-5">
					<JournalLedgerView filterAccountHeadId={card.id} />
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── Generic account head ledger dialog ────────────────────────────────────────
// Used from AccountHeadsView to show all entries under any head
export function AccountHeadLedgerDialog({
	headId,
	headName,
	onClose,
}: {
	headId: string | null;
	headName: string;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={!!headId}
			onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-2xl h-[90dvh] flex flex-col p-0">
				<DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
					<DialogTitle>{headName}</DialogTitle>
					<p className="text-sm text-muted-foreground">
						All journal entries for this account head
					</p>
				</DialogHeader>
				<div className="flex-1 overflow-y-auto p-5">
					{headId && <JournalLedgerView filterAccountHeadId={headId} />}
				</div>
			</DialogContent>
		</Dialog>
	);
}
