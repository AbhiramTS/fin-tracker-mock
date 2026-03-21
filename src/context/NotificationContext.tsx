import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateId } from '@/utils/id';

export type NotificationTone = 'default' | 'success' | 'warning' | 'error';

export interface ToastInput {
	title: string;
	description?: string;
	tone?: NotificationTone;
	durationMs?: number;
}

interface ToastItem extends ToastInput {
	id: string;
	tone: NotificationTone;
	durationMs: number;
}

interface NotificationContextValue {
	notify: (input: ToastInput) => string;
	dismiss: (id: string) => void;
	clear: () => void;
}

const DEFAULT_DURATION_MS = 4500;
const NotificationCtx = createContext<NotificationContextValue | null>(null);

function toneStyles(tone: NotificationTone) {
	switch (tone) {
		case 'success':
			return {
				icon: CheckCircle2,
				card: 'border-profit/40 bg-profit/10',
				iconClass: 'text-profit',
			};
		case 'warning':
			return {
				icon: AlertTriangle,
				card: 'border-warning/40 bg-warning/10',
				iconClass: 'text-warning',
			};
		case 'error':
			return {
				icon: XCircle,
				card: 'border-loss/40 bg-loss/10',
				iconClass: 'text-loss',
			};
		default:
			return {
				icon: Info,
				card: 'border-border bg-card/95',
				iconClass: 'text-primary',
			};
	}
}

function ToastViewport({
	toasts,
	onDismiss,
}: {
	toasts: ToastItem[];
	onDismiss: (id: string) => void;
}) {
	return (
		<div className="pointer-events-none fixed right-3 top-3 z-[70] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 md:right-5 md:top-5">
			{toasts.map((toast) => {
				const style = toneStyles(toast.tone);
				const Icon = style.icon;
				return (
					<div
						key={toast.id}
						className={cn(
							'pointer-events-auto overflow-hidden rounded-xl border p-3 shadow-xl backdrop-blur-sm animate-fade-in',
							style.card
						)}>
						<div className="flex items-start gap-2.5">
							<div className={cn('mt-0.5 shrink-0', style.iconClass)}>
								<Icon className="h-4 w-4" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-semibold text-foreground leading-tight">
									{toast.title}
								</p>
								{toast.description && (
									<p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
										{toast.description}
									</p>
								)}
							</div>
							<button
								type="button"
								onClick={() => onDismiss(toast.id)}
								className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								aria-label="Dismiss notification">
								<X className="h-3.5 w-3.5" />
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<ToastItem[]>([]);
	const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

	const dismiss = useCallback((id: string) => {
		setToasts((current) => current.filter((t) => t.id !== id));
		const timer = timersRef.current.get(id);
		if (timer) {
			clearTimeout(timer);
			timersRef.current.delete(id);
		}
	}, []);

	const notify = useCallback(
		(input: ToastInput) => {
			const id = generateId();
			const toast: ToastItem = {
				id,
				title: input.title,
				description: input.description,
				tone: input.tone ?? 'default',
				durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
			};
			setToasts((current) => [toast, ...current].slice(0, 5));

			const timeout = setTimeout(() => dismiss(id), toast.durationMs);
			timersRef.current.set(id, timeout);
			return id;
		},
		[dismiss]
	);

	const clear = useCallback(() => {
		for (const timer of timersRef.current.values()) clearTimeout(timer);
		timersRef.current.clear();
		setToasts([]);
	}, []);

	useEffect(() => clear, [clear]);

	const value = useMemo(() => ({ notify, dismiss, clear }), [notify, dismiss, clear]);

	return (
		<NotificationCtx.Provider value={value}>
			{children}
			<ToastViewport
				toasts={toasts}
				onDismiss={dismiss}
			/>
		</NotificationCtx.Provider>
	);
}

export function useNotifications(): NotificationContextValue {
	const ctx = useContext(NotificationCtx);
	if (!ctx) {
		throw new Error('useNotifications must be used within NotificationProvider');
	}
	return ctx;
}