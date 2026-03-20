import { useState, useEffect, useCallback } from 'react';
import {
	LayoutDashboard,
	Receipt,
	Wallet,
	TrendingUp,
	RefreshCw,
	ArrowLeftRight,
	Target,
	CreditCard,
	Landmark,
	Users,
	BarChart3,
	Sliders,
	Settings,
	Menu,
	CalendarCheck,
	Zap,
	X,
	BookOpen,
} from 'lucide-react';
import { AppProvider, useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { DashboardView } from '@/components/views/DashboardView';
import { ExpensesView } from '@/components/views/ExpensesView';
import { IncomeView } from '@/components/views/IncomeView';
import { TransfersView } from '@/components/views/TransfersView';
import { RecurringView } from '@/components/views/RecurringView';
import { PaymentsView } from '@/components/views/PaymentsView';
import { LoansView } from '@/components/views/LoansView';
import { CreditCardsView } from '@/components/views/CreditCardsView';
import { ReceivablesView } from '@/components/views/ReceivablesView';
import { InvestmentsView } from '@/components/views/InvestmentsView';
import { GoalsView } from '@/components/views/GoalsView';
import { ForecastView } from '@/components/views/ForecastView';
import { SimulatorView } from '@/components/views/SimulatorView';
import { AccountsView } from '@/components/views/AccountsView';
import { ReconciliationView } from '@/components/views/ReconciliationView';
import { LedgerView } from '@/components/views/LedgerView';
import { SettingsView, AccountHeadsView } from '@/components/views/SettingsView';

// ── Nav config ────────────────────────────────────────────────────────────────
type TabId =
	| 'dashboard'
	| 'expenses'
	| 'income'
	| 'transfers'
	| 'recurring'
	| 'payments'
	| 'loans'
	| 'cards'
	| 'receivables'
	| 'investments'
	| 'goals'
	| 'forecast'
	| 'simulator'
	| 'accounts'
	| 'reconciliation'
	| 'ledger'
	| 'accountheads'
	| 'settings';

const VALID_TABS = new Set<TabId>([
	'dashboard',
	'expenses',
	'income',
	'transfers',
	'recurring',
	'payments',
	'loans',
	'cards',
	'receivables',
	'investments',
	'goals',
	'forecast',
	'simulator',
	'accounts',
	'reconciliation',
	'ledger',
	'accountheads',
	'settings',
]);

interface NavItem {
	id: TabId;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	group?: string;
}

const NAV: NavItem[] = [
	{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
	{ id: 'payments', label: 'Payments', icon: CalendarCheck },
	{ id: 'forecast', label: 'Forecast', icon: TrendingUp },
	{ id: 'simulator', label: 'Simulator', icon: Sliders },

	{ id: 'expenses', label: 'Expenses', icon: Receipt, group: 'Money' },
	{ id: 'income', label: 'Income', icon: Zap, group: 'Money' },
	{ id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, group: 'Money' },
	{ id: 'recurring', label: 'Recurring', icon: RefreshCw, group: 'Money' },
	{ id: 'ledger', label: 'Account Book', icon: BookOpen, group: 'Money' },

	{ id: 'accounts', label: 'Accounts', icon: Wallet, group: 'Accounts' },
	{ id: 'loans', label: 'Loans & EMIs', icon: Landmark, group: 'Accounts' },
	{ id: 'cards', label: 'Credit Cards', icon: CreditCard, group: 'Accounts' },
	{ id: 'receivables', label: 'Money Lent', icon: Users, group: 'Accounts' },
	{ id: 'investments', label: 'Investments', icon: BarChart3, group: 'Accounts' },

	{ id: 'goals', label: 'Goals', icon: Target, group: 'Planning' },
	{ id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw, group: 'Planning' },
	{ id: 'accountheads', label: 'Account Heads', icon: BookOpen, group: 'Planning' },

	{ id: 'settings', label: 'Settings', icon: Settings },
];

const BOTTOM_IDS: TabId[] = ['dashboard', 'payments', 'expenses', 'accounts', 'forecast'];

const VIEWS: Record<TabId, React.ComponentType> = {
	dashboard: DashboardView,
	payments: PaymentsView,
	expenses: ExpensesView,
	income: IncomeView,
	transfers: TransfersView,
	recurring: RecurringView,
	ledger: LedgerView,
	loans: LoansView,
	cards: CreditCardsView,
	receivables: ReceivablesView,
	investments: InvestmentsView,
	goals: GoalsView,
	forecast: ForecastView,
	simulator: SimulatorView,
	accounts: AccountsView,
	reconciliation: ReconciliationView,
	accountheads: AccountHeadsView,
	settings: SettingsView,
};

// ── Hash router ───────────────────────────────────────────────────────────────
// Routes: /#/dashboard  /#/expenses  /#/settings  etc.
// Falls back to "dashboard" for any unrecognised hash.

function getTabFromHash(): TabId {
	const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase() as TabId;
	return VALID_TABS.has(hash) ? hash : 'dashboard';
}

function useHashRouter() {
	const [tab, setTabState] = useState<TabId>(getTabFromHash);

	// Listen for back/forward navigation
	useEffect(() => {
		const onHashChange = () => setTabState(getTabFromHash());
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	}, []);

	const setTab = useCallback((id: TabId) => {
		// Push new hash — triggers hashchange which updates state
		window.location.hash = `/${id}`;
	}, []);

	return { tab, setTab };
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
	tab,
	setTab,
	onClose,
}: {
	tab: TabId;
	setTab: (t: TabId) => void;
	onClose?: () => void;
}) {
	const groups = [...new Set(NAV.map((n) => n.group))];
	const ungrouped = NAV.filter((n) => !n.group);
	const { state } = useApp();

	const NavBtn = ({ item }: { item: NavItem }) => {
		const Icon = item.icon;
		const active = tab === item.id;
		return (
			<a
				href={`#/${item.id}`}
				onClick={(e) => {
					e.preventDefault();
					setTab(item.id);
					onClose?.();
				}}
				className={cn(
					'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
					active
						? 'bg-primary/10 text-primary'
						: 'text-muted-foreground hover:bg-accent hover:text-foreground'
				)}>
				<Icon className="h-4 w-4 shrink-0" />
				{item.label}
			</a>
		);
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between p-5 pb-4">
				<a
					href="#/dashboard"
					onClick={(e) => {
						e.preventDefault();
						setTab('dashboard');
					}}>
					<div className="flex items-center gap-2">
						<h1 className="font-display text-lg font-bold text-foreground">
							FinTracker
						</h1>
						<span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
							v4.0
						</span>
					</div>
					<p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
						Personal Finance
					</p>
				</a>
				{onClose && (
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				)}
			</div>

			<div className="h-px bg-border mx-4" />

			<nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
				{ungrouped.map((n) => (
					<NavBtn
						key={n.id}
						item={n}
					/>
				))}
				<div className="h-3" />
				{groups.filter(Boolean).map((group) => (
					<div key={group}>
						<p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
							{group}
						</p>
						{NAV.filter((n) => n.group === group).map((n) => (
							<NavBtn
								key={n.id}
								item={n}
							/>
						))}
						<div className="h-2" />
					</div>
				))}
			</nav>

			<div className="p-4 border-t border-border">
				<div className="flex items-center gap-2">
					<div
						className={cn(
							'h-2 w-2 rounded-full',
							state.syncStatus === 'firebase'
								? 'bg-profit animate-pulse'
								: 'bg-border'
						)}
					/>
					<p className="text-xs text-muted-foreground">
						{state.syncStatus === 'firebase' ? 'Firebase live' : 'Local only'}
					</p>
				</div>
			</div>
		</div>
	);
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function AppShell() {
	const { state } = useApp();
	const { tab, setTab } = useHashRouter();
	const [drawer, setDrawer] = useState(false);

	// Close drawer on navigation
	const navigate = useCallback(
		(id: TabId) => {
			setTab(id);
			setDrawer(false);
		},
		[setTab]
	);

	if (state.loading)
		return (
			<div className="flex h-dvh items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-4">
					<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin-slow" />
					<p className="text-sm text-muted-foreground">Loading your finances…</p>
				</div>
			</div>
		);
	if (state.error)
		return (
			<div className="flex h-dvh items-center justify-center bg-background p-6 text-center">
				<div>
					<p className="text-loss font-bold mb-2">Failed to load</p>
					<p className="text-sm text-muted-foreground">{state.error}</p>
				</div>
			</div>
		);

	const ActiveView = VIEWS[tab];
	const activeItem = NAV.find((n) => n.id === tab);

	return (
		<div className="flex h-dvh overflow-hidden bg-background">
			{/* Desktop sidebar */}
			<aside className="hidden md:flex md:w-60 md:flex-col border-r border-border bg-card shrink-0">
				<Sidebar
					tab={tab}
					setTab={setTab}
				/>
			</aside>

			{/* Mobile drawer overlay */}
			{drawer && (
				<>
					<div
						className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
						onClick={() => setDrawer(false)}
					/>
					<aside className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border md:hidden animate-slide-up">
						<Sidebar
							tab={tab}
							setTab={navigate}
							onClose={() => setDrawer(false)}
						/>
					</aside>
				</>
			)}

			{/* Main */}
			<div className="flex flex-1 flex-col min-w-0">
				{/* Mobile header */}
				<header className="flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-4 py-3 md:hidden sticky top-0 z-30">
					<button
						onClick={() => setDrawer(true)}
						className="rounded-lg p-1.5 hover:bg-accent transition-colors">
						<Menu className="h-5 w-5" />
					</button>
					<div className="flex items-center gap-1.5">
						{state.syncStatus === 'firebase' && (
							<div className="h-1.5 w-1.5 rounded-full bg-profit animate-pulse" />
						)}
						<span className="font-display font-bold text-base">
							{activeItem?.label ?? 'FinTracker'}
						</span>
						{tab === 'dashboard' && (
							<span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary">
								v4.0
							</span>
						)}
					</div>
					<div className="w-8" />
				</header>

				{/* Content */}
				<main className="flex-1 overflow-y-auto pb-20 md:pb-6">
					<div className="mx-auto max-w-2xl px-4 py-5">
						<ActiveView />
					</div>
				</main>

				{/* Mobile bottom nav */}
				<nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/90 backdrop-blur-md md:hidden pb-safe z-30">
					<div className="flex">
						{BOTTOM_IDS.map((id) => {
							const item = NAV.find((n) => n.id === id)!;
							const Icon = item.icon;
							const active = tab === id;
							return (
								<a
									key={id}
									href={`#/${id}`}
									onClick={(e) => {
										e.preventDefault();
										setTab(id);
									}}
									className={cn(
										'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition-colors',
										active ? 'text-primary' : 'text-muted-foreground'
									)}>
									<Icon className="h-5 w-5" />
									{item.label}
								</a>
							);
						})}
						<button
							onClick={() => setDrawer(true)}
							className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-muted-foreground">
							<Menu className="h-5 w-5" />
							More
						</button>
					</div>
				</nav>
			</div>
		</div>
	);
}

export default function App() {
	return (
		<AppProvider>
			<AppShell />
		</AppProvider>
	);
}
