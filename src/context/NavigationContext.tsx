import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from 'react';

export type TabId =
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
	| 'journalledger'
	| 'accountheads'
	| 'settings'
	| 'importreview'
	| 'import';

export const VALID_TABS = new Set<TabId>([
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
	'journalledger',
	'accountheads',
	'settings',
	'importreview',
	'import',
]);

export interface AppRoute {
	tab: TabId;
	subpage?: string;
	id?: string;
	back?: string;
}

interface OpenSubpageOptions {
	tab?: TabId;
	id?: string;
	back?: string;
}

interface NavigationContextValue {
	route: AppRoute;
	tab: TabId;
	setTab: (tab: TabId) => void;
	openSubpage: (subpage: string, options?: OpenSubpageOptions) => void;
	goBack: () => void;
	buildPath: (route: AppRoute) => string;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

function parseHash(): AppRoute {
	const raw = window.location.hash.replace(/^#/, '');
	const [pathPart, queryPart = ''] = raw.split('?');
	const segments = pathPart.replace(/^\//, '').split('/').filter(Boolean);
	const maybeTab = segments[0]?.toLowerCase() as TabId | undefined;
	const tab = maybeTab && VALID_TABS.has(maybeTab) ? maybeTab : 'dashboard';
	const params = new URLSearchParams(queryPart);

	return {
		tab,
		subpage: segments[1],
		id: params.get('id') ?? undefined,
		back: params.get('back') ?? undefined,
	};
}

function buildPath(route: AppRoute): string {
	const segments = [route.tab, route.subpage].filter(Boolean).join('/');
	const params = new URLSearchParams();

	if (route.id) params.set('id', route.id);
	if (route.back) params.set('back', route.back);

	const query = params.toString();
	return `/${segments}${query ? `?${query}` : ''}`;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
	const [route, setRouteState] = useState<AppRoute>(parseHash);

	useEffect(() => {
		const onHashChange = () => setRouteState(parseHash());
		window.addEventListener('hashchange', onHashChange);
		return () => window.removeEventListener('hashchange', onHashChange);
	}, []);

	const navigate = useCallback((next: AppRoute) => {
		window.location.hash = buildPath(next);
	}, []);

	const setTab = useCallback(
		(tab: TabId) => {
			navigate({ tab });
		},
		[navigate]
	);

	const openSubpage = useCallback(
		(subpage: string, options?: OpenSubpageOptions) => {
			navigate({
				tab: options?.tab ?? route.tab,
				subpage,
				id: options?.id,
				back: options?.back ?? buildPath(route),
			});
		},
		[navigate, route]
	);

	const goBack = useCallback(() => {
		if (route.back) {
			window.location.hash = route.back;
			return;
		}

		navigate({ tab: route.tab });
	}, [navigate, route]);

	const value = useMemo(
		() => ({
			route,
			tab: route.tab,
			setTab,
			openSubpage,
			goBack,
			buildPath,
		}),
		[goBack, openSubpage, route, setTab]
	);

	return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
	const context = useContext(NavigationContext);
	if (!context) {
		throw new Error('useNavigation must be used within NavigationProvider');
	}

	return context;
}
